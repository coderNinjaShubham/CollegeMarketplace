/*
# Fix anon access to public.is_admin()

## Overview
The SELECT policies on `products` and `product_images` are open to both `anon` and `authenticated`.
Because the policies evaluate `public.is_admin()`, the `anon` role requires EXECUTE permission
on `is_admin()`. Without this, unauthenticated visitors attempting to browse products receive:
`permission denied for function is_admin`.

## Security
`is_admin()` checks `auth.uid() = id AND role = 'admin'`. For `anon` users, `auth.uid()` is NULL,
so `is_admin()` safely and correctly evaluates to `false`.
*/

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon;
