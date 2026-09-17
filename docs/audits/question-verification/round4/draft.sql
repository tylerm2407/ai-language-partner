-- Generated from the frozen question audit; NOT deployed by this audit.
-- Exact IDs and old field values guard against overwriting concurrent edits.
-- Category guards also protect the meaning and course of reassigned units.
-- One atomic block: any mismatch rolls back every change. Already-applied rows are safe.
DO $question_audit$
DECLARE
  plan jsonb := $question_audit_payload${"context_guards":[],"patches":[{"table":"cards","id":"aabbccdd-8888-3003-c004-b10000000000","before":{"course_id":"aabbccdd-8888-0000-0000-b10000000000","unit_id":"aabbccdd-8888-3003-0000-b10000000000","language":"zh","cefr_level":"B1","native_text":"Reservation"},"after":{"native_text":"Appointment"}},{"table":"exercises","id":"6c2af6a8-0d18-4aae-ba5b-e78c795aacbe","before":{"lesson_id":"aabbccdd-8888-3003-0004-b10000000000","type":"listening_choice","correct_answer":"Reservation","options":["Tourist","Reservation","Flight","Guide"]},"after":{"correct_answer":"Appointment","options":["Tourist","Appointment","Flight","Guide"]}},{"table":"exercises","id":"aabbccdd-8888-2002-0003-e00000000003","before":{"lesson_id":"aabbccdd-8888-2002-0003-a20000000000","type":"translate_to_native","accepted_answers":["Reservation"]},"after":{"accepted_answers":[]}},{"table":"exercises","id":"aabbccdd-8888-3003-0002-e00000000003","before":{"lesson_id":"aabbccdd-8888-3003-0002-b10000000000","type":"translate_to_native","correct_answer":"Reservation","accepted_answers":["Appointment","Booking"]},"after":{"correct_answer":"Appointment","accepted_answers":[]}},{"table":"exercises","id":"aabbccdd-8888-3003-0003-e00000000002","before":{"lesson_id":"aabbccdd-8888-3003-0003-b10000000000","type":"translate_to_target","correct_answer":"预约","accepted_answers":["预订"]},"after":{"correct_answer":"预订","accepted_answers":[]}},{"table":"exercises","id":"aabbccdd-8888-3003-0004-e00000000001","before":{"lesson_id":"aabbccdd-8888-3003-0004-b10000000000","type":"multiple_choice","correct_answer":"Reservation","options":["Passport","Adventure","Delay","Reservation"]},"after":{"correct_answer":"Appointment","options":["Passport","Adventure","Delay","Appointment"]}}]}$question_audit_payload$::jsonb;
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
