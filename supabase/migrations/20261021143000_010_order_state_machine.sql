-- Migration 010: Phase 5 — Order State Machine & Notification Triggers
-- 
-- This migration:
-- 1. Adds a UNIQUE partial index preventing duplicate active reservations
--    (a buyer cannot have two pending/accepted orders for the same product)
-- 2. Creates a SECURITY DEFINER function `process_order_transition` that:
--    - Validates the state transition is legal for the caller's role
--    - Prevents users from acting on behalf of others
--    - Updates the product status when appropriate (reserved when accepted, active if rejected/cancelled)
--    - Inserts notifications for both parties after each transition
-- 3. Creates a SECURITY DEFINER function `create_reservation` that:
--    - Validates the buyer is not the seller
--    - Validates the product is still active
--    - Creates the order AND notifies the seller — atomically
-- 4. Adds a notification_type value 'order' (already exists in enum)

-- ─── 1. Unique partial index: one active reservation per buyer per product ─────
-- Prevents duplicate pending or accepted reservations.
-- Rejected/cancelled/completed orders are not covered — historical records kept.

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_unique_active_reservation
  ON orders (buyer_id, product_id)
  WHERE status IN ('pending', 'accepted');

-- ─── 2. Secure order transition function ───────────────────────────────────────
-- 
-- Valid transitions:
--   pending   → accepted   (seller only)
--   pending   → rejected   (seller only)
--   pending   → cancelled  (buyer only)
--   accepted  → completed  (seller only)  ← seller marks exchange happened
--   accepted  → confirmed  — buyer_confirmed flag (future; for now buyer can also call completed)
--   accepted  → cancelled  (buyer only)   ← buyer can cancel accepted order
--
-- Unauthorized transitions raise an exception.

CREATE OR REPLACE FUNCTION public.process_order_transition(
  p_order_id uuid,
  p_new_status order_status
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order         orders%ROWTYPE;
  v_caller_id     uuid := auth.uid();
  v_product_title text;
  v_seller_name   text;
  v_buyer_name    text;
  v_notif_seller  json;
  v_notif_buyer   json;
BEGIN
  -- Fetch the order (will error if not found)
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  -- Caller must be buyer or seller
  IF v_caller_id != v_order.buyer_id AND v_caller_id != v_order.seller_id THEN
    RAISE EXCEPTION 'Not authorized: you are not a participant in this order';
  END IF;

  -- ─── State machine validation ───────────────────────────────────────────────
  CASE v_order.status
    WHEN 'pending' THEN
      IF p_new_status = 'accepted' OR p_new_status = 'rejected' THEN
        IF v_caller_id != v_order.seller_id THEN
          RAISE EXCEPTION 'Only the seller can accept or reject a pending reservation';
        END IF;
      ELSIF p_new_status = 'cancelled' THEN
        IF v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only the buyer can cancel their own reservation';
        END IF;
      ELSE
        RAISE EXCEPTION 'Invalid transition from pending to %', p_new_status;
      END IF;

    WHEN 'accepted' THEN
      IF p_new_status = 'completed' THEN
        -- Either buyer or seller can mark completed (exchange happened)
        IF v_caller_id != v_order.seller_id AND v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only buyer or seller can mark an order as completed';
        END IF;
      ELSIF p_new_status = 'cancelled' THEN
        IF v_caller_id != v_order.buyer_id THEN
          RAISE EXCEPTION 'Only the buyer can cancel an accepted reservation';
        END IF;
      ELSE
        RAISE EXCEPTION 'Invalid transition from accepted to %', p_new_status;
      END IF;

    ELSE
      -- rejected, completed, cancelled are terminal states
      RAISE EXCEPTION 'Order in status % cannot be transitioned further', v_order.status;
  END CASE;

  -- ─── Apply transition ────────────────────────────────────────────────────────
  UPDATE orders
    SET status = p_new_status,
        updated_at = now(),
        completed_at = CASE WHEN p_new_status = 'completed' THEN now() ELSE completed_at END
  WHERE id = p_order_id;

  -- ─── Sync product status ─────────────────────────────────────────────────────
  SELECT title INTO v_product_title FROM products WHERE id = v_order.product_id;

  IF p_new_status = 'accepted' THEN
    -- Product moves to reserved when seller accepts
    UPDATE products SET status = 'reserved', updated_at = now()
    WHERE id = v_order.product_id AND status = 'active';

  ELSIF p_new_status IN ('rejected', 'cancelled') THEN
    -- Product reverts to active if it was reserved for this order
    -- Only revert if still reserved (another order might have completed it)
    UPDATE products SET status = 'active', updated_at = now()
    WHERE id = v_order.product_id AND status = 'reserved';

  ELSIF p_new_status = 'completed' THEN
    -- Product becomes sold
    UPDATE products SET status = 'sold', updated_at = now()
    WHERE id = v_order.product_id;
  END IF;

  -- ─── Fetch display names for notifications ───────────────────────────────────
  SELECT name INTO v_seller_name FROM profiles WHERE id = v_order.seller_id;
  SELECT name INTO v_buyer_name  FROM profiles WHERE id = v_order.buyer_id;

  -- ─── Create notifications ────────────────────────────────────────────────────
  -- Note: RLS on notifications only allows user_id = auth.uid().
  -- This SECURITY DEFINER function bypasses RLS to notify the OTHER party.

  CASE p_new_status
    WHEN 'accepted' THEN
      -- Notify buyer: their reservation was accepted
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.buyer_id,
        'order',
        'Reservation Accepted!',
        v_seller_name || ' accepted your reservation for "' || v_product_title || '". Arrange pickup!',
        '/dashboard/orders'
      );

    WHEN 'rejected' THEN
      -- Notify buyer: their reservation was rejected
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.buyer_id,
        'order',
        'Reservation Declined',
        v_seller_name || ' declined your reservation for "' || v_product_title || '".',
        '/dashboard/orders'
      );

    WHEN 'cancelled' THEN
      -- Notify seller: buyer cancelled
      INSERT INTO notifications (user_id, type, title, body, link)
      VALUES (
        v_order.seller_id,
        'order',
        'Reservation Cancelled',
        v_buyer_name || ' cancelled their reservation for "' || v_product_title || '".',
        '/dashboard/orders'
      );

    WHEN 'completed' THEN
      -- Notify the OTHER party about completion
      IF v_caller_id = v_order.seller_id THEN
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
          v_order.buyer_id,
          'order',
          'Order Completed',
          '"' || v_product_title || '" has been marked as completed by the seller.',
          '/dashboard/orders'
        );
      ELSE
        INSERT INTO notifications (user_id, type, title, body, link)
        VALUES (
          v_order.seller_id,
          'order',
          'Order Completed',
          v_buyer_name || ' confirmed completion of "' || v_product_title || '".',
          '/dashboard/orders'
        );
      END IF;

    ELSE NULL;
  END CASE;

  RETURN json_build_object('success', true, 'new_status', p_new_status);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.process_order_transition(uuid, order_status) FROM anon;
GRANT  EXECUTE ON FUNCTION public.process_order_transition(uuid, order_status) TO authenticated;

-- ─── 3. Secure create_reservation function ────────────────────────────────────
-- Creates an order AND notifies the seller atomically.
-- Validates:
--   - caller is not the seller (can't buy own item)
--   - product exists and is 'active'
--   - no existing active (pending/accepted) order from this buyer for this product

CREATE OR REPLACE FUNCTION public.create_reservation(
  p_product_id     uuid,
  p_message        text DEFAULT NULL,
  p_meeting_location text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_caller_id     uuid := auth.uid();
  v_product       products%ROWTYPE;
  v_order_id      uuid;
  v_buyer_name    text;
  v_existing      uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Fetch product
  SELECT * INTO v_product FROM products WHERE id = p_product_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Product not found';
  END IF;

  -- Prevent self-reservation
  IF v_product.seller_id = v_caller_id THEN
    RAISE EXCEPTION 'You cannot reserve your own listing';
  END IF;

  -- Product must be active
  IF v_product.status != 'active' THEN
    RAISE EXCEPTION 'This item is not available for reservation (status: %)', v_product.status;
  END IF;

  -- Prevent duplicate active reservation
  SELECT id INTO v_existing
    FROM orders
   WHERE buyer_id = v_caller_id
     AND product_id = p_product_id
     AND status IN ('pending', 'accepted')
   LIMIT 1;

  IF FOUND THEN
    RAISE EXCEPTION 'You already have an active reservation for this item';
  END IF;

  -- Create the order (seller_id will be set by trigger)
  INSERT INTO orders (product_id, buyer_id, seller_id, status, quantity, message, meeting_location)
  VALUES (p_product_id, v_caller_id, v_product.seller_id, 'pending', 1, p_message, p_meeting_location)
  RETURNING id INTO v_order_id;

  -- Notify seller (SECURITY DEFINER allows inserting for another user_id)
  SELECT name INTO v_buyer_name FROM profiles WHERE id = v_caller_id;

  INSERT INTO notifications (user_id, type, title, body, link)
  VALUES (
    v_product.seller_id,
    'order',
    'New Reservation Request!',
    v_buyer_name || ' wants to reserve "' || v_product.title || '".',
    '/dashboard/orders'
  );

  RETURN json_build_object('success', true, 'order_id', v_order_id);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_reservation(uuid, text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.create_reservation(uuid, text, text) TO authenticated;
