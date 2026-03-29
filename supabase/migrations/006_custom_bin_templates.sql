-- Allow user-defined bin templates with brand
ALTER TABLE location_templates ADD COLUMN IF NOT EXISTS brand TEXT;
ALTER TABLE location_templates ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES households(id) ON DELETE CASCADE;

-- Seed new built-in bin types
INSERT INTO location_templates (id, name, brand, category, width_in, depth_in, height_in, volume_gal) VALUES
  ('ammo_30cal',     '.30 Cal Ammo Can',  'Military Surplus', 'bin', 3.5,   10.9,  7.3,  1.2),
  ('ammo_50cal',     '.50 Cal Ammo Can',  'Military Surplus', 'bin', 5.5,   11.5,  8.5,  2.3),
  ('ammo_fat50',     'Fat .50 Cal Can',   'Military Surplus', 'bin', 7.5,   11.5,  8.5,  3.2),
  ('ammo_20mm',      '20mm Ammo Can',     'Military Surplus', 'bin', 7.5,   14.5,  10,   4.7),
  ('plano_3600',     'Plano 3600',        'Plano',            'bin', 9,     14,    2,    1.1),
  ('plano_3700',     'Plano 3700',        'Plano',            'bin', 11,    14,    2,    1.3),
  ('sterilite_6qt',  'Sterilite 6 qt',    'Sterilite',        'bin', 8.25,  13.6,  4.9,  1.5),
  ('sterilite_16qt', 'Sterilite 16 qt',   'Sterilite',        'bin', 11.9,  16.8,  6.1,  4),
  ('sterilite_28qt', 'Sterilite 28 qt',   'Sterilite',        'bin', 13.5,  16.3,  6.5,  7),
  ('sterilite_66qt', 'Sterilite 66 qt',   'Sterilite',        'bin', 17.1,  23.6,  6.6,  16.5)
ON CONFLICT (id) DO NOTHING;

-- Update existing SAMLA templates with brand
UPDATE location_templates SET brand = 'IKEA' WHERE id LIKE 'samla_%';
UPDATE location_templates SET brand = 'IKEA' WHERE id = 'omar_rack';

-- Update RLS: public templates (household_id IS NULL) visible to all,
-- user templates visible only to their household
DROP POLICY IF EXISTS "Anyone can view location templates" ON location_templates;
CREATE POLICY "View public or own household templates"
  ON location_templates FOR SELECT
  USING (household_id IS NULL OR household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can create templates"
  ON location_templates FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can update own templates"
  ON location_templates FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can delete own templates"
  ON location_templates FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));
