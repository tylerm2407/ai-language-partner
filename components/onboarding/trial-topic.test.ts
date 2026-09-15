/**
 * The rule this file exists to hold: a DEFAULT IS NOT A CHOICE.
 *
 * `resolveTrialTopic` is two lines long and the temptation to inline it as
 * `topic ?? 'travel'` at the call site will come back. If that happens, every
 * learner whose sentence the keyword table could not read is recorded as
 * having picked Travel, and the funnel reports a topic distribution that is
 * mostly an artefact of the fallback. So the null is asserted here directly.
 */
import { resolveTrialTopic, FALLBACK_TRIAL_TOPIC } from './trial-topic';
import { TOPIC_CHIPS } from './topic-packs';

describe('resolveTrialTopic', () => {
  it('takes the tapped chip over anything in the text', () => {
    // The learner tapped Work and then rewrote the sentence into something
    // that reads like travel. The tap is the statement; the text is not.
    expect(resolveTrialTopic('a trip to the airport with my hotel booking', 'work')).toBe('work');
  });

  it('reads the free text when no chip was tapped', () => {
    expect(resolveTrialTopic('Talking to my grandmother and my cousins', null)).toBe('family');
    expect(resolveTrialTopic('Running a meeting with clients', null)).toBe('work');
  });

  it('returns null when the text says nothing it can read', () => {
    expect(resolveTrialTopic('I just want to be good at it', null)).toBeNull();
  });

  it('returns null for empty and whitespace-only text', () => {
    expect(resolveTrialTopic('', null)).toBeNull();
    expect(resolveTrialTopic('   \n ', null)).toBeNull();
  });

  it('does not substitute the lesson fallback for an unreadable answer', () => {
    // The whole point. A null here becomes `travel` for the RUNNER, one line
    // later and on purpose — but never inside the value the draft stores.
    expect(resolveTrialTopic('something nice', null)).not.toBe(FALLBACK_TRIAL_TOPIC);
    expect(resolveTrialTopic('something nice', null)).toBeNull();
  });

  it('recognises every chip sentence as its own topic', () => {
    // If a chip's copy is ever edited into something the keyword table cannot
    // read, a learner who taps it and then edits one word loses their topic.
    // This is the guard on that, run against the real chip strings.
    for (const chip of TOPIC_CHIPS) {
      expect(resolveTrialTopic(chip.text('Spanish'), null)).toBe(chip.key);
    }
  });
});
