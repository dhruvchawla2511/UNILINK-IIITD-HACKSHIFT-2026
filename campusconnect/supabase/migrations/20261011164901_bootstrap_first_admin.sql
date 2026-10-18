/*
# Bootstrap: First user becomes super_admin

Updates the handle_new_user trigger function so that the very first user
to sign up automatically receives the 'super_admin' role. All subsequent
users get the default 'student' role. This ensures the platform has an
initial administrator without manual database intervention.

## Changes
- Modified function: handle_new_user() — checks if profiles table is empty;
  if so, assigns 'super_admin' role instead of 'student'.
*/

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  user_count integer;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.profiles;
  IF user_count = 0 THEN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.email), 'super_admin');
  ELSE
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', new.email));
  END IF;
  RETURN new;
END;
$$;
