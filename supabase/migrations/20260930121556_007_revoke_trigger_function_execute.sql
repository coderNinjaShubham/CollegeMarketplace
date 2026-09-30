/*
# Revoke EXECUTE on trigger-only SECURITY DEFINER functions

The previous REVOKE FROM PUBLIC did not fully remove access to handle_new_user
and set_order_seller. Explicitly revoking from anon and authenticated ensures
these trigger-only functions are not callable via the REST API.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.set_order_seller() FROM anon;
REVOKE EXECUTE ON FUNCTION public.set_order_seller() FROM authenticated;
