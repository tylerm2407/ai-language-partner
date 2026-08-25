/**
 * Text-to-image adaptation of the photo-to-avatar styles.
 *
 * THE PROBLEM THIS SOLVES
 *
 * Every style in supabase/functions/_shared/avatar-styles.ts is written for a
 * photo the learner uploads: each STYLE paragraph opens with "Transform the
 * uploaded subject", and the shared IDENTITY block ends with "Render exactly
 * one person — the primary subject of the uploaded photo."
 *
 * A premade library has no uploaded photo. Fed those prompts verbatim, a
 * text-to-image model is told to preserve the likeness of a person it was
 * never given — IDENTITY becomes meaningless at best and actively misleading
 * at worst, and the output drifts toward whatever generic face the model
 * reaches for.
 *
 * WHAT THIS DOES INSTEAD
 *
 * Reuses the STYLE and FRAMING blocks EXACTLY as authored, drops IDENTITY,
 * and puts a SUBJECT block in its place. The reuse is the point: the style
 * text is never copied here, it is read from the shared module and cut at the
 * IDENTITY marker. Tune a style for the photo flow and the preset library
 * inherits the change; there is no second copy to forget.
 *
 * A short TASK preamble tells the model how to read the phrase "the uploaded
 * subject" where it survives inside the author's verbatim text. That is
 * cheaper and safer than editing six hand-tuned creative paragraphs, and it
 * keeps authoring rule 1 intact — STYLE stays the creative contract.
 */
import { AVATAR_STYLES, type AvatarStyleKey } from '../../supabase/functions/_shared/avatar-styles';
import type { PresetSubject } from './subjects';

/** Marker that begins the IDENTITY block in every composed style prompt. */
const IDENTITY_MARKER = '\nIDENTITY\n';

const TASK = `TASK
Generate an original character portrait from the SUBJECT description at the end
of this prompt. There is no source photograph. Invent the person described.
Wherever the STYLE notes below refer to "the uploaded subject", "the subject",
or preserving a likeness, they refer to the person described under SUBJECT.
Do not render a real or identifiable person.`;

/**
 * Corrections layered on top of the shared FRAMING block, each one earned from
 * a failure in the first pilot batch rather than guessed at.
 *
 * These live here and NOT in avatar-styles.ts on purpose. FRAMING is correct
 * for the photo flow; these are text-to-image-only repairs, and pushing them
 * upstream would change what learners' own photos render as.
 */
const PRESET_RULES = `OUTPUT RULES
Fill the entire square frame edge to edge. Do NOT draw a circle, oval, border,
frame, vignette, or rounded mask inside the image, and do not leave blank
corners — the app applies its own circular crop, so a drawn circle wastes the
frame and shows as flat corners.
Include the whole head with clear margin above the hair. Do not crop the top of
the head or the ears.

SKIN TONE
Render the exact skin tone named under SUBJECT. Do not lighten, brighten,
whiten, or "flatter" it, and do not drift toward a lighter default — a subject
described as dark brown must read as dark brown, and one described as light
brown must not read as white. Skin tone is a defining feature of the person,
not a lighting choice.

AGE
Render the exact age named under SUBJECT with adult proportions where the
subject is an adult. Do not render an adult as a child or teenager, and do not
smooth away age markers such as lines, greying hair, or a receding hairline.

EXPRESSION
Keep the expression restrained and settled. The mouth stays CLOSED unless the
SUBJECT explicitly says otherwise — no open mouths, no visible teeth, no wide
grins, no laughing, no shouting, no exaggerated surprise. A calm face with a
faint smile or a neutral, self-possessed look is correct. These are profile
avatars a person lives with, not reaction shots.`;

/**
 * Everything in a style prompt up to but excluding IDENTITY — i.e. the STYLE
 * paragraph plus FRAMING, both verbatim.
 *
 * Throws rather than silently returning the whole prompt if the marker is
 * missing: a preset generated with IDENTITY still attached would quietly ask
 * the model to preserve the likeness of a photo that does not exist, and the
 * only symptom would be 50 subtly wrong images nobody could explain.
 */
export function styleAndFraming(styleKey: AvatarStyleKey): string {
  const full = AVATAR_STYLES[styleKey].prompt;
  const cut = full.indexOf(IDENTITY_MARKER);
  if (cut === -1) {
    throw new Error(
      `[avatar-presets] style "${styleKey}" has no IDENTITY block — the ` +
        'text-to-image adaptation cannot safely strip it. Check that ' +
        'avatar-styles.ts still composes prompts as STYLE + FRAMING + IDENTITY.',
    );
  }
  return full.slice(0, cut).trimEnd();
}

/**
 * The full text-to-image prompt for one subject in one style.
 *
 * PRESET_RULES sits after the style's own FRAMING and immediately before
 * SUBJECT. Order is load-bearing: the pilot showed later instructions winning
 * ties against the style paragraphs, which is how a flat background survived
 * five styles that each asked for a built-out world.
 */
export function presetPrompt(styleKey: AvatarStyleKey, subject: PresetSubject): string {
  return `${TASK}

${styleAndFraming(styleKey)}

${PRESET_RULES}

SUBJECT
${subject.description}`;
}

/** Preset key / storage filename for a subject-style pair. */
export function presetId(styleKey: AvatarStyleKey, subject: PresetSubject): string {
  return `${subject.id}-${styleKey}`;
}
