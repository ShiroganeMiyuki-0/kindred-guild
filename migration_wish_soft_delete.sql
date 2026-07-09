-- Migration: Add soft delete for wishes
-- Date: 2026-07-09

-- Ensure wishes table has soft delete columns
ALTER TABLE wishes
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_wishes_is_deleted ON wishes(is_deleted);

-- Function to soft delete a wish (only by creator)
CREATE OR REPLACE FUNCTION soft_delete_wish(p_wish_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_user_id UUID;
  v_wish RECORD;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  SELECT * INTO v_wish FROM wishes WHERE id = p_wish_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wish not found.';
  END IF;

  -- Only creator can delete
  IF v_wish.creator_id != v_user_id THEN
    RAISE EXCEPTION 'Only the wish creator can delete this wish.';
  END IF;

  -- Already deleted?
  IF v_wish.is_deleted = TRUE THEN
    RAISE EXCEPTION 'This wish has already been deleted.';
  END IF;

  -- Refund any coin backing to the creator
  IF v_wish.wish_type = 'coins' AND v_wish.coin_amount IS NOT NULL AND v_wish.coin_amount > 0 THEN
    INSERT INTO fairy_ledger (user_id, amount, reason, quest_id)
    VALUES (v_user_id, v_wish.coin_amount, 'wish_refund', NULL);
  END IF;

  -- Soft delete
  UPDATE wishes
  SET is_deleted = TRUE, deleted_at = NOW()
  WHERE id = p_wish_id;

  -- Remove all votes for this wish
  DELETE FROM wish_votes WHERE wish_id = p_wish_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the load query in fairy-wishes.html to filter out deleted wishes
-- (handled in the JS code below, no SQL change needed for SELECT)
