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

export type AvatarStyleKey =
  | 'anime_pop'
  | 'retro_cartoon'
  | 'comic_graphic'
  | 'cinematic_3d'
  | 'cinematic_realistic';

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

  retro_cartoon: {
    label: 'Retro Cartoon',
    description: 'Thick-lined Saturday-morning cartoon with flat, punchy colour.',
    // STYLE paragraph is the user-authored prompt, kept verbatim.
    //
    // NOTE (authoring rule 2): the environment paragraph below asks for a
    // built-out cartoon world — chunky architecture, playful signs, oversized
    // props, layered depth. FRAMING then asks for a background that reads as a
    // single colour field at 32px. They pull against each other, and FRAMING
    // wins only because it comes last. If reference output shows a busy
    // background crowding the face inside the circular crop, the fix is to cut
    // the environment paragraph from THIS style rather than to soften FRAMING —
    // the 32px floor is a hard constraint of where avatars render
    // (components/avatar/constants.ts AVATAR_SIZES), not a preference.
    prompt: `STYLE
Transform the uploaded subject into a bold retro Saturday-morning cartoon illustration inspired by hand-drawn television animation from the late 1980s through early 2000s. Preserve the subject's core identity, recognizable facial structure, hairstyle, clothing cues, accessories, and overall pose, while simplifying them into highly readable cartoon shapes.

Use thick, confident black outlines with subtle variation in line weight, rounded geometric forms, simplified anatomy, and exaggerated facial features designed for immediate readability and comedic expression. Eyes, eyebrows, mouth shapes, hands, and body posture should be pushed slightly beyond realism to create a playful, charismatic personality while keeping the subject clearly recognizable.

Use flat, vibrant color fills with limited two-step cel shading and very little texture. Shadows should appear as simple graphic shapes rather than realistic gradients. Add bright highlights sparingly to emphasize the face, hair, glasses, clothing, and important silhouette edges.

Use a warm, nostalgic color palette built around saturated reds, yellows, oranges, teals, blues, and greens. Colors should feel cheerful, punchy, and slightly vintage without looking faded.

Transform the environment into a whimsical cartoon world made from simplified props, chunky architecture, curved shapes, playful signs, oversized objects, and slightly distorted perspective. Background elements should feel hand-designed rather than realistic, with a theatrical sense of depth created through overlapping layers and large graphic forms.

The composition should feel energetic and humorous, like a freeze-frame from an animated comedy series. Use dynamic posing, slight squash-and-stretch, expressive asymmetry, and a strong silhouette. The finished image should feel friendly, nostalgic, colorful, highly stylized, and unmistakably hand-animated rather than realistic or cinematic.

Avoid photorealistic skin, realistic lighting, complex rendering, detailed surface textures, or realistic proportions. Remove any visible logos, source labels, watermarks, captions, or text unless specifically requested.

${FRAMING}

${IDENTITY}`,
  },

  comic_graphic: {
    label: 'Comic Book',
    description: 'Inked comic panel with halftones, hard shadows and electric colour.',
    // STYLE paragraph is the user-authored prompt, kept verbatim.
    //
    // NOTE (authoring rule 2): the most aggressive of the four against
    // FRAMING — it asks for skewed buildings, floating panels, motion streaks,
    // oversized foreground shapes and a tilted horizon, then FRAMING asks for a
    // near-empty background and a centred head. Watch this one first in
    // reference output; the "environment" and "perspective" paragraphs are the
    // ones to cut if the face stops reading inside the circular crop.
    prompt: `STYLE
Transform the uploaded subject into a high-energy graphic comic-book animation style while preserving the subject's recognizable identity, key facial features, hairstyle, accessories, clothing, and general pose.

Use bold inked outlines with aggressive variation in thickness, angular shapes, sharp facial planes, exaggerated silhouettes, and highly expressive features. Push eyebrows, eyes, jaw shape, mouth, shoulders, hands, and posture into a dramatic illustrated form while maintaining a clear resemblance to the original subject.

Render the image using flat saturated colors, hard-edged shadows, graphic highlights, halftone textures, selective cross-hatching, speed lines, abstract impact shapes, and layered print-style effects. Use minimal gradients. Lighting should be dramatic and highly graphic, with distinct pools of light and shadow rather than naturalistic illumination.

Build the palette around intense complementary colors such as electric blue and orange, red and cyan, purple and yellow, or other striking combinations. Allow shadows to use unconventional colors for added graphic intensity.

Transform the environment into a dynamic comic-panel world with skewed buildings, dramatic perspective, oversized foreground shapes, stylized signage, floating panels, motion streaks, geometric bursts, fragmented shapes, and warped vanishing points.

Use perspective aggressively. Tilt the horizon, exaggerate foreshortening, enlarge foreground elements, and distort proportions slightly to create momentum and visual tension. The image should feel as though it was captured during the most dramatic frame of an animated graphic novel.

Facial expression and body language should be heightened, confident, charismatic, and cinematic. The overall tone should feel energetic, bold, youthful, rebellious, and visually explosive.

Avoid smooth photorealistic shading, realistic textures, muted colors, conventional photography, subtle natural lighting, source labels, logos, watermarks, or unnecessary text.

${FRAMING}

${IDENTITY}`,
  },

  cinematic_3d: {
    label: '3D Animated',
    description: 'Polished feature-film 3D with soft cinematic lighting.',
    // STYLE paragraph is the user-authored prompt, kept verbatim.
    //
    // NOTE (authoring rule 2): asks for a stylized 3D world with curved
    // architecture, oversized objects and exaggerated depth. Same tension with
    // FRAMING as the other three — cut the environment and perspective
    // paragraphs first if the face stops reading at 32px.
    prompt: `STYLE
Transform the uploaded subject into a polished modern 3D animated feature-film character while preserving the subject's recognizable identity, facial structure, hairstyle, accessories, clothing cues, pose, and overall personality.

Translate the face into appealing stylized proportions with slightly enlarged eyes, softened facial planes, simplified features, expressive eyebrows, a more readable mouth shape, and subtly exaggerated head-to-body proportions. Keep the character visually recognizable, but push the design toward charming, cinematic animation rather than realism.

Model the character with smooth, rounded forms and carefully controlled stylization. Skin should have a soft matte finish with gentle subsurface warmth rather than photographic texture. Hair should be sculpted into larger, clean grouped strands with clear directional flow. Facial hair, glasses, fabric, and accessories should be simplified into attractive animated-film materials rather than individually realistic details.

Use soft cinematic lighting with a strong key light, gentle fill light, subtle rim lighting, and beautifully controlled color contrast. Shadows should be soft but purposeful, helping define the character's silhouette and facial expression. Add tasteful specular highlights to eyes, glasses, hair, and select materials.

Use rich, vibrant colors with harmonious cinematic grading. The environment should feel like a stylized 3D world designed specifically around the character, featuring curved architecture, oversized simplified objects, clean surfaces, whimsical proportions, and exaggerated depth.

Introduce playful perspective distortion by slightly enlarging foreground objects and compressing distant elements. The world should feel physically believable within animation, but clearly designed and exaggerated rather than realistic.

The composition should resemble a hero frame from a high-budget animated feature: emotionally expressive, polished, cinematic, charming, and visually sophisticated. Keep the mood lively and approachable with subtle humor conveyed through facial expression, posing, environment, and proportions.

Avoid photorealistic rendering, hyper-detailed pores, realistic anatomy, documentary lighting, gritty textures, logos, source labels, watermarks, or unwanted text.

${FRAMING}

${IDENTITY}`,
  },

  cinematic_realistic: {
    label: 'True to Life',
    description: 'Near-photoreal portrait with a subtle cinematic polish.',
    // STYLE paragraph is the user-authored prompt, kept verbatim.
    //
    // The odd one out, in two ways worth knowing before tuning it:
    //
    //   1. It targets 85-90% realism, so it is the only style where the output
    //      reads as a photograph of the learner rather than an illustration.
    //      The storage and deletion path is identical (private bucket, purged
    //      with the account), but it is the style most likely to matter for
    //      App Privacy labelling if that is ever revisited.
    //   2. Its own text already prioritises identity preservation, so it
    //      reinforces the shared IDENTITY block instead of pulling against it —
    //      the opposite of the stylised four, where IDENTITY is the counterweight.
    //
    // Same FRAMING tension as the rest: it asks for shallow depth of field and
    // enough environmental detail to suggest a real place, which is noise at
    // 32px. Cut the environment and depth-of-field paragraphs first.
    prompt: `STYLE
Transform the uploaded subject into a cinematic semi-realistic animated portrait that remains strongly grounded in real human appearance. Preserve the subject's recognizable identity with high fidelity, including facial structure, proportions, hairstyle, hairline, eye shape and direction, skin tone, facial hair if present, clothing, accessories, pose, expression, and overall presence.

The final image should feel approximately 85-90% realistic and only 10-15% animated or stylized. Maintain believable adult human anatomy and natural facial proportions. Do not significantly enlarge the eyes, head, mouth, or other facial features. Introduce the animated influence subtly through cleaner facial shapes, gently softened contours, slightly simplified micro-details, polished feature definition, and a refined cinematic finish.

Render the skin with realistic dimensionality, natural variation, subtle pores, fine facial lines, believable subsurface warmth, and restrained texture. Avoid plastic, waxy, doll-like, or overly airbrushed skin. Keep blemishes and imperfections tastefully natural rather than removing all realism.

Render hair with convincing individual strands and natural density while subtly grouping sections into attractive directional shapes. Maintain the original hairstyle and silhouette closely. Facial hair should remain realistic but slightly cleaner and more organized than in a photograph.

Preserve glasses, jewelry, clothing, and other accessories with realistic materials, believable reflections, accurate thickness, and recognizable shapes. Do not simplify important identifying accessories unless necessary for visual clarity.

Use sophisticated cinematic lighting inspired by premium live-action portrait photography with a subtle animated-film polish. Use a soft directional key light, controlled fill lighting, gentle rim or edge lighting, realistic contact shadows, reflected light, and carefully shaped highlights. Lighting should sculpt the face naturally while making the image feel more polished and visually expressive than an ordinary photograph.

Use rich but realistic color grading. Maintain believable skin tones and clothing colors while introducing slightly cleaner saturation, refined contrast, elegant highlight rolloff, and strong separation between the subject and background. Avoid neon palettes, extreme color shifts, or comic-book lighting.

Keep the environment believable and realistic, but subtly heightened. Use cleaner geometry, elegant depth, softened background detail, cinematic atmosphere, and gently idealized lighting. Background objects and architecture should remain physically plausible rather than cartoonish.

Use shallow cinematic depth of field to keep the subject sharply defined while allowing the background to fall into a soft, visually pleasing blur. Preserve enough environmental detail to suggest a real place and create atmosphere.

The overall composition should feel like a frame from a sophisticated live-action film that has passed through a premium animation and illustration pipeline. At first glance, the image should appear highly realistic. The subtle animated qualities should become apparent only through the polished shapes, controlled lighting, clean feature definition, and slightly idealized rendering.

Prioritize identity preservation above stylization. Keep the original gaze direction, facial expression, head angle, hairstyle, facial hair, accessories, and clothing cues as closely as possible.

Avoid exaggerated cartoon anatomy, oversized eyes, oversized heads, simplified doll-like faces, clay textures, thick comic outlines, strong cel shading, painterly brush strokes, fantasy features, glossy CGI skin, excessive beauty retouching, logos, source labels, watermarks, captions, or unwanted text.

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
