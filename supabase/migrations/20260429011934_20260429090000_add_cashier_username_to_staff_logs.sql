/*
  # Add cashier_username column to staff_logs

  1. Changes
    - Add `cashier_username` column (text, nullable) to `staff_logs` table
      This column stores the cashier's username when a cashier logs in,
      distinguishing cashier logins from admin logins.

  2. Security
    - No RLS changes needed; existing policies remain valid

  3. Important Notes
    - For admin logins, `cashier_username` will be NULL
    - For cashier logins, `cashier_username` will contain the cashier's username
    - The `admin_id` column is reused to store the cashier's profile ID for cashier logins
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff_logs' AND column_name = 'cashier_username'
  ) THEN
    ALTER TABLE staff_logs ADD COLUMN cashier_username text DEFAULT '';
  END IF;
END $$;
