import { assertEquals, assertStringIncludes } from 'https://deno.land/std@0.208.0/assert/mod.ts';
import { AVATAR_STYLES, getAvatarStyle, listAvatarStyles } from './avatar-styles.ts';

Deno.test('getAvatarStyle resolves a known key', () => {
  const style = getAvatarStyle('anime_pop');
  assertEquals(style?.label, 'Anime Pop');
});

Deno.test('getAvatarStyle returns null for an unknown key', () => {
  assertEquals(getAvatarStyle('not_a_style'), null);
});

Deno.test('every style carries the shared framing and identity rules', () => {
  for (const style of Object.values(AVATAR_STYLES)) {
    assertStringIncludes(style.prompt, 'FRAMING');
    assertStringIncludes(style.prompt, 'IDENTITY');
    // Avatars render as small as 32px — the size floor must stay in the prompt.
    assertStringIncludes(style.prompt, '32x32');
  }
});

Deno.test('listAvatarStyles exposes labels but never the prompt', () => {
  const listed = listAvatarStyles();
  assertEquals(listed.length, Object.keys(AVATAR_STYLES).length);
  for (const entry of listed) {
    assertEquals('prompt' in entry, false);
  }
});
