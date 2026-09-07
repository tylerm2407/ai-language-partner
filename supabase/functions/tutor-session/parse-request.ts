/**
 * Request validation for the three tutor-session actions.
 *
 * Split out of index.ts because that file calls `Deno.serve()` at module scope,
 * so importing it from a test would stand up an HTTP listener. That is the same
 * reason `prompt.ts`, `parse.ts` and `turn-accuracy.ts` were split out of
 * `ai-chat/index.ts` — and validation is exactly the kind of code that is all
 * edge cases and no happy path, so it is the last thing that should be
 * unreachable from a test.
 *
 * Everything here is pure. `index.ts` stays a thin serve + auth + dispatch shell.
 */
import { isValidLanguage } from '../_shared/validation.ts';
import type { StartRequest } from './start.ts';
import type { TurnRequest } from './turn.ts';
import type { EndRequest, TutorEndReason } from './end.ts';

export const VALID_LEVELS: ReadonlySet<string> = new Set([
  'beginner', 'elementary', 'intermediate', 'upper_intermediate', 'advanced',
]);

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; code: string };

function bad(error: string): ParseResult<never> {
  return { ok: false, error, code: 'BAD_REQUEST' };
}

export function parseStartRequest(body: Record<string, unknown>): ParseResult<StartRequest> {
  const targetLanguage = String(body.targetLanguage ?? '');
  if (!isValidLanguage(targetLanguage)) return bad('Unsupported language');

  const level = String(body.level ?? '');
  if (!VALID_LEVELS.has(level)) return bad('Unsupported level');

  const correctionMode = body.correctionMode;
  if (correctionMode !== 'as_you_go' && correctionMode !== 'let_me_talk') {
    return bad('Unknown correction mode');
  }

  const nativeRaw = String(body.nativeLanguage ?? 'en');

  return {
    ok: true,
    value: {
      targetLanguage,
      // Degrade rather than refuse. An unrecognised native language costs a
      // little clarity in the debrief; refusing would block the session outright
      // over a field that is only ever a hint.
      nativeLanguage: isValidLanguage(nativeRaw) ? nativeRaw : 'en',
      level,
      // An unknown scenario key is dropped rather than rejected: getScenario
      // returns null for it and the session degrades to free conversation,
      // which is a better outcome than a 400 the learner cannot act on.
      scenarioKey: typeof body.scenarioKey === 'string' ? body.scenarioKey : null,
      correctionMode,
      // Never trusted as a persona — resolvePersona re-validates against the
      // closed table, because this value ultimately selects a paid voice.
      personaId: typeof body.personaId === 'string' ? body.personaId : undefined,
      requestedMinutes:
        typeof body.requestedMinutes === 'number' && Number.isFinite(body.requestedMinutes)
          ? body.requestedMinutes
          : undefined,
    },
  };
}

export function parseTurnRequest(body: Record<string, unknown>): ParseResult<TurnRequest> {
  const sessionId = String(body.sessionId ?? '');
  if (!sessionId) return bad('sessionId is required');

  return {
    ok: true,
    value: {
      sessionId,
      // Advisory only — logged for drift, never billed. A client that can
      // report its own elapsed time can report zero.
      elapsedSeconds:
        typeof body.elapsedSeconds === 'number' && Number.isFinite(body.elapsedSeconds)
          ? body.elapsedSeconds
          : undefined,
      tutorText: typeof body.tutorText === 'string' ? body.tutorText : undefined,
      learnerText: typeof body.learnerText === 'string' ? body.learnerText : undefined,
      recognizerConfidence:
        typeof body.recognizerConfidence === 'number' && Number.isFinite(body.recognizerConfidence)
          ? body.recognizerConfidence
          : undefined,
    },
  };
}

const END_REASONS: ReadonlySet<string> = new Set(['budget', 'safety', 'timeout', 'error']);

export function parseEndRequest(body: Record<string, unknown>): ParseResult<EndRequest> {
  const sessionId = String(body.sessionId ?? '');
  if (!sessionId) return bad('sessionId is required');

  const reason = body.endReason;
  return {
    ok: true,
    value: {
      sessionId,
      // Anything unrecognised becomes 'learner'. The reason is telemetry, not a
      // control signal, so a stale client sending a reason we retired should
      // still be able to close its session cleanly.
      endReason: typeof reason === 'string' && END_REASONS.has(reason)
        ? (reason as TutorEndReason)
        : 'learner',
    },
  };
}
