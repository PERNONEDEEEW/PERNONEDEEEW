/*
  # Add cashier RLS policies for staff_logs

  1. Security Changes
    - Add INSERT policy for cashiers (using admin_id = auth.uid())
    - Add SELECT policy for cashiers to read cashier logs
    - Keep existing admin policies unchanged

  2. Important Notes
    - Cashiers need to insert their own login records
    - Cashiers can read all staff_logs entries (to see their own logs)
    - The admin_id column is reused for cashier profile IDs
*/

CREATE POLICY "Cashiers can insert staff logs"
  ON staff_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'cashier'
    )
    AND admin_id = auth.uid()
  );

CREATE POLICY "Cashiers can read staff logs"
  ON staff_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'cashier'
    )
  );
