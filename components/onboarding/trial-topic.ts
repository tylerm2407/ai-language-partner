/**
 * Which topic the onboarding trial should teach.
 *
 * Two questions that look like one, and the whole reason this is a module
 * rather than three inline `??`s in the screen:
 *
 *  1. WHAT DID THE LEARNER SAY THEY WANT? — `resolveTrialTopic`. A tapped chip
 *     is a statement; a guess from free text is an inference; no hit at all is
 *     an honest null. That null has to survive, because it is what onboarding
 *     reports to analytics — a default recorded as a choice would say five in
 *     six learners picked "Travel" when in fact most of them typed something
 *     the keyword table could not read.
 *
 *  2. WHAT LESSON DO WE ACTUALLY RUN? — `FALLBACK_TRIAL_TOPIC`. The runner
 *     needs a concrete pack, so a null has to become something. `travel` is
 *     the least wrong default for the same reason `trial-lesson.ts` picks it:
 *     ordering a coffee is the one scene that is plausible for a learner of
 *     any of the five reasons, and it is the pack whose first sentence reads
 *     best as the "you can already say this" payoff two screens later.
 *
 * Keeping them apart is the point. Collapse them into one
 * `topic ?? 'travel'` at the state level and the draft, the analytics event
 * and the plan-reveal headline all start claiming a choice nobody made.
 */
import { topicFromIdealText, type TopicKey } from './topic-packs';

/** The pack run when the learner's answer points nowhere. See above. */
export const FALLBACK_TRIAL_TOPIC: TopicKey = 'travel';

/**
 * The topic behind the learner's ideal-self answer, or null when it cannot be
 * told.
 *
 * `chipTopic` wins outright: a tap is explicit, and re-deriving from the text
 * would let an edit to a chip's sentence silently move the learner to another
 * topic mid-sentence. Only when no chip was tapped does the free text get read.
 */
export function resolveTrialTopic(idealText: string, chipTopic: TopicKey | null): TopicKey | null {
  if (chipTopic) return chipTopic;
  const trimmed = idealText.trim();
  if (!trimmed) return null;
  return topicFromIdealText(trimmed);
}
