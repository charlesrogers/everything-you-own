-- Add visibility to products: shared (household-wide) or private (creator only)
ALTER TABLE products ADD COLUMN visibility TEXT NOT NULL DEFAULT 'shared'
  CHECK (visibility IN ('shared', 'private'));

-- Update product RLS: shared items visible to household, private only to creator
DROP POLICY IF EXISTS "Household members can view products" ON products;
CREATE POLICY "Household members can view products"
  ON products FOR SELECT
  USING (
    household_id IN (SELECT user_household_ids())
    AND (visibility = 'shared' OR added_by = auth.uid())
  );

DROP POLICY IF EXISTS "Household members can update products" ON products;
CREATE POLICY "Household members can update products"
  ON products FOR UPDATE
  USING (
    household_id IN (SELECT user_household_ids())
    AND (visibility = 'shared' OR added_by = auth.uid())
  );

DROP POLICY IF EXISTS "Household members can delete products" ON products;
CREATE POLICY "Household members can delete products"
  ON products FOR DELETE
  USING (
    household_id IN (SELECT user_household_ids())
    AND (visibility = 'shared' OR added_by = auth.uid())
  );
