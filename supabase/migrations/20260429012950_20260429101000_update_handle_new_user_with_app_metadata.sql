/*
  # Update handle_new_user trigger to set app_metadata role

  1. Changes
    - Update the `handle_new_user()` trigger function to also set
      `raw_app_meta_data->>'role'` when a new user is created.
    - This ensures every new user has their role in app_metadata from
      the start, making RLS policy checks reliable.

  2. Security
    - The trigger runs as SECURITY DEFINER (superuser), so it can
      modify auth.users.raw_app_meta_data
    - This is the recommended pattern for storing authorization data
      in Supabase (app_metadata, not user_metadata)
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $function$
DECLARE
  user_role text;
BEGIN
  user_role := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');

  -- Insert into public profiles
  INSERT INTO public.profiles (id, email, role, full_name, username)
  VALUES (
    NEW.id,
    NEW.email,
    user_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.raw_user_meta_data->>'username', '')
  );

  -- Ensure app_metadata has the role set
  IF NEW.raw_app_meta_data->>'role' IS NULL THEN
    NEW.raw_app_meta_data := COALESCE(NEW.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', user_role);
    UPDATE auth.users SET raw_app_meta_data = NEW.raw_app_meta_data WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;
