/**
 * Tests for applyOnboardingDraft (lib/supabase-queries.ts).
 *
 * What is worth pinning: the draft reaches the RPC as ONE call with every
 * field mapped to its `p_` parameter, nulls preserved rather than dropped
 * (null is "no course" / "no name", and the function treats an absent key
 * the same as an explicit null only because the client sends it explicitly),
 * and a returned row is mapped through the same `mapProfile` as every other
 * profile read, so the store gets the shape it already understands.
 */
import { applyOnboardingDraft } from './supabase-queries';

const mockRpc = jest.fn();

jest.mock('./supabase', () => ({
  supabase: {
    rpc: (...a: unknown[]) => mockRpc(...a),
  },
}));

const DRAFT = {
  targetLanguage: 'es' as const,
  level: 'beginner' as const,
  dailyGoalMinutes: 10,
  idealL2Self: 'Ordering coffee in Madrid.',
  displayName: 'Tyler',
  avatarPresetId: 'fox-01',
  currentCourseId: '11111111-1111-1111-1111-111111111111',
  placementBand: 'A1',
  firstLesson: true,
};

function profileRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    user_id: 'u1',
    display_name: 'Tyler',
    native_language: 'en',
    target_language: 'es',
    level: 'beginner',
    daily_goal_minutes: 10,
    total_xp: 0,
    timezone: 'America/New_York',
    onboarding_completed: true,
    xp_level: 1,
    league_tier: 'bronze',
    avatar_kind: 'preset',
    avatar_preset_id: 'fox-01',
    avatar_image_path: null,
    onboarding_checklist: {
      chooseLanguage: true,
      firstLesson: true,
      aiConversation: false,
      dailyReminder: false,
      skipped: [],
      dismissed: false,
      completedAt: null,
      celebratedAt: null,
    },
    motivation_reason: null,
    ideal_l2_self: 'Ordering coffee in Madrid.',
    current_course_id: '11111111-1111-1111-1111-111111111111',
    placement_band: 'A1',
    created_at: '2026-09-13T00:00:00Z',
    updated_at: '2026-09-13T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  mockRpc.mockReset();
});

describe('applyOnboardingDraft', () => {
  it('sends the whole draft as one RPC call with every field mapped', async () => {
    mockRpc.mockResolvedValue({ data: profileRow(), error: null });

    await applyOnboardingDraft(DRAFT);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    expect(mockRpc).toHaveBeenCalledWith('apply_onboarding_draft', {
      p_target_language: 'es',
      p_level: 'beginner',
      p_daily_goal_minutes: 10,
      p_ideal_l2_self: 'Ordering coffee in Madrid.',
      p_display_name: 'Tyler',
      p_avatar_preset_id: 'fox-01',
      p_current_course_id: '11111111-1111-1111-1111-111111111111',
      p_placement_band: 'A1',
      p_first_lesson: true,
    });
  });

  it('keeps nulls explicit — no course, no name, no preset are real answers', async () => {
    mockRpc.mockResolvedValue({
      data: profileRow({
        display_name: '',
        avatar_kind: 'procedural',
        avatar_preset_id: null,
        current_course_id: null,
        placement_band: 'C1',
        ideal_l2_self: null,
      }),
      error: null,
    });

    await applyOnboardingDraft({
      ...DRAFT,
      idealL2Self: null,
      displayName: null,
      avatarPresetId: null,
      currentCourseId: null,
      placementBand: 'C1',
      firstLesson: false,
    });

    const [, params] = mockRpc.mock.calls[0] as [string, Record<string, unknown>];
    expect(params).toMatchObject({
      p_ideal_l2_self: null,
      p_display_name: null,
      p_avatar_preset_id: null,
      p_current_course_id: null,
      p_placement_band: 'C1',
      p_first_lesson: false,
    });
    expect(Object.keys(params)).toHaveLength(9);
  });

  it('maps the returned row through the shared profile mapper', async () => {
    mockRpc.mockResolvedValue({ data: profileRow(), error: null });

    const profile = await applyOnboardingDraft(DRAFT);

    expect(profile).toMatchObject({
      userId: 'u1',
      targetLanguage: 'es',
      level: 'beginner',
      onboardingCompleted: true,
      avatarKind: 'preset',
      avatarPresetId: 'fox-01',
      currentCourseId: '11111111-1111-1111-1111-111111111111',
      placementBand: 'A1',
      idealL2Self: 'Ordering coffee in Madrid.',
    });
    expect(profile.onboardingChecklist.firstLesson).toBe(true);
    expect(profile.onboardingChecklist.chooseLanguage).toBe(true);
  });

  it('throws the RPC error instead of returning a half-profile', async () => {
    const err = { message: 'invalid target_language', code: '22023' };
    mockRpc.mockResolvedValue({ data: null, error: err });

    await expect(applyOnboardingDraft(DRAFT)).rejects.toBe(err);
  });

  it('throws when the RPC returns no row', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });

    await expect(applyOnboardingDraft(DRAFT)).rejects.toThrow(/no row/);
  });
});
