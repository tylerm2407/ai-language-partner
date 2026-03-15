-- 009: Add gems increment function for quest rewards
-- ============================================================================

CREATE OR REPLACE FUNCTION public.add_gems(p_user_id UUID, p_amount INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.profiles
  SET gems = gems + p_amount
  WHERE id = p_user_id;
END;
$$;
