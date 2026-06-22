-- 040: Remove the @bryant.edu signup restriction for consumer launch.
--
-- enforce_bryant_email_trigger on auth.users rejected EVERY signup whose
-- email was not @bryant.edu, which makes a public consumer launch
-- impossible (nobody can create an account). School/pilot email gating,
-- if ever needed, belongs at the org level via
-- organizations.contract_config.allowed_email_domains (already supported
-- in the school edge function), not a global auth trigger.
--
-- Applied to prod 2026-06-22 via Supabase MCP.

DROP TRIGGER IF EXISTS enforce_bryant_email_trigger ON auth.users;
DROP FUNCTION IF EXISTS public.enforce_bryant_email();
