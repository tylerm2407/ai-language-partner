// Image-generation prompts for photo-to-avatar rendering.
//
// These prompts live SERVER-SIDE ONLY, mirroring `scenarios.ts`. The mobile
// client sends just an `avatarStyleKey` to the avatar Edge Function, which
// resolves the key to the full hidden prompt here before calling the image
// model. Users never see these strings (CLAUDE.md §6: never expose model or
// system prompts in UI or logs).
//
// Authoring rules (keep consistent for maintenance):
//   1. STYLE block is the art direction and is authored/tuned by hand against
//      real reference output. Treat it as the creative contract.
//   2. FRAMING block is fixed across every style. Avatars render at 32/64/128px
//      (`components/avatar/constants.ts` AVATAR_SIZES), so the subject must be
//      a centered head-and-shoulders crop that stays readable when small.
//      Full-scene prompts written for a large canvas lose the face at 32px.
//   3. IDENTITY block is fixed across every style. The entire point of the
//      feature is that the learner recognises themselves, so likeness is an
//      explicit instruction rather than something the model is left to infer.

export type AvatarStyleKey = 'anime_pop';

export interface AvatarStyle {
  /** Shown in the style picker. Safe to display. */
  label: string;
  /** Shown under the label in the picker. Safe to display. */
  description: string;
  /** Hidden image-model prompt. Never send this to the client. */
  prompt: string;
}

/**
 * Framing rules appended to every style. Avatars are square and are rendered
 * as small as 32px, so composition is constrained even when the underlying
 * art direction describes a wider scene.
 */
const FRAMING = `FRAMING
Square 1:1 composition. Head-and-shoulders portrait, face centred and occupying
roughly 60% of the frame height. Keep the head fully inside the frame with a
small margin — the image is displayed inside a circular crop, so nothing
essential may sit in the corners. Background is simple and low-detail: it must
read as a single colour field at small sizes and never compete with the face.
The image must remain legible when scaled down to 32x32 pixels.`;

/**
 * Likeness rules appended to every style. Without this the model drifts toward
 * a generic attractive face in the requested style, which defeats the feature.
 */
const IDENTITY = `IDENTITY
Preserve the subject's recognisable likeness: face shape, skin tone, hair colour
and texture, facial hair, eye colour, and any eyewear. Stylise the rendering,
not the person. Do not slim, age, lighten, or otherwise "improve" the subject.
Render exactly one person — the primary subject of the uploaded photo.`;

export const AVATAR_STYLES: Record<AvatarStyleKey, AvatarStyle> = {
  anime_pop: {
    label: 'Anime Pop',
    description: 'Bold cel-shaded anime with clean linework and saturated colour.',
    // STYLE paragraph is the user-authored prompt, kept verbatim.
    prompt: `STYLE
Create a trending anime art style image from the uploaded subject. Use confident line-work with slight variation and minimal cel shading using flat shadow shapes. Use bright, saturated colors and clean graphic lighting. The style is defined by exaggerated, cartoonish character proportions featuring highly expressive, simplistic facial features that allow for immense emotional range, with highly varied stretched anatomy. Transform the environment into a slightly warped space with playful perspective distortion and simplified objects. Composition and tone should be energetic, lively, and comedic in a fully stylized, non-realistic world.

${FRAMING}

${IDENTITY}`,
  },
};

/** Safe lookup that returns null for unknown keys. */
export function getAvatarStyle(key: string): AvatarStyle | null {
  return (AVATAR_STYLES as Record<string, AvatarStyle>)[key] ?? null;
}

/** Style keys safe to expose to the client (labels/descriptions only). */
export function listAvatarStyles(): Array<{ key: AvatarStyleKey; label: string; description: string }> {
  return (Object.keys(AVATAR_STYLES) as AvatarStyleKey[]).map((key) => ({
    key,
    label: AVATAR_STYLES[key].label,
    description: AVATAR_STYLES[key].description,
  }));
}
