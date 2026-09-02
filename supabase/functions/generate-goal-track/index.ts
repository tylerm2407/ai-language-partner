// Supabase Edge Function: Generate Goal Track
//
// Turns the onboarding "picture a moment you'd love to have in this language"
// answer into a real 6-lesson unit in Learn.
//
// Two actions:
//   resolve — map the learner's free text to a canonical goal key, then find
//             or build the shared track for it and enrol them.
//   lesson  — materialise one lesson's exercises the first time anyone opens it.
//
// The cost control is reuse. `_shared/goal-taxonomy.ts` maps free text onto a
// closed vocabulary, so two learners who want the same thing get the same key
// and the second one pays nothing. A near miss — same language, domain and
// register, most scenarios shared — reuses the existing track too. Only a
// genuine miss generates.
//
// Auth: deployed with verify_jwt: false; the body authenticates via
// _shared/auth.ts, matching translate and ai-chat.
//
// Deploy: npx supabase functions deploy generate-goal-track --project-ref <ref>

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders, corsResponse } from '../_shared/cors.ts';
import { getAuthenticatedUser } from '../_shared/auth.ts';
import { checkBurstLimit } from '../_shared/burst-limit.ts';
import { generateValidated } from '../_shared/validated-generate.ts';
import { isValidCefrLevel, isValidLanguage, isValidUUID, sanitizeText } from '../_shared/validation.ts';
import { PROVIDER_TIMEOUT_MS, providerFetch } from '../_shared/provider-fetch.ts';
import {
  REUSE_OVERLAP_THRESHOLD,
  goalKey,
  parseGoalShape,
  scenarioOverlap,
  type GoalShape,
} from '../_shared/goal-taxonomy.ts';
import type { CEFR } from '../_shared/level-checker.ts';
import {
  EXERCISES_PER_LESSON,
  MAX_GOAL_CHARS,
  MIN_USABLE_EXERCISES,
  buildExercisePrompt,
  buildMapperPrompt,
  buildPlannerPrompt,
  extractJson,
  parseExercises,
  parseUnitPlan,
} from './goal-core.ts';

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const TEXT_MODEL = 'claude-haiku-4-5-20251001';

/** Goal tracks are a paid feature (basic and up). */
const ENTITLED_TIERS = new Set(['basic', 'premium', 'vip']);

/** Generating a track is minutes of model time; nobody needs to ask twice a
 *  minute, and a loop here is expensive in a way a translate loop is not. */
const BURST_MAX = 4;
const BURST_WINDOW_SECONDS = 300;

interface ResolveRequest {
  action: 'resolve';
  goalText?: string;
  language: string;
  cefrLevel: string;
  nativeLanguage: string;
}
interface LessonRequest {
  action: 'lesson';
  lessonId: string;
  nativeLanguage: string;
}
type GoalRequest = ResolveRequest | LessonRequest;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * One Haiku call returning parsed JSON, safety-validated.
 *
 * The two failure modes are kept apart on purpose. `unavailable` means the
 * model did not answer — an outage, a timeout, a dead key — and is OUR problem;
 * `null` data means it answered with something unusable, which may be the
 * learner's goal being too vague to map. Collapsing them tells a learner to
 * "describe the moment more concretely" when the truth is that our API key
 * expired, which sends them off rewriting a goal that was fine.
 */
type JsonAnswer =
  | { ok: true; data: unknown }
  | { ok: false; reason: 'unavailable' };

async function askForJson(
  fn: string,
  systemPrompt: string,
  userMessage: string,
  maxTokens: number,
  language: string,
  targetLevel?: string,
): Promise<JsonAnswer> {
  const result = await generateValidated({
    fn,
    targetLevel: targetLevel as CEFR | undefined,
    language,
    safetyRetries: 1,
    skipLevelCheck: true,
    fallback: () => Promise.resolve(''),
    generate: async () => {
      const response = await providerFetch(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': ANTHROPIC_API_KEY!,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: TEXT_MODEL,
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: 'user', content: userMessage }],
          }),
        },
        { provider: 'anthropic', timeoutMs: PROVIDER_TIMEOUT_MS.textLong },
      );
      if (!response.ok) {
        throw new Error(`Anthropic API error: ${response.status} - ${await response.text()}`);
      }
      const data = await response.json();
      const out = (data.content?.[0]?.text ?? '').trim();
      if (!out) throw new Error('Empty completion');
      return out;
    },
  });

  if (result.usedFallback || !result.text) return { ok: false, reason: 'unavailable' };
  return { ok: true, data: extractJson(result.text) };
}

/**
 * Find an existing track for this goal.
 *
 * Exact key first — that is the free path and the common one. Failing that,
 * look for a track in the same language, domain and register whose scenarios
 * mostly overlap; someone who wants {restaurant, cafe_bar, small_talk} is well
 * served by a track built for {restaurant, cafe_bar, shopping}, and building a
 * near-duplicate is the cost this whole design exists to avoid.
 */
async function findReusableTrack(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  language: string,
  shape: GoalShape,
  key: string,
): Promise<{ id: string; goal_key: string } | null> {
  const { data: exact } = await supabase
    .from('courses')
    .select('id, goal_key')
    .eq('goal_key', key)
    .maybeSingle();
  if (exact) return exact;

  // Same language + domain + register, any scenarios. The prefix and suffix of
  // the key carry exactly those, so this is a cheap LIKE rather than a join.
  const { data: candidates } = await supabase
    .from('courses')
    .select('id, goal_key')
    .like('goal_key', `${language}:${shape.domain}:%:${shape.register}`)
    .limit(20);

  let best: { id: string; goal_key: string } | null = null;
  let bestOverlap = 0;
  for (const c of candidates ?? []) {
    const parts = String(c.goal_key).split(':');
    if (parts.length !== 4) continue;
    const overlap = scenarioOverlap(shape.scenarios, parts[2].split('+'));
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      best = c;
    }
  }
  return bestOverlap >= REUSE_OVERLAP_THRESHOLD ? best : null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const authUser = await getAuthenticatedUser(req);
  if (!authUser) return json({ error: 'Unauthorized' }, 401);
  if (!ANTHROPIC_API_KEY) return json({ error: 'ANTHROPIC_API_KEY not configured' }, 500);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const burstOk = await checkBurstLimit(
    supabase,
    authUser.userId,
    'generate-goal-track',
    BURST_MAX,
    BURST_WINDOW_SECONDS,
  );
  if (!burstOk) {
    return json({ error: 'Too many requests. Please slow down.', code: 'RATE_LIMITED' }, 429);
  }

  let body: GoalRequest;
  try {
    body = (await req.json()) as GoalRequest;
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  // Paid feature. Checked before anything is generated, and before the free
  // text is even looked at.
  const { data: sub } = await supabase
    .from('subscriptions')
    .select('tier, is_active, current_period_end')
    .eq('user_id', authUser.userId)
    .eq('is_active', true)
    .maybeSingle();
  const tier = sub?.tier ?? 'starter';
  const expired = sub?.current_period_end
    ? new Date(sub.current_period_end as string).getTime() < Date.now()
    : false;
  if (!ENTITLED_TIERS.has(tier) || expired) {
    return json(
      { error: 'Goal tracks are part of a paid plan.', code: 'UPGRADE_REQUIRED' },
      403,
    );
  }

  if (body.action === 'lesson') return handleLesson(supabase, body);
  if (body.action === 'resolve') return handleResolve(supabase, authUser.userId, body);
  return json({ error: 'Unknown action' }, 400);
});

async function handleResolve(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  body: ResolveRequest,
): Promise<Response> {
  const { language, cefrLevel, nativeLanguage } = body;
  // These three interpolate into system prompts and into the goal key, so they
  // are allow-listed rather than trusted — the rule translate/index.ts spells
  // out for its language names.
  if (!isValidLanguage(language) || !isValidLanguage(nativeLanguage) || !isValidCefrLevel(cefrLevel)) {
    return json({ error: 'Invalid request' }, 400);
  }

  // Prefer the stored profile answer over anything the client sends: it is the
  // same text either way, and reading it here means a client cannot mint a
  // track for a goal the learner never wrote.
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('ideal_l2_self')
    .eq('user_id', userId)
    .maybeSingle();

  const rawGoal = (profile?.ideal_l2_self as string | null) ?? body.goalText ?? '';
  const goalText = sanitizeText(String(rawGoal), MAX_GOAL_CHARS);
  if (goalText.length < 8) {
    return json({ error: 'No goal to build from.', code: 'NO_GOAL' }, 400);
  }

  // ── Map free text to the closed vocabulary ─────────────────────────────
  const mapped = await askForJson(
    'goal-mapper',
    buildMapperPrompt(language),
    goalText,
    200,
    nativeLanguage,
  );
  if (!mapped.ok) {
    return json(
      { error: 'Building your track is unavailable right now. Please try again.', code: 'GOAL_TRACK_UNAVAILABLE' },
      503,
    );
  }
  const shape = parseGoalShape(mapped.data);
  if (!shape) {
    return json(
      { error: "We couldn't turn that into a track. Try describing the moment more concretely.", code: 'UNMAPPABLE_GOAL' },
      422,
    );
  }
  const key = goalKey(language, shape);

  // ── Reuse if we can ────────────────────────────────────────────────────
  const existing = await findReusableTrack(supabase, language, shape, key);
  if (existing) {
    await enrol(supabase, userId, existing.id, existing.goal_key, shape, goalText);
    return json({ courseId: existing.id, goalKey: existing.goal_key, generated: false });
  }

  // ── Build it ───────────────────────────────────────────────────────────
  const planned = await askForJson(
    'goal-planner',
    buildPlannerPrompt(language, cefrLevel, shape),
    goalText,
    1500,
    nativeLanguage,
    cefrLevel,
  );
  if (!planned.ok) {
    return json(
      { error: 'Building your track is unavailable right now. Please try again.', code: 'GOAL_TRACK_UNAVAILABLE' },
      503,
    );
  }
  const plan = parseUnitPlan(planned.data);
  if (!plan) {
    return json(
      { error: 'Building your track failed. Please try again.', code: 'PLAN_FAILED' },
      502,
    );
  }

  const { data: course, error: courseError } = await supabase
    .from('courses')
    .insert({
      source_language: nativeLanguage,
      target_language: language,
      title: plan.title,
      description: plan.description,
      cefr_level: cefrLevel,
      total_units: 1,
      is_published: true,
      goal_key: key,
    })
    .select('id, goal_key')
    .single();

  if (courseError) {
    // Another learner with the same goal won the race. Theirs is as good as
    // ours would have been — the whole point is that the track is shared.
    const { data: raced } = await supabase
      .from('courses')
      .select('id, goal_key')
      .eq('goal_key', key)
      .maybeSingle();
    if (raced) {
      await enrol(supabase, userId, raced.id, raced.goal_key, shape, goalText);
      return json({ courseId: raced.id, goalKey: raced.goal_key, generated: false });
    }
    console.error('[goal-track] course insert failed:', courseError.message);
    return json({ error: 'Building your track failed. Please try again.', code: 'PLAN_FAILED' }, 502);
  }

  const { data: unit, error: unitError } = await supabase
    .from('units')
    .insert({
      course_id: course.id,
      title: plan.title,
      description: plan.description,
      order_index: 0,
      total_lessons: plan.lessons.length,
    })
    .select('id')
    .single();
  if (unitError) {
    console.error('[goal-track] unit insert failed:', unitError.message);
    return json({ error: 'Building your track failed. Please try again.', code: 'PLAN_FAILED' }, 502);
  }

  // Lesson SHELLS. Exercises are generated the first time someone opens each
  // lesson — six lessons of exercises is more model time than one request has,
  // and most learners never reach lesson six.
  const { error: lessonsError } = await supabase.from('lessons').insert(
    plan.lessons.map((l, i) => ({
      unit_id: unit.id,
      title: l.title,
      description: l.description,
      order_index: i,
      estimated_minutes: 5,
      xp_reward: 20,
      generation_state: 'pending',
    })),
  );
  if (lessonsError) {
    console.error('[goal-track] lesson insert failed:', lessonsError.message);
    return json({ error: 'Building your track failed. Please try again.', code: 'PLAN_FAILED' }, 502);
  }

  await enrol(supabase, userId, course.id, key, shape, goalText);
  return json({ courseId: course.id, goalKey: key, generated: true });
}

async function enrol(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  userId: string,
  courseId: string,
  key: string,
  shape: GoalShape,
  goalText: string,
): Promise<void> {
  const { error } = await supabase.from('user_goal_tracks').upsert(
    {
      user_id: userId,
      course_id: courseId,
      goal_key: key,
      scenarios: shape.scenarios,
      source_text: goalText,
    },
    { onConflict: 'user_id,goal_key' },
  );
  if (error) console.error('[goal-track] enrol failed:', error.message);
}

async function handleLesson(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  body: LessonRequest,
): Promise<Response> {
  if (!isValidUUID(body.lessonId) || !isValidLanguage(body.nativeLanguage)) {
    return json({ error: 'Invalid request' }, 400);
  }

  const { data: lesson } = await supabase
    .from('lessons')
    .select('id, title, description, generation_state, unit_id, units(course_id, courses(target_language, cefr_level, goal_key))')
    .eq('id', body.lessonId)
    .maybeSingle();

  if (!lesson) return json({ error: 'Lesson not found' }, 404);
  if (lesson.generation_state === 'ready' || lesson.generation_state === null) {
    return json({ ready: true, generated: false });
  }

  const course = lesson.units?.courses;
  if (!course?.goal_key) {
    // Only goal-track lessons are generated. A pending state anywhere else is
    // a bug, and filling it in would hide that.
    return json({ error: 'Lesson not found' }, 404);
  }

  // Claim it, so two learners opening lesson 3 at once do not both pay.
  const { data: claimed } = await supabase
    .from('lessons')
    .update({ generation_state: 'generating' })
    .eq('id', lesson.id)
    .eq('generation_state', 'pending')
    .select('id')
    .maybeSingle();
  if (!claimed) return json({ ready: false, generating: true }, 202);

  const generated = await askForJson(
    'goal-lesson',
    buildExercisePrompt(
      course.target_language,
      body.nativeLanguage,
      course.cefr_level ?? 'A2',
      lesson.title,
      lesson.description,
    ),
    `${lesson.title}\n${lesson.description}`,
    3000,
    course.target_language,
    course.cefr_level ?? undefined,
  );

  if (!generated.ok) {
    // Hand the claim back before returning, or the lesson stays 'generating'
    // forever and nobody can retry it.
    await supabase.from('lessons').update({ generation_state: 'pending' }).eq('id', lesson.id);
    return json(
      { error: 'Preparing this lesson is unavailable right now. Please try again.', code: 'GOAL_TRACK_UNAVAILABLE' },
      503,
    );
  }
  const exercises = parseExercises(generated.data);
  if (exercises.length < MIN_USABLE_EXERCISES) {
    // Hand the claim back so the next learner can retry, rather than leaving
    // the lesson stuck in 'generating' forever.
    await supabase.from('lessons').update({ generation_state: 'pending' }).eq('id', lesson.id);
    return json({ error: 'Building this lesson failed. Please try again.', code: 'LESSON_FAILED' }, 502);
  }

  const { error: exError } = await supabase.from('exercises').insert(
    exercises.slice(0, EXERCISES_PER_LESSON).map((e, i) => ({
      lesson_id: lesson.id,
      type: e.type,
      order_index: i,
      prompt: e.prompt,
      correct_answer: e.correctAnswer,
      accepted_answers: e.acceptedAnswers,
      options: e.options,
      explanation: e.explanation,
      metadata: {},
      source_type: 'goal_track',
    })),
  );
  if (exError) {
    await supabase.from('lessons').update({ generation_state: 'pending' }).eq('id', lesson.id);
    console.error('[goal-track] exercise insert failed:', exError.message);
    return json({ error: 'Building this lesson failed. Please try again.', code: 'LESSON_FAILED' }, 502);
  }

  await supabase.from('lessons').update({ generation_state: 'ready' }).eq('id', lesson.id);
  return json({ ready: true, generated: true, exercises: exercises.length });
}
