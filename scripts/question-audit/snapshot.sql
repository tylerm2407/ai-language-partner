-- One statement: all shared curriculum comes from the same database snapshot.
-- Run ONLY through Supabase's /database/query/read-only endpoint.
-- Deliberately excludes learner-owned cards, goal tracks, submissions and users.
WITH audit_courses AS (
  SELECT c.* FROM public.courses c WHERE c.goal_key IS NULL
), audit_units AS (
  SELECT u.* FROM public.units u JOIN audit_courses c ON c.id = u.course_id
), audit_lessons AS (
  SELECT l.* FROM public.lessons l JOIN audit_units u ON u.id = l.unit_id
), audit_passages AS (
  SELECT p.* FROM public.reading_passages p JOIN audit_courses c ON c.id = p.course_id
)
SELECT jsonb_build_object(
  'captured_at', current_timestamp,
  'courses', (SELECT coalesce(jsonb_agg(c ORDER BY c.id), '[]') FROM audit_courses c),
  'units', (SELECT coalesce(jsonb_agg(u ORDER BY u.id), '[]') FROM audit_units u),
  'lessons', (SELECT coalesce(jsonb_agg(l ORDER BY l.id), '[]') FROM audit_lessons l),
  'exercises', (SELECT coalesce(jsonb_agg(e ORDER BY e.id), '[]')
    FROM public.exercises e JOIN audit_lessons l ON l.id = e.lesson_id),
  'cards', (SELECT coalesce(jsonb_agg(c ORDER BY c.id), '[]')
    FROM public.cards c JOIN audit_courses ac ON ac.id = c.course_id WHERE c.user_id IS NULL),
  'writing_prompts', (SELECT coalesce(jsonb_agg(w ORDER BY w.id), '[]')
    FROM public.writing_prompts w JOIN audit_courses c ON c.id = w.course_id),
  'reading_passages', (SELECT coalesce(jsonb_agg(p ORDER BY p.id), '[]') FROM audit_passages p),
  'reading_questions', (SELECT coalesce(jsonb_agg(q ORDER BY q.id), '[]')
    FROM public.reading_questions q JOIN audit_passages p ON p.id = q.passage_id),
  'grammar_rules', (SELECT coalesce(jsonb_agg(g ORDER BY g.id), '[]') FROM public.grammar_rules g),
  'checkpoint_items', (SELECT coalesce(jsonb_agg(i ORDER BY i.id), '[]') FROM public.checkpoint_items i)
) AS curriculum;
