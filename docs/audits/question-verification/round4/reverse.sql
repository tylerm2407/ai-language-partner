-- Rollback for the frozen question audit content patch. NOT part of the deploy.
-- Restores every audited field to its pre-patch value and removes the authored rows.
-- Guarded in both directions: a row edited since the patch landed aborts the block
-- instead of being reverted, so this can never silently discard someone else's work.
-- One atomic block. Safe to re-run, and safe over a partially applied patch.
DO $question_audit$
DECLARE
  plan jsonb := $question_audit_payload${"context_guards":[],"patches":[{"table":"cards","id":"aabbccdd-8888-3003-c004-b10000000000","before":{"native_text":"Appointment"},"after":{"native_text":"Reservation"}},{"table":"exercises","id":"6c2af6a8-0d18-4aae-ba5b-e78c795aacbe","before":{"correct_answer":"Appointment","options":["Tourist","Appointment","Flight","Guide"]},"after":{"correct_answer":"Reservation","options":["Tourist","Reservation","Flight","Guide"]}},{"table":"exercises","id":"aabbccdd-8888-2002-0003-e00000000003","before":{"accepted_answers":[]},"after":{"accepted_answers":["Reservation"]}},{"table":"exercises","id":"aabbccdd-8888-3003-0002-e00000000003","before":{"correct_answer":"Appointment","accepted_answers":[]},"after":{"correct_answer":"Reservation","accepted_answers":["Appointment","Booking"]}},{"table":"exercises","id":"aabbccdd-8888-3003-0003-e00000000002","before":{"correct_answer":"预订","accepted_answers":[]},"after":{"correct_answer":"预约","accepted_answers":["预订"]}},{"table":"exercises","id":"aabbccdd-8888-3003-0004-e00000000001","before":{"correct_answer":"Appointment","options":["Passport","Adventure","Delay","Appointment"]},"after":{"correct_answer":"Reservation","options":["Passport","Adventure","Delay","Reservation"]}}]}$question_audit_payload$::jsonb;
  patch jsonb; guard jsonb; current_row jsonb; assignments text; changed integer;
BEGIN
  FOR guard IN SELECT value FROM jsonb_array_elements(plan->'context_guards') LOOP
    IF guard->>'table' <> 'units' THEN RAISE EXCEPTION 'Out-of-scope question audit context'; END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR SHARE', guard->>'table') INTO current_row USING guard->>'id';
    IF current_row IS NULL OR EXISTS (SELECT 1 FROM jsonb_each(guard->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN
      RAISE EXCEPTION 'Audited category changed; review before reverting: %/%', guard->>'table', guard->>'id';
    END IF;
  END LOOP;
  FOR patch IN SELECT value FROM jsonb_array_elements(plan->'patches') LOOP
    IF NOT (patch->>'table' = ANY(ARRAY['courses','units','lessons','exercises','cards','grammar_rules','writing_prompts','reading_passages','reading_questions','checkpoint_items'])) THEN
      RAISE EXCEPTION 'Out-of-scope question audit table';
    END IF;
    EXECUTE format('SELECT to_jsonb(t) FROM public.%I t WHERE id = $1::uuid FOR UPDATE', patch->>'table') INTO current_row USING patch->>'id';
    IF current_row IS NULL THEN RAISE EXCEPTION 'Missing audited row %/%', patch->>'table', patch->>'id'; END IF;
    IF NOT EXISTS (SELECT 1 FROM jsonb_each(patch->'after') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN CONTINUE; END IF;
    IF EXISTS (SELECT 1 FROM jsonb_each(patch->'before') field WHERE current_row->field.key IS DISTINCT FROM field.value) THEN RAISE EXCEPTION 'Audited row changed; review before reverting: %/%', patch->>'table', patch->>'id'; END IF;
    SELECT string_agg(format('%I = (jsonb_populate_record(NULL::public.%I, $1)).%I', key, patch->>'table', key), ', ' ORDER BY key) INTO assignments FROM jsonb_object_keys(patch->'after') key;
    EXECUTE format('UPDATE public.%I SET %s WHERE id = $2::uuid', patch->>'table', assignments) USING patch->'after', patch->>'id';
    GET DIAGNOSTICS changed = ROW_COUNT;
    IF changed <> 1 THEN RAISE EXCEPTION 'Unexpected affected-row count: %', changed; END IF;
  END LOOP;
END
$question_audit$;
