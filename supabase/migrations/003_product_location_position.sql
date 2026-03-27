-- Add shelf position fields to product_locations
-- depth_row: front/back row on the shelf (matches bin depth_row concept)
-- col_index: 0-based column index computed from bin layout
ALTER TABLE product_locations
  ADD COLUMN depth_row TEXT DEFAULT 'front',
  ADD COLUMN col_index INTEGER;
