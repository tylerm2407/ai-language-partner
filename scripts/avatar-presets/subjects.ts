/**
 * Subject matrix for the premade avatar library.
 *
 * 50 distinct people, one style each, 10 per style.
 *
 * WHY 50 PEOPLE AND NOT 25 PEOPLE IN 2 STYLES
 *
 * This library is the FREE path to a personal avatar — a learner picks from it
 * before ever being asked to pay. What matters is therefore the chance that an
 * arbitrary person finds a figure resembling them, and rendering the same face
 * twice spends two of fifty slots on one person. Style is a secondary
 * aesthetic preference; skin tone, age, hair and presentation are what people
 * actually match on. 50 distinct people doubles the coverage 25x2 would have
 * given, and every style still appears ten times, so the grid does not read as
 * monotonous.
 *
 * WHY THESE READ THE WAY THEY DO
 *
 * Every descriptor is concrete — skin tone, hair texture, face shape, age,
 * eyewear, clothing. None names a race or ethnicity, and that is deliberate
 * rather than squeamish: image models answer a bare demographic label with
 * their most average example of it, so labelling yields a few stock archetypes
 * recoloured and the same face keeps recurring. Specific features produce
 * specific people.
 *
 * Balanced by construction, not by hope:
 *   • presentation — 24 feminine, 24 masculine, 2 androgynous
 *   • age — 10 under 25, 14 in 25-34, 14 in 35-49, 8 in 50-64, 4 at 65+
 *   • skin tone — ten in each of five bands, deep brown through fair
 *   • hair — coils, afro, locs, box braids, cornrows, twists, straight, wavy,
 *     curls, buzzed, bald, thinning, grey, red, blonde, covered; texture is
 *     varied INDEPENDENTLY of tone, so the matrix cannot collapse into "same
 *     face, different palette"
 *   • features — nose, eye, jaw and brow shapes varied independently again;
 *     glasses, facial hair, freckles, vitiligo, a hearing aid, fuller faces
 *
 * Ordering matters: subjects are deliberately NOT grouped by tone or age,
 * because styles are assigned round-robin (styleFor). Grouping would put every
 * dark-skinned subject into one style and every older subject into another.
 *
 * Expression is uniformly restrained — closed mouths, settled faces. The first
 * pilot came back with open-mouthed laughing avatars, which is wrong for a
 * picture someone lives with on their profile.
 */

export interface PresetSubject {
  /** Stable id — becomes part of the preset key and the storage filename. */
  id: string;
  /** Prose fed to the model as the SUBJECT block. */
  description: string;
}

export const PRESET_SUBJECTS: PresetSubject[] = [
  { id: 's01', description: 'A woman in her late twenties with deep brown skin, a broad nose and full lips, high cheekbones, and short tightly-coiled black hair cut close to the scalp. Large dark eyes, a calm closed-mouth expression. Wearing a mustard-yellow crew-neck sweater.' },
  { id: 's02', description: 'A man in his forties with light olive skin, a strong straight nose, heavy dark eyebrows, and a close-cropped salt-and-pepper beard. Dark wavy hair receding at the temples. Thick black rectangular glasses. Wearing a charcoal button-down shirt.' },
  { id: 's03', description: 'A young woman around twenty with pale freckled skin, a small upturned nose, green eyes, and long copper-red hair in loose waves past the shoulders. A small closed-lip smile. Wearing a forest-green denim jacket.' },
  { id: 's04', description: 'A man in his early thirties with warm golden-brown skin, monolid eyes, a soft rounded jaw, and straight jet-black hair swept sideways across the forehead. Calm, thoughtful expression. Wearing a slate-blue hoodie.' },
  { id: 's05', description: 'A woman in her sixties with medium-brown skin lined with creases around the eyes, a warm closed-mouth smile, and silver-grey hair in a neat short afro. Gold hoop earrings. Wearing a deep plum blouse.' },
  { id: 's06', description: 'A man in his fifties with very dark brown skin, a square jaw, a close-shaved head, and a full greying beard. Deep-set eyes under heavy brows, a steady confident gaze. Wearing a burnt-orange knitted jumper.' },
  { id: 's07', description: 'A woman in her mid-thirties with light tan skin, a long straight nose, almond-shaped hazel eyes, and dark brown hair pulled into a high tight bun with loose strands. Round wire-rimmed glasses. Wearing a cream turtleneck.' },
  { id: 's08', description: 'A young man around nineteen with medium brown skin, a relaxed closed-lip smile, short black hair in a neat fade, and prominent ears. Wearing a bright teal t-shirt.' },
  { id: 's09', description: 'A woman in her forties with rich dark brown skin and shoulder-length locs pulled half back. A narrow face with a pointed chin, arched brows, a quiet half-smile. Wearing a rust-red collared jacket.' },
  { id: 's10', description: 'A man in his late twenties with fair skin that flushes at the cheeks, a broad flat nose, blue-grey eyes, and messy sandy-blond hair falling over the forehead. Light stubble. Wearing a navy zip-up fleece.' },
  { id: 's11', description: 'A woman in her early thirties with deep bronze skin, a strong aquiline nose, thick black eyebrows, and very long straight black hair worn loose. Dark brown eyes, composed expression. Wearing an emerald-green top.' },
  { id: 's12', description: 'A man in his sixties with light skin weathered by sun, a heavily lined forehead, a bulbous nose, and thinning white hair combed back. Bright pale-blue eyes, a wry closed-lip smile. Wearing a faded chambray shirt.' },
  { id: 's13', description: 'A woman in her mid-twenties with warm beige skin, round cheeks, a small nose, and chin-length glossy black hair in a sharp bob with a blunt fringe. Bold red lipstick, direct gaze, lips closed. Wearing a black leather jacket.' },
  { id: 's14', description: 'A man in his thirties with medium-dark brown skin, a broad square face, a neat moustache, and short black hair under a flat brown cap. Warm crinkled eyes, settled expression. Wearing a mustard corduroy shirt.' },
  { id: 's15', description: 'An androgynous person in their twenties with pale skin, sharp cheekbones, a slender straight nose, and short platinum-bleached hair shaved at one side. Several small silver ear piercings. Neutral, cool expression. Wearing a grey oversized shirt.' },
  { id: 's16', description: 'A woman in her fifties with olive skin, a rounded soft jaw, deep smile lines, and dark greying hair in a loose low bun. Reading glasses pushed up onto the head. Wearing a soft lilac cardigan.' },
  { id: 's17', description: 'A man in his early twenties with dark brown skin and a tall shaped-up flat top of tight curls. A lean face, a composed mouth, bright alert eyes. Wearing a white t-shirt under a red bomber jacket.' },
  { id: 's18', description: 'A woman in her thirties wearing a soft coral headscarf framing the face. Warm brown skin, large dark eyes with long lashes, a small round nose, a gentle closed-mouth smile. Wearing a cream long-sleeved top.' },
  { id: 's19', description: 'A man in his forties with tan skin, a heavy brow, a broken flattened nose, and thick black hair combed back with grey at the temples. A dense dark beard. Knowing expression. Wearing a dark green work jacket.' },
  { id: 's20', description: 'A young woman around eighteen with medium-tan skin, freckles across the nose, wide brown eyes, and voluminous dark curly hair tied in a high puff. A shy closed-lip smile. Wearing a pink hoodie.' },
  { id: 's21', description: 'A man in his late fifties with light brown skin, a long oval face, a neatly trimmed white beard, and short grey hair. Gold-rimmed oval glasses, a calm patient expression. Wearing a navy blazer over a light shirt.' },
  { id: 's22', description: 'A woman in her twenties with dark skin and long box braids gathered over one shoulder. A heart-shaped face, full lips, a small silver nose stud, one eyebrow slightly raised. Wearing a bright cobalt-blue top.' },
  { id: 's23', description: 'A man in his thirties with fair skin, red-blond hair cut short and neat, pale freckled cheeks, and a strong cleft chin. Light green eyes, an easy closed-lip smile. Wearing a heather-grey sweatshirt.' },
  { id: 's24', description: 'A woman in her forties with golden-brown skin, a wide face with prominent cheekbones, straight black hair cut to the jaw with a centre parting, and a small mole above the lip. Wry expression. Wearing a deep teal blouse.' },
  { id: 's25', description: 'A man in his mid-twenties with brown skin, a soft round face, thick black curly hair, and full dark eyebrows. A soft closed-mouth smile, dimples in both cheeks. Wearing a bright yellow t-shirt under an olive overshirt.' },
  { id: 's26', description: 'A woman in her late thirties with deep brown skin and vitiligo patches across one cheek and the forehead, close-cropped natural hair, a broad nose, and steady dark eyes. A composed, self-possessed expression. Wearing a white shirt.' },
  { id: 's27', description: 'A man in his seventies with medium-brown skin, deep folds around the mouth, a wide flat nose, and short white hair. A small hearing aid behind one ear. Kind, unhurried eyes. Wearing a soft grey knitted cardigan.' },
  { id: 's28', description: 'A young woman around twenty-three with light tan skin, a fuller round face, a small nose, and long dark hair in a single thick braid over the shoulder. Quiet closed-lip smile. Wearing a dusty-rose sweatshirt.' },
  { id: 's29', description: 'A man in his forties wearing a deep navy turban, with medium-brown skin, a long dark beard flecked with grey, a strong nose, and calm dark eyes. Wearing a charcoal jacket over a light shirt.' },
  { id: 's30', description: 'A woman in her early fifties with fair skin, fine lines at the eyes, sharp blue eyes, and short silver-grey hair in a neat crop. Angular jaw, direct expression. Wearing a mustard scarf over a black top.' },
  { id: 's31', description: 'A man in his late twenties with deep brown skin, short cornrows running straight back, a square jaw with a thin chinstrap beard, and warm brown eyes. Calm expression. Wearing a heather-green hoodie.' },
  { id: 's32', description: 'A woman in her mid-thirties with olive skin, thick dark eyebrows, a prominent straight nose, and shoulder-length dark brown hair with a natural wave. Small gold stud earrings. Wearing a rust-coloured blouse.' },
  { id: 's33', description: 'A young man around twenty-one with pale skin, tired grey eyes, a sharp nose, and black hair falling messily over the forehead. A faint closed-lip smile. Wearing a black band t-shirt.' },
  { id: 's34', description: 'A woman in her sixties with light brown skin, a soft full face, laugh lines, and grey-streaked black hair wound into a bun. Large tortoiseshell glasses. Warm closed-mouth smile. Wearing a teal knitted top.' },
  { id: 's35', description: 'A man in his early thirties with very dark brown skin, a shaved head, a broad nose, full lips, and a neat short beard. Bright, direct eyes. Wearing a crisp white t-shirt.' },
  { id: 's36', description: 'A woman in her twenties with warm tan skin, a heart-shaped face, dark almond eyes, and long black hair with a blunt fringe. A small silver septum ring. Neutral expression. Wearing an oversized denim jacket.' },
  { id: 's37', description: 'A man in his fifties with fair ruddy skin, a thick greying moustache, a heavy jaw, and short receding brown hair. Deep-set hazel eyes, an even expression. Wearing a plaid flannel shirt.' },
  { id: 's38', description: 'A woman in her thirties with medium-dark brown skin, a rounded nose, high forehead, and shoulder-length twists pulled back from the face. Small gold hoops. A settled, easy expression. Wearing a soft ochre top.' },
  { id: 's39', description: 'A young man around twenty-two with light golden skin, straight black hair with an undercut, thin eyebrows, and a slender face. Wire-frame glasses. Reserved expression. Wearing a plain black sweatshirt.' },
  { id: 's40', description: 'A woman in her forties with fair freckled skin, strawberry-blonde hair in a loose shoulder-length cut, pale green eyes, and a narrow nose. A small closed-lip smile. Wearing a soft sage-green cardigan.' },
  { id: 's41', description: 'A man in his sixties with dark brown skin, close-cropped white hair, deep smile lines, a broad nose, and a short white beard. Steady, warm eyes. Wearing a burgundy sweater over a collared shirt.' },
  { id: 's42', description: 'A woman in her late twenties with brown skin, a fuller face and softer jaw, dark curly hair cut into a shoulder-length shag, and thick-framed round glasses. Calm closed-mouth expression. Wearing a striped orange top.' },
  { id: 's43', description: 'A man in his thirties with medium olive skin, a strong brow, close-cropped dark hair, and a full well-kept beard. Dark eyes, an even and unhurried look. Wearing a stone-grey henley.' },
  { id: 's44', description: 'A young woman around nineteen with deep brown skin, a small round nose, wide expressive eyes, and long thin braids pulled into a high ponytail. A quiet closed-lip smile. Wearing a lilac t-shirt.' },
  { id: 's45', description: 'An androgynous person in their thirties with medium-tan skin, a square jaw, buzzed dark hair, and a small silver earring. Neutral, level expression. Wearing a plain olive-green overshirt.' },
  { id: 's46', description: 'A woman in her fifties wearing a patterned indigo headwrap, with dark brown skin, a broad nose, full lips, and deep-set warm eyes. Fine lines at the mouth. Wearing a mustard-gold blouse.' },
  { id: 's47', description: 'A man in his late twenties with pale skin, ginger hair cropped short, a heavy scattering of freckles across the nose and cheeks, and pale blue eyes. A faint closed-lip smile. Wearing a navy rugby shirt.' },
  { id: 's48', description: 'A woman in her mid-forties with golden-brown skin, a long face, dark eyes behind slim oval glasses, and black hair pulled into a low ponytail with grey at the parting. Wearing a slate-blue shirt.' },
  { id: 's49', description: 'A man in his early twenties with medium brown skin, a wiry frame, an angular face, short twisted curls, and a small gap in the eyebrow. Alert, composed expression. Wearing a bright red hoodie.' },
  { id: 's50', description: 'A woman in her seventies with fair skin, soft deep wrinkles, gentle pale-grey eyes, and short white hair set in soft curls. Pearl earrings. A warm closed-mouth smile. Wearing a powder-blue cardigan.' },
];

/**
 * Style keys in assignment order. Round-robin over the subject list gives ten
 * per style, and because the subjects above are deliberately not grouped by
 * tone or age, each style receives a mixed set rather than a cluster.
 */
export const STYLE_ROTATION = [
  'anime_pop',
  'retro_cartoon',
  'comic_graphic',
  'cinematic_3d',
  'cinematic_realistic',
] as const;

export function styleFor(index: number): (typeof STYLE_ROTATION)[number] {
  return STYLE_ROTATION[index % STYLE_ROTATION.length];
}
