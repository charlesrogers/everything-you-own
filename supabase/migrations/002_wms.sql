-- ============================================
-- WMS (Warehouse Management System) Migration
-- Adds location hierarchy, product-location mapping,
-- consumables tracking, and usage logging.
-- ============================================

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE location_type AS ENUM ('room', 'zone', 'unit', 'compartment');

CREATE TYPE measurement_unit AS ENUM (
  'each', 'feet', 'inches', 'yards', 'meters',
  'bags', 'rolls', 'boxes', 'packs',
  'oz', 'lb', 'g', 'kg',
  'ml', 'l', 'fl_oz', 'gal',
  'sq_ft', 'sq_in'
);

-- ============================================
-- LOCATION TEMPLATES (reference data)
-- ============================================
CREATE TABLE location_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,  -- bin, rack, drawer, closet, shelf, custom
  width_in NUMERIC(8,2),
  depth_in NUMERIC(8,2),
  height_in NUMERIC(8,2),
  volume_gal NUMERIC(8,2),
  default_compartments JSONB  -- e.g. {"count": 6, "type": "shelf", "height_in": 11.5}
);

INSERT INTO location_templates VALUES
  ('samla_1gal',  'SAMLA 1 gal',    'bin',   11,    7.5,   5.5,   1,    NULL),
  ('samla_3gal',  'SAMLA 3 gal',    'bin',   15.25, 11,    5.5,   3,    NULL),
  ('samla_6gal',  'SAMLA 6 gal',    'bin',   15.25, 11,    11,    6,    NULL),
  ('samla_12gal', 'SAMLA 12 gal',   'bin',   22,    15.25, 11,    12,   NULL),
  ('samla_15gal', 'SAMLA 15 gal',   'bin',   30.75, 22,    7,     15,   NULL),
  ('samla_17gal', 'SAMLA 17 gal',   'bin',   22.5,  15.25, 16.5,  17,   NULL),
  ('samla_34gal', 'SAMLA 34 gal',   'bin',   30.75, 22,    17,    34,   NULL),
  ('omar_rack',   'IKEA OMAR Rack', 'rack',  36.25, 14,    72,    NULL, '{"count": 6, "type": "shelf", "height_in": 11.5}'),
  ('tool_chest',  'Tool Chest',     'cabinet', NULL, NULL,  NULL,  NULL, NULL),
  ('closet',      'Closet',         'closet',  NULL, NULL,  NULL,  NULL, NULL),
  ('kitchen_drawer', 'Kitchen Drawer', 'drawer', NULL, NULL, NULL, NULL, NULL),
  ('custom',      'Custom',         'custom',  NULL, NULL,  NULL,  NULL, NULL);

-- ============================================
-- LOCATIONS (unified hierarchy via adjacency list)
-- ============================================
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES locations(id) ON DELETE CASCADE,
  location_type location_type NOT NULL,
  unit_subtype TEXT,  -- rack, cabinet, closet, drawer, shelf, bin, pegboard, hanging_rod, floor, etc.
  name TEXT NOT NULL,
  label TEXT,  -- short label for NFC/QR (e.g. "R1-S3-B2")
  short_id TEXT UNIQUE,  -- 8-char base62 for scan URLs
  template_id TEXT REFERENCES location_templates(id),
  width_in NUMERIC(8,2),
  depth_in NUMERIC(8,2),
  height_in NUMERIC(8,2),
  nfc_tag_id TEXT,
  metadata JSONB DEFAULT '{}',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_archived BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_loc_household ON locations(household_id);
CREATE INDEX idx_loc_parent ON locations(parent_id);
CREATE INDEX idx_loc_type ON locations(household_id, location_type);
CREATE INDEX idx_loc_short_id ON locations(short_id) WHERE short_id IS NOT NULL;
CREATE INDEX idx_loc_nfc ON locations(nfc_tag_id) WHERE nfc_tag_id IS NOT NULL;

CREATE TRIGGER locations_updated_at
  BEFORE UPDATE ON locations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- PRODUCT_LOCATIONS (junction: products <-> locations)
-- ============================================
CREATE TABLE product_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(product_id, location_id)
);

CREATE INDEX idx_pl_product ON product_locations(product_id);
CREATE INDEX idx_pl_location ON product_locations(location_id);
CREATE INDEX idx_pl_household ON product_locations(household_id);

-- ============================================
-- USAGE_LOG (consumables tracking)
-- ============================================
CREATE TABLE usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  quantity_used NUMERIC(10,3) NOT NULL,
  unit measurement_unit NOT NULL DEFAULT 'each',
  remaining_quantity NUMERIC(10,3),
  note TEXT,
  project TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  logged_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX idx_ul_product ON usage_log(product_id);
CREATE INDEX idx_ul_household ON usage_log(household_id);
CREATE INDEX idx_ul_logged ON usage_log(household_id, logged_at DESC);

-- ============================================
-- ADD CONSUMABLE COLUMNS TO PRODUCTS
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS consumable_quantity NUMERIC(10,3);
ALTER TABLE products ADD COLUMN IF NOT EXISTS consumable_unit measurement_unit;
ALTER TABLE products ADD COLUMN IF NOT EXISTS consumable_min_threshold NUMERIC(10,3);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;

-- location_templates is public reference data
ALTER TABLE location_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view location templates"
  ON location_templates FOR SELECT
  USING (true);

-- Locations
CREATE POLICY "Household members can view locations"
  ON locations FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can insert locations"
  ON locations FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can update locations"
  ON locations FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can delete locations"
  ON locations FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Product Locations
CREATE POLICY "Household members can view product_locations"
  ON product_locations FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can insert product_locations"
  ON product_locations FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can update product_locations"
  ON product_locations FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can delete product_locations"
  ON product_locations FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Usage Log
CREATE POLICY "Household members can view usage_log"
  ON usage_log FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));
CREATE POLICY "Household members can insert usage_log"
  ON usage_log FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- ============================================
-- HELPER: Generate short_id for scan URLs
-- ============================================
CREATE OR REPLACE FUNCTION generate_short_id()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * 62 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Auto-assign short_id on location insert
CREATE OR REPLACE FUNCTION assign_short_id()
RETURNS TRIGGER AS $$
DECLARE
  new_sid TEXT;
  attempts INTEGER := 0;
BEGIN
  IF NEW.short_id IS NULL THEN
    LOOP
      new_sid := generate_short_id();
      -- Check uniqueness
      IF NOT EXISTS (SELECT 1 FROM locations WHERE short_id = new_sid) THEN
        NEW.short_id := new_sid;
        EXIT;
      END IF;
      attempts := attempts + 1;
      IF attempts > 10 THEN
        RAISE EXCEPTION 'Could not generate unique short_id after 10 attempts';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER locations_assign_short_id
  BEFORE INSERT ON locations
  FOR EACH ROW EXECUTE FUNCTION assign_short_id();

-- ============================================
-- SEED: Basement Storage Room with 4 OMAR Racks
-- ============================================
CREATE OR REPLACE FUNCTION seed_basement_storage(p_household_id UUID)
RETURNS UUID AS $$
DECLARE
  room_id UUID;
  rack_id UUID;
  shelf_id UUID;
  r INTEGER;
  s INTEGER;
BEGIN
  -- Create room
  INSERT INTO locations (household_id, location_type, name, sort_order)
  VALUES (p_household_id, 'room', 'Basement Storage Room', 0)
  RETURNING id INTO room_id;

  -- Create 4 OMAR racks
  FOR r IN 1..4 LOOP
    INSERT INTO locations (
      household_id, parent_id, location_type, unit_subtype,
      name, label, sort_order,
      template_id, width_in, depth_in, height_in,
      metadata
    ) VALUES (
      p_household_id, room_id, 'unit', 'rack',
      'OMAR Rack ' || r, 'R' || r, r - 1,
      'omar_rack', 36.25, 14, 72,
      jsonb_build_object('brand', 'IKEA', 'model', 'OMAR', 'shelves', 6)
    ) RETURNING id INTO rack_id;

    -- Create 6 shelves per rack
    FOR s IN 1..6 LOOP
      INSERT INTO locations (
        household_id, parent_id, location_type, unit_subtype,
        name, label, sort_order,
        width_in, depth_in, height_in
      ) VALUES (
        p_household_id, rack_id, 'compartment', 'shelf',
        'Shelf ' || s, 'R' || r || '-S' || s, s - 1,
        36.25, 14, 11.5
      );
    END LOOP;
  END LOOP;

  RETURN room_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- HELPER: Compute how many bins fit on a shelf
-- ============================================
CREATE OR REPLACE FUNCTION bins_that_fit(
  shelf_width NUMERIC, shelf_depth NUMERIC,
  bin_width NUMERIC, bin_depth NUMERIC
) RETURNS INTEGER AS $$
BEGIN
  RETURN GREATEST(
    FLOOR(shelf_width / bin_width) * FLOOR(shelf_depth / bin_depth),
    FLOOR(shelf_width / bin_depth) * FLOOR(shelf_depth / bin_width)
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;
