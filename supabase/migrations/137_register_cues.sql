-- 137_register_cues.sql
--
-- Decision 2 of docs/audits/question-verification/round2-triage/needs-human.md,
-- ruled 2026-09-16: register variants on a cue that names no register are fixed
-- in the CUE, not in the grading.
--
-- Seven prompts gain an explicit register marker. Nothing else changes: no
-- accepted answer is added or withdrawn, so no grading behaviour moves and no
-- typo neighbourhood widens. After this, refusing おはよう for おはようございます
-- is honest — the item asked for the polite form and said so.
--
--   patches   7  (prompt copy only)
--   ruled on  2026-09-16
--   snapshot  sha256 prefix b982b1e00c0f
--
-- Rollback: docs/audits/question-verification/round3/register-cues/reverse.sql
-- (NOT applied). See 134 and 136 for rounds one and two.

-- Generated from the frozen question audit; NOT deployed by this audit.
-- Exact IDs and old field values guard against overwriting concurrent edits.
-- Category guards also protect the meaning and course of reassigned units.
-- One atomic block: any mismatch rolls back every change. Already-applied rows are safe.
DO $question_audit$
DECLARE
  plan jsonb := $question_audit_payload${"context_guards":[],"patches":[{"table":"exercises","id":"aabbccdd-6666-1001-0002-e00000000002","before":{"lesson_id":"aabbccdd-6666-1001-0002-000000000000","type":"translate_to_target","prompt":"Translate to Japanese: Good morning","correct_answer":"おはようございます","accepted_answers":[]},"after":{"prompt":"Translate to Japanese (polite): Good morning"}},{"table":"exercises","id":"aabbccdd-6666-1001-0004-e00000000002","before":{"lesson_id":"aabbccdd-6666-1001-0004-000000000000","type":"translate_to_target","prompt":"Translate to Japanese: Good night","correct_answer":"おやすみなさい","accepted_answers":[]},"after":{"prompt":"Translate to Japanese (polite): Good night"}},{"table":"exercises","id":"aabbccdd-7777-1001-0006-e00000000006","before":{"lesson_id":"aabbccdd-7777-1001-0006-000000000000","type":"translate_to_target","prompt":"Translate to Korean: No","correct_answer":"아니요","accepted_answers":["아닙니다"]},"after":{"prompt":"Translate to Korean (polite): No"}},{"table":"exercises","id":"aabbccdd-7777-2005-0001-e00000000008","before":{"lesson_id":"aabbccdd-7777-2005-0001-a20000000000","type":"translate_to_target","prompt":"Translate to Korean: I studied","correct_answer":"공부했어요","accepted_answers":["저는 공부했어요","공부했습니다"]},"after":{"prompt":"Translate to Korean (polite): I studied"}},{"table":"exercises","id":"aabbccdd-7777-2005-0002-e00000000002","before":{"lesson_id":"aabbccdd-7777-2005-0002-a20000000000","type":"translate_to_target","prompt":"Translate to Korean: I went","correct_answer":"갔어요","accepted_answers":["저는 갔어요","갔습니다"]},"after":{"prompt":"Translate to Korean (polite): I went"}},{"table":"exercises","id":"aabbccdd-7777-2005-0004-e00000000005","before":{"lesson_id":"aabbccdd-7777-2005-0004-a20000000000","type":"cloze_deletion","prompt":"Fill in the missing word: _____ means I studied","correct_answer":"공부했어요","accepted_answers":["공부했습니다"]},"after":{"prompt":"Fill in the missing word (polite form): _____ means I studied"}},{"table":"exercises","id":"aabbccdd-7777-2005-0005-e00000000005","before":{"lesson_id":"aabbccdd-7777-2005-0005-a20000000000","type":"cloze_deletion","prompt":"Fill in the missing word: _____ means I played","correct_answer":"놀았어요","accepted_answers":["놀았습니다"]},"after":{"prompt":"Fill in the missing word (polite form): _____ means I played"}}]}$question_audit_payload$::jsonb;
  patch jsonb; guard jsonb; current_row jsonb; assignments text; changed integer;
BEGIN
  FOR guard IN SELECT value FROM jsonb_array_elements(plan->'context_guards') LOOP
    IF guard->>'table' <> 'units' THEN RAISE EXCEPTION 'Out-of-scope question audit context'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR SHARE', guard->>'table') INTO current_row USING guard->>'id';
    IF current_row IS NULL OR EXISTS (SELECT 1 FROM jsonb_each(guard->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
      RAISE EXCEPTION 'Audited category changed; review before applying: %/%', guard->>'table', guard->>'id';
    END IF;
  END LOOP;
  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'patches') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY['courses','units','lessons','exercises','cards','grammar_rules','writing_prompts','reading_passages','reading_questions','checkpoint_items'])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NULL THEN RAISE EXCEPTION 'Missing audited row %/%', patch->>'table', patch->>'id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_each(patch->'after') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(patch->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN RAISE EXCEPTION 'Audited row changed; review before applying: %/%', patch->>'table', patch->>'id'; END IF;
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', key, patch->>'table', key), ', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch->'after') key;
    EXECUTE format('UPDATE public.%I SET %s WHERE id = $2::uuid', patch->>'table', assignments) USING patch->'after', patch->>'id';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected affected-row count: %', changed; END IF;
  END LOOP;
END
$question_audit$;
