-- Household invite codes for member management
CREATE TABLE IF NOT EXISTS household_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
  invite_code TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(6), 'hex'),
  created_by UUID NOT NULL REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '7 days',
  used_by UUID REFERENCES auth.users(id),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE household_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view own household invites"
  ON household_invites FOR SELECT
  USING (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Members can create invites"
  ON household_invites FOR INSERT
  WITH CHECK (household_id IN (SELECT user_household_ids()));

CREATE POLICY "Members can update invites"
  ON household_invites FOR UPDATE
  USING (household_id IN (SELECT user_household_ids()));
