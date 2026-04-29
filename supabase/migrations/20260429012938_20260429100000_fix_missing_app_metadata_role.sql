/*
  # Fix missing app_metadata role for existing users

  1. Problem
    - Some users (especially early customers) don't have `role` in their
      `raw_app_meta_data`. This causes RLS policies that check
      `auth.jwt() -> 'app_metadata' ->> 'role'` to return NULL instead
      of the expected role value.
    - The COALESCE fallback to `user_metadata ->> 'role'` works in most
      cases, but is fragile and can break during token refresh or if
      user_metadata is cleared.

  2. Solution
    - Update all auth.users rows to ensure `raw_app_meta_data` contains
      the `role` field, sourced from `raw_user_meta_data->>'role'` with
      a fallback to the profiles table role.
    - This makes the JWT always contain the role in app_metadata,
      which is the secure, server-side source of truth.

  3. Security
    - This is a one-time data fix, no schema changes
    - app_metadata can only be set by the server (not by users),
      making it the correct place for authorization data
*/

DO $$
DECLARE
  user_record RECORD;
  profile_role text;
BEGIN
  FOR user_record IN SELECT id, raw_user_meta_data, raw_app_meta_data FROM auth.users LOOP
    -- Skip if app_metadata already has role
    IF user_record.raw_app_meta_data->>'role' IS NOT NULL THEN
      CONTINUE;
    END IF;

    -- Get role from user_metadata, or fallback to profiles table
    profile_role := user_record.raw_user_meta_data->>'role';
    IF profile_role IS NULL THEN
      SELECT role INTO profile_role FROM public.profiles WHERE id = user_record.id;
    END IF;
    IF profile_role IS NULL THEN
      profile_role := 'customer';
    END IF;

    -- Update app_metadata to include the role
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(user_record.raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('role', profile_role)
    WHERE id = user_record.id;
  END LOOP;
END $$;
