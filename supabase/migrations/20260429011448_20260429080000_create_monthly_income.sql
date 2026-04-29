/*
  # Create monthly_income table and income tracking

  1. New Tables
    - `monthly_income`
      - `id` (uuid, primary key)
      - `month` (integer, e.g. 1-12)
      - `year` (integer, e.g. 2026)
      - `total_income` (numeric, default 0)
      - `total_orders` (integer, default 0)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - Unique constraint on (month, year) so each month has one record

  2. Security
    - Enable RLS on `monthly_income` table
    - Admin can read and update monthly income
    - Cashier can read monthly income
    - No public or customer access

  3. Functions
    - `update_monthly_income()` trigger function that runs after
      an order's status changes to 'completed', automatically
      adding the order amount to the current month's income record
      (or creating it if it doesn't exist yet)

  4. Important Notes
    - Each month gets its own row, so when a new month starts,
      income naturally starts at 0 since no row exists yet
    - The trigger auto-creates the row on first completed order of the month
*/

CREATE TABLE IF NOT EXISTS monthly_income (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month integer NOT NULL CHECK (month >= 1 AND month <= 12),
  year integer NOT NULL CHECK (year >= 2020),
  total_income numeric NOT NULL DEFAULT 0 CHECK (total_income >= 0),
  total_orders integer NOT NULL DEFAULT 0 CHECK (total_orders >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_month_year UNIQUE (month, year)
);

ALTER TABLE monthly_income ENABLE ROW LEVEL SECURITY;

-- Admin can read monthly income
CREATE POLICY "Admins can read monthly income"
  ON monthly_income FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Cashier can read monthly income
CREATE POLICY "Cashiers can read monthly income"
  ON monthly_income FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'cashier'
    )
  );

-- Admin can insert monthly income (for trigger)
CREATE POLICY "Admins can insert monthly income"
  ON monthly_income FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Service role can do everything (for trigger function)
CREATE POLICY "Service role full access on monthly_income"
  ON monthly_income FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Trigger function to update monthly income when order is completed
CREATE OR REPLACE FUNCTION update_monthly_income()
RETURNS TRIGGER AS $$
DECLARE
  current_month integer;
  current_year integer;
BEGIN
  -- Only trigger when order_status changes to 'completed'
  IF NEW.order_status = 'completed' AND (OLD.order_status IS NULL OR OLD.order_status != 'completed') THEN
    current_month := EXTRACT(MONTH FROM now());
    current_year := EXTRACT(YEAR FROM now());

    -- Insert or update the monthly income record
    INSERT INTO monthly_income (month, year, total_income, total_orders, updated_at)
    VALUES (current_month, current_year, NEW.total_amount, 1, now())
    ON CONFLICT (month, year)
    DO UPDATE SET
      total_income = monthly_income.total_income + NEW.total_amount,
      total_orders = monthly_income.total_orders + 1,
      updated_at = now();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on orders table
DROP TRIGGER IF EXISTS on_order_completed ON orders;
CREATE TRIGGER on_order_completed
  AFTER UPDATE ON orders
  FOR EACH ROW
  EXECUTE FUNCTION update_monthly_income();

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_monthly_income_month_year ON monthly_income(month, year);
