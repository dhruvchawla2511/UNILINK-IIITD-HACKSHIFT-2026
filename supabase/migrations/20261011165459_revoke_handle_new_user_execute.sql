/*
# Revoke public execute on handle_new_user

The handle_new_user() function is a SECURITY DEFINER trigger function that
auto-creates a profile row when a new auth user is created. It should only
be called by the database trigger, not via the REST API. This revokes
EXECUTE from anon and authenticated roles to close that surface.
*/

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
