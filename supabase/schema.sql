-- ============================================
-- Everything You Own - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE product_status AS ENUM ('purchased', 'wishlist', 'returned', 'gifted', 'sold');
CREATE TYPE product_ownership AS ENUM ('mine', 'household', 'partner');
CREATE TYPE product_condition AS ENUM ('new', 'like_new', 'good', 'fair', 'poor');
CREATE TYPE weight_unit AS ENUM ('oz', 'lb', 'g', 'kg');
CREATE TYPE volume_unit AS ENUM ('ml', 'l', 'fl_oz', 'gal');
CREATE TYPE relationship_type AS ENUM (
  'goes_with', 'replaced_by', 'variant_of', 'accessory_for',
  'outfit_ensemble', 'set_member', 'repurchase_of', 'parent_child'
);

-- ============================================
-- HOUSEHOLDS & MEMBERS
-- ============================================
CREATE TABLE households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL DEFAULT 'My Household',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  display_name TEXT,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, user_id)
);

CREATE INDEX idx_hm_user ON household_members(user_id);
CREATE INDEX idx_hm_household ON household_members(household_id);

-- ============================================
-- CATEGORIES
-- ============================================
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_cat_household ON categories(household_id);

-- ============================================
-- SUBCATEGORIES
-- ============================================
CREATE TABLE subcategories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subcat_category ON subcategories(category_id);
CREATE INDEX idx_subcat_household ON subcategories(household_id);

-- ============================================
-- PRODUCTS
-- ============================================
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  added_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  brand TEXT,
  category_id UUID NOT NULL REFERENCES categories(id),
  subcategory_id UUID NOT NULL REFERENCES subcategories(id),
  description TEXT,
  image_url TEXT,
  additional_images TEXT[] DEFAULT '{}',
  source_url TEXT,
  retailer TEXT,
  price NUMERIC(10,2),
  original_price NUMERIC(10,2),
  currency TEXT NOT NULL DEFAULT 'USD',
  purchase_date DATE,
  date_added TIMESTAMPTZ NOT NULL DEFAULT now(),
  status product_status NOT NULL DEFAULT 'purchased',
  sku TEXT,
  upc TEXT,
  weight NUMERIC(10,3),
  weight_unit weight_unit,
  volume NUMERIC(10,3),
  volume_unit volume_unit,
  dimensions JSONB,
  material TEXT,
  color TEXT,
  size TEXT,
  condition product_condition,
  rating SMALLINT CHECK (rating IS NULL OR (rating >= 0 AND rating <= 5)),
  notes TEXT,
  return_by_date DATE,
  warranty_expires DATE,
  order_id TEXT,
  ownership product_ownership DEFAULT 'mine',
  is_consumable BOOLEAN DEFAULT false,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prod_household ON products(household_id);
CREATE INDEX idx_prod_category ON products(category_id);
CREATE INDEX idx_prod_subcategory ON products(subcategory_id);
CREATE INDEX idx_prod_status ON products(household_id, status);
CREATE INDEX idx_prod_added ON products(household_id, date_added DESC);
CREATE INDEX idx_prod_name_trgm ON products USING gin (name gin_trgm_ops);

-- ============================================
-- PRODUCT RELATIONSHIPS
-- ============================================
CREATE TABLE product_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  product_a UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  product_b UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  relationship_type relationship_type NOT NULL,
  group_name TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_rel_a ON product_relationships(product_a);
CREATE INDEX idx_rel_b ON product_relationships(product_b);
CREATE INDEX idx_rel_household ON product_relationships(household_id);

-- ============================================
-- IMPORTED EMAILS TRACKING
-- ============================================
CREATE TABLE imported_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(household_id, gmail_message_id)
);

CREATE INDEX idx_ie_household ON imported_emails(household_id);

-- ============================================
-- TRIGGERS
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER households_updated_at
  BEFORE UPDATE ON households
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- HELPER: Get user's household IDs
-- ============================================
CREATE OR REPLACE FUNCTION user_household_ids()
RETURNS SETOF UUID AS $$
  SELECT household_id FROM household_members WHERE user_id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE imported_emails ENABLE ROW LEVEL SECURITY;

-- Households
CREATE POLICY "Users can view own households"
  ON households FOR SELECT
  USING (id IN (SELECT user_household_ids()));

CREATE POLICY "Users can update own households"
  ON households FOR UPDATE
  USING (id IN (SELECT user_household_ids()));

CREATE POLICY "Authenticated users can create households"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Household Members
CREATE POLICY "Members can view co-members"
  ON household_members FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Users can insert themselves"
  ON household_members FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Owners can manage members"
  ON household_members FOR DELETE
  USING (
    household_id IN (
      SELECT household_id FROM household_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Categories
CREATE POLICY "Household members can view categories"
  ON categories FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can insert categories"
  ON categories FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can update categories"
  ON categories FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can delete categories"
  ON categories FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Subcategories
CREATE POLICY "Household members can view subcategories"
  ON subcategories FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can insert subcategories"
  ON subcategories FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can update subcategories"
  ON subcategories FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can delete subcategories"
  ON subcategories FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Products
CREATE POLICY "Household members can view products"
  ON products FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can insert products"
  ON products FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can update products"
  ON products FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can delete products"
  ON products FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Product Relationships
CREATE POLICY "Household members can view relationships"
  ON product_relationships FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can insert relationships"
  ON product_relationships FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can delete relationships"
  ON product_relationships FOR DELETE
  USING (household_id IN (SELECT user_household_ids()));

-- Imported Emails
CREATE POLICY "Household members can view imported emails"
  ON imported_emails FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Household members can insert imported emails"
  ON imported_emails FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

-- ============================================
-- AUTO-CREATE HOUSEHOLD ON SIGNUP
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_household_id UUID;
BEGIN
  INSERT INTO households (name)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Household')
  RETURNING id INTO new_household_id;

  INSERT INTO household_members (household_id, user_id, role, display_name)
  VALUES (
    new_household_id,
    NEW.id,
    'owner',
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );

  -- Seed default taxonomy for the new household
  PERFORM seed_default_taxonomy(new_household_id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- SEED DEFAULT TAXONOMY
-- ============================================
CREATE OR REPLACE FUNCTION seed_default_taxonomy(p_household_id UUID)
RETURNS void AS $$
DECLARE
  cat_record RECORD;
  cat_id UUID;
  i INTEGER;
BEGIN
  FOR cat_record IN
    SELECT * FROM (VALUES
      (0, 'Tools', ARRAY['Hand Tools','Power Tools','Sockets & Ratchets','Wrenches','Pliers & Cutters','Measuring & Layout','Tool Storage','Fasteners & Hardware','Batteries & Chargers','Safety & PPE']),
      (1, 'Firearms & Weapons', ARRAY['Rifles','Shotguns','Pistols','Suppressors & NFA','Optics & Sights','Parts & Upgrades','Magazines','Ammunition','Holsters & Cases','Cleaning & Maintenance','Lights & Lasers','Training & Targets']),
      (2, 'Clothing', ARRAY['Tops','Bottoms','Outerwear','Activewear','Tactical & Workwear','Underwear & Base Layers','Sleepwear','Formalwear','Jewelry & Watches','Accessories']),
      (3, 'Shoes & Footwear', ARRAY['Sneakers','Boots','Sandals','Athletic & Cycling','Dress Shoes','Slippers']),
      (4, 'Fitness & Sport', ARRAY['Gym Equipment','Weights & Bars','Racks & Rigs','Accessories','Cycling','Tennis','Outdoor & Camping','Recovery']),
      (5, 'Electronics', ARRAY['Computers & Monitors','Audio & Speakers','Phones & Tablets','Cables & Chargers','Smart Home','Photography & Cameras','Networking']),
      (6, 'Home & Furniture', ARRAY['Furniture','Lighting','Bedding','Kitchen','Bathroom','Storage & Organization','Decor','Appliances']),
      (7, 'Auto & Moto', ARRAY['Car Parts & Maintenance','Motorcycle Parts','Motorcycle Gear','Jacks & Stands','Detailing & Cleaning']),
      (8, 'Beauty & Grooming', ARRAY['Skincare','Haircare','Makeup & Cosmetics','Fragrance','Shaving & Grooming','Tools & Applicators']),
      (9, 'Health & Medical', ARRAY['Supplements','First Aid & Medical','Personal Care','Vision & Dental']),
      (10, 'Kids & Baby', ARRAY['Clothing','Toys','Gear & Equipment','Nursery','Feeding','Bath & Care']),
      (11, 'Outdoor & Recreation', ARRAY['Camping & Hiking','Hunting','Fishing','Coolers & Bags','Knives & Multi-tools','Optics']),
      (12, 'Media & Entertainment', ARRAY['Vinyl & Music','Books','Games','Streaming & Subscriptions']),
      (13, 'Consumables & Supplies', ARRAY['Cleaning Supplies','Office Supplies','Tape & Adhesives','Pet Supplies','Groceries','Household Chemicals']),
      (14, 'Services & Digital', ARRAY['Software','Subscriptions','Professional Services','Insurance','Memberships','Domain Names'])
    ) AS t(sort_order, cat_name, subs)
  LOOP
    INSERT INTO categories (household_id, name, sort_order, is_default)
    VALUES (p_household_id, cat_record.cat_name, cat_record.sort_order, true)
    RETURNING id INTO cat_id;

    FOR i IN 1..array_length(cat_record.subs, 1) LOOP
      INSERT INTO subcategories (category_id, household_id, name, sort_order, is_default)
      VALUES (cat_id, p_household_id, cat_record.subs[i], i - 1, true);
    END LOOP;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
