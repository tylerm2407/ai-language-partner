// src/lib/popularSongs.ts
// Popular Songs feature — external links only
// No audio, lyrics, or copyrighted content is hosted or streamed.
// URLs open in the user's own Spotify, Apple Music, or YouTube account.

export interface SongLink {
  id: string           // slug-friendly e.g. "spanish-despacito"
  title: string
  artist: string
  genre?: string
  difficulty?: 'beginner' | 'intermediate' | 'advanced'
  // Leave as empty string if you haven't pasted the URL yet.
  // The app auto-generates a search URL fallback so it always works.
  spotifyUrl: string
  appleMusicUrl: string
  youtubeUrl: string
}

export interface LanguageSongs {
  languageSlug: string   // matches STATIC_LANGUAGES slug exactly
  songs: SongLink[]
}

// ─── Helper: generate working search-URL placeholders ─────────────────────
export function searchUrl(platform: 'spotify' | 'apple' | 'youtube', title: string, artist: string): string {
  const q = encodeURIComponent(`${artist} ${title}`)
  if (platform === 'spotify')  return `https://open.spotify.com/search/${q}`
  if (platform === 'apple')    return `https://music.apple.com/us/search?term=${q}`
  return `https://www.youtube.com/results?search_query=${q}`
}

// ─── Helper: create a song entry with auto search URLs ───────────────────
function song(
  slug: string, title: string, artist: string,
  genre?: string, difficulty?: SongLink['difficulty'],
  spotifyUrl = '', appleMusicUrl = '', youtubeUrl = ''
): SongLink {
  return {
    id: slug,
    title, artist, genre, difficulty,
    spotifyUrl:    spotifyUrl    || searchUrl('spotify', title, artist),
    appleMusicUrl: appleMusicUrl || searchUrl('apple',   title, artist),
    youtubeUrl:    youtubeUrl    || searchUrl('youtube',  title, artist),
  }
}

// ─── Helper: bulk update URLs for a specific song ─────────────────────────
// Call this to paste in exact URLs without touching the seed data.
// Usage: patchSongUrls('spanish-despacito', { spotifyUrl: 'https://open.spotify.com/track/...' })
const urlOverrides: Record<string, Partial<Pick<SongLink, 'spotifyUrl' | 'appleMusicUrl' | 'youtubeUrl'>>> = {}

export function patchSongUrls(
  songId: string,
  urls: Partial<Pick<SongLink, 'spotifyUrl' | 'appleMusicUrl' | 'youtubeUrl'>>
) {
  urlOverrides[songId] = { ...urlOverrides[songId], ...urls }
}

function applyOverrides(s: SongLink): SongLink {
  const o = urlOverrides[s.id]
  return o ? { ...s, ...o } : s
}

// ─── Seed Data — 10 songs per language, 50 languages ─────────────────────
// HOW TO ADD REAL URLS:
//   1. Find the song entry by its id (e.g. 'spanish-despacito')
//   2. Replace the spotifyUrl/appleMusicUrl/youtubeUrl strings with real URLs
//   OR call patchSongUrls('spanish-despacito', { spotifyUrl: 'https://...' }) at app init

const SONGS_BY_LANGUAGE: LanguageSongs[] = [
  {
    languageSlug: 'spanish',
    songs: [
      song('spanish-despacito',       'Despacito',              'Luis Fonsi ft. Daddy Yankee', 'Reggaeton', 'intermediate'),
      song('spanish-la-bamba',        'La Bamba',               'Ritchie Valens',               'Folk Rock',  'beginner'),
      song('spanish-bamboleo',        'Bamboleo',               'Gipsy Kings',                  'Flamenco',   'intermediate'),
      song('spanish-oye-como-va',     'Oye Como Va',            'Santana',                      'Latin Rock', 'beginner'),
      song('spanish-waka-waka',       'Waka Waka',              'Shakira',                      'Pop',        'beginner'),
      song('spanish-camisa-negra',    'La Camisa Negra',        'Juanes',                       'Pop Rock',   'intermediate'),
      song('spanish-mi-gente',        'Mi Gente',               'J Balvin & Willy William',     'Reggaeton',  'intermediate'),
      song('spanish-clandestino',     'Clandestino',            'Manu Chao',                    'Ska',        'advanced'),
      song('spanish-besame-mucho',    'Bésame Mucho',           'Consuelo Velázquez',           'Bolero',     'beginner'),
      song('spanish-el-condor-pasa',  'El Condor Pasa',         'Simon & Garfunkel / Traditional','Folk',    'beginner'),
    ],
  },
  {
    languageSlug: 'french',
    songs: [
      song('french-vie-en-rose',      'La Vie en Rose',         'Édith Piaf',                   'Chanson',    'intermediate'),
      song('french-non-je-ne',        'Non, Je Ne Regrette Rien','Édith Piaf',                  'Chanson',    'advanced'),
      song('french-alors-on-danse',   'Alors On Danse',         'Stromae',                      'Electronic', 'intermediate'),
      song('french-formidable',       'Formidable',             'Stromae',                      'Pop',        'intermediate'),
      song('french-je-veux',          'Je Veux',                'Zaz',                          'Jazz-Pop',   'intermediate'),
      song('french-la-mer',           'La Mer',                 'Charles Trenet',               'Chanson',    'intermediate'),
      song('french-tous-les-garcons', 'Tous Les Garçons et Les Filles','Françoise Hardy',        'Pop',        'advanced'),
      song('french-bande-originale',  'Bande Originale',        'Soprano',                      'Hip-hop',    'advanced'),
      song('french-jladore',          "J'adore",                'Aya Nakamura',                 'R&B',        'intermediate'),
      song('french-papaoutai',        'Papaoutai',              'Stromae',                      'Electronic', 'advanced'),
    ],
  },
  {
    languageSlug: 'german',
    songs: [
      song('german-99-luftballons',   '99 Luftballons',         'Nena',                         'New Wave',   'intermediate'),
      song('german-du-hast',          'Du Hast',                'Rammstein',                    'Metal',      'intermediate'),
      song('german-wind-of-change',   'Wind of Change',         'Scorpions',                    'Rock',       'beginner'),
      song('german-major-tom',        'Major Tom',              'Peter Schilling',              'Pop',        'intermediate'),
      song('german-rock-me-amadeus',  'Rock Me Amadeus',        'Falco',                        'Pop',        'intermediate'),
      song('german-atemlos',          'Atemlos Durch die Nacht','Helene Fischer',               'Schlager',   'advanced'),
      song('german-auf-uns',          'Auf Uns',                'Andreas Bourani',              'Pop',        'intermediate'),
      song('german-irgendwie',        'Irgendwie, Irgendwo',    'Nena',                         'Pop',        'advanced'),
      song('german-ich-will',         'Ich Will',               'Rammstein',                    'Metal',      'intermediate'),
      song('german-der-kommissar',    'Der Kommissar',          'Falco',                        'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'italian',
    songs: [
      song('italian-volare',          'Volare (Nel Blu Dipinto di Blu)', 'Domenico Modugno',    'Pop',        'beginner'),
      song('italian-azzurro',         'Azzurro',                'Adriano Celentano',            'Pop',        'intermediate'),
      song('italian-bella-ciao',      'Bella Ciao',             'Traditional',                  'Folk',       'beginner'),
      song('italian-con-te-partiro',  'Con Te Partirò',         'Andrea Bocelli',               'Opera-Pop',  'intermediate'),
      song('italian-felicita',        'Felicità',               'Al Bano & Romina Power',       'Pop',        'intermediate'),
      song('italian-lestate',         "L'Estate",               'Bruno Martino',                'Jazz',       'advanced'),
      song('italian-romagna-mia',     'Romagna Mia',            'Secondo Casadei',              'Folk',       'beginner'),
      song('italian-that-amore',      "That's Amore",           'Dean Martin',                  'Pop',        'beginner'),
      song('italian-senza-fine',      'Senza Fine',             'Gino Paoli',                   'Chanson',    'advanced'),
      song('italian-grande-amore',    'Grande Amore',           "Il Volo",                      'Pop-Opera',  'intermediate'),
    ],
  },
  {
    languageSlug: 'portuguese',
    songs: [
      song('portuguese-garota',       'Garota de Ipanema',      'João Gilberto & Tom Jobim',    'Bossa Nova', 'intermediate'),
      song('portuguese-mas-que-nada', 'Mas Que Nada',           'Sérgio Mendes',                'Bossa Nova', 'intermediate'),
      song('portuguese-asa-branca',   'Asa Branca',             'Luiz Gonzaga',                 'Forró',      'intermediate'),
      song('portuguese-aquarela',     'Aquarela',               'Toquinho',                     'MPB',        'intermediate'),
      song('portuguese-estranha',     'Estranha Forma de Vida', 'Amália Rodrigues',             'Fado',       'advanced'),
      song('portuguese-chega',        'Chega de Saudade',       'João Gilberto',                'Bossa Nova', 'advanced'),
      song('portuguese-country-roads','Take Me Home Country Roads','John Denver (Portuguese cover)','Cover',   'beginner'),
      song('portuguese-forca',        'Força',                  'Nelly Furtado',                'Pop',        'beginner'),
      song('portuguese-quem-te-viu',  'Quem Te Viu, Quem Te Vê','Saudade (Traditional)',       'Fado',       'advanced'),
      song('portuguese-ai-se-eu-te',  'Ai Se Eu Te Pego',       'Michel Teló',                 'Forró',      'beginner'),
    ],
  },
  {
    languageSlug: 'dutch',
    songs: [
      song('dutch-radar-love',        'Radar Love',             'Golden Earring',               'Rock',       'beginner'),
      song('dutch-moonlight-shadow',  'Ding Dong',              'Dana Winner',                  'Pop',        'intermediate'),
      song('dutch-troubadour',        'Troubadour',             'Gerard van Maasakkers',        'Folk',       'advanced'),
      song('dutch-doris-day',         'Geef Mij Maar Amsterdam','Wim Sonneveld',                'Chanson',    'intermediate'),
      song('dutch-skater-waltz',      'Holland',                'Krezip',                       'Pop-Rock',   'intermediate'),
      song('dutch-shabba',            'Shabba',                 'Frenna ft. Ronnie Flex',       'Hip-hop',    'advanced'),
      song('dutch-hou-me-vast',       'Hou Me Vast',            'Marco Borsato',                'Pop',        'intermediate'),
      song('dutch-symphony',          'De Diepte',              'S10',                          'Pop',        'intermediate'),
      song('dutch-verliefd',          'Verliefd Op Jou',        'Soy Sauce',                    'Pop',        'beginner'),
      song('dutch-golden-earring',    'Twilight Zone',          'Golden Earring',               'Rock',       'beginner'),
    ],
  },
  {
    languageSlug: 'russian',
    songs: [
      song('russian-podmoskovnye',    'Podmoskovnye Vechera',   'Solovyov-Sedoy',               'Folk',       'intermediate'),
      song('russian-katyusha',        'Katyusha',               'Traditional',                  'Folk',       'beginner'),
      song('russian-gruppa-krovi',    'Gruppa Krovi',           'Kino (Viktor Tsoi)',            'Rock',       'advanced'),
      song('russian-chto-takoe-osen', 'Chto Takoe Osen',        'DDT',                          'Rock',       'advanced'),
      song('russian-koroleva',        'Koroleva',               'Alla Pugacheva',               'Pop',        'intermediate'),
      song('russian-kombat',          'Kombat',                 'Lyube',                        'Pop-Rock',   'intermediate'),
      song('russian-beskonechnost',   'Beskonechnost',          'Zemfira',                      'Alternative','advanced'),
      song('russian-kalinka',         'Kalinka',                'Traditional',                  'Folk',       'beginner'),
      song('russian-my-ne-stranniki', 'Stranniki',              'Nautilus Pompilius',           'Rock',       'advanced'),
      song('russian-million-alyh-roz','Million Alyh Roz',       'Alla Pugacheva',               'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'polish',
    songs: [
      song('polish-mazurek',          'Mazurek Dabrowskiego',   'Traditional (National Anthem)','Folk',       'intermediate'),
      song('polish-chlopaki-nie-placza','Chlopaki Nie Placza',  'Boys',                          'Pop',        'intermediate'),
      song('polish-jest-taka-jedna',  'Jest Taka Jedna',        'Budka Suflera',                'Rock',       'intermediate'),
      song('polish-kocham-cie',       'Kocham Cie Kochanie Moje','Wojciech Mlynarski',          'Chanson',    'advanced'),
      song('polish-smutna',           'Smutna Niedziela',       'Marek Grechuta',               'Folk-Jazz',  'advanced'),
      song('polish-gdzie-jest-bialy', 'Gdzie Jest Bialy Krolik','Dzem',                        'Blues',      'advanced'),
      song('polish-dywizjon-303',     'Dywizjon 303',           'Czeslav Niemen',               'Rock',       'advanced'),
      song('polish-jesien',           'Jesien',                 'Anna Maria Jopek',             'Jazz',       'advanced'),
      song('polish-byle-bylo',        'Byle Bylo So',           'Dawid Podsiadlo',              'Pop',        'intermediate'),
      song('polish-te-dni',           'Te Dni',                 'Natalia Kukulska',             'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'czech',
    songs: [
      song('czech-skoda-lasky',       'Skoda Lasky (Roll Out the Barrel)','Traditional',        'Folk',       'beginner'),
      song('czech-doma-doma',         'Doma, Doma',             'Lucie Bila',                   'Pop',        'intermediate'),
      song('czech-holka-modrooka',    'Holka Modrooka',         'Traditional',                  'Folk',       'beginner'),
      song('czech-somewhere-over',    'Znovu Budem Zpivat',     'Karel Gott',                   'Pop',        'intermediate'),
      song('czech-lady-carneval',     'Lady Carneval',          'Olympic',                      'Rock',       'intermediate'),
      song('czech-laska',             'Laska Je Laska',         'Marie Rottrova',               'Pop',        'intermediate'),
      song('czech-ta-nasa',           'Ta Nasa Piesen',         'Dechova Hudba',                'Folk',       'beginner'),
      song('czech-ohen',              'Ohen a Led',             'Kabat',                        'Rock',       'advanced'),
      song('czech-hej-jude',          'Bratri (Brothers)',      'Chinaski',                    'Pop',        'intermediate'),
      song('czech-mam-te-rada',       'Mam Te Rada',            'Lenka Filipova',               'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'swedish',
    songs: [
      song('swedish-dancing-queen',   'Dancing Queen',          'ABBA',                         'Pop',        'beginner'),
      song('swedish-mamma-mia',       'Mamma Mia',              'ABBA',                         'Pop',        'beginner'),
      song('swedish-waterloo',        'Waterloo',               'ABBA',                         'Pop',        'beginner'),
      song('swedish-the-winner',      'The Winner Takes It All', 'ABBA',                        'Pop',        'intermediate'),
      song('swedish-anglagard',       'Änglagård',              'Roxette',                      'Pop',        'intermediate'),
      song('swedish-listen-to-heart', 'Listen to Your Heart',   'Roxette',                      'Pop',        'beginner'),
      song('swedish-sverige',         'Sverige',                'Robyn',                        'Pop',        'intermediate'),
      song('swedish-with-every-heartbeat','With Every Heartbeat','Robyn',                       'Synth-pop',  'intermediate'),
      song('swedish-de-la',           'De La',                  'Veronica Maggio',              'Pop',        'advanced'),
      song('swedish-visa-pa-mallorca','Visa Pa Mallorca',       'Traditional',                  'Folk',       'beginner'),
    ],
  },
  {
    languageSlug: 'norwegian',
    songs: [
      song('norwegian-take-on-me',    'Take On Me',             'a-ha',                         'Synth-pop',  'beginner'),
      song('norwegian-the-sun-always','The Sun Always Shines',  'a-ha',                         'Pop',        'beginner'),
      song('norwegian-living-daylights','Living Daylights',     'a-ha',                         'Pop',        'beginner'),
      song('norwegian-alan-walker',   'Faded',                  'Alan Walker',                  'Electronic', 'beginner'),
      song('norwegian-kygo-firestone','Firestone',              'Kygo ft. Conrad Sewell',       'Tropical House','beginner'),
      song('norwegian-ja-vi-elsker',  'Ja, Vi Elsker Dette Landet','Traditional (National Anthem)','Folk',    'intermediate'),
      song('norwegian-neste-sommer',  'Neste Sommer',           'Sigrid',                       'Pop',        'intermediate'),
      song('norwegian-mirror',        'Mirror',                 'Aurora',                       'Art-Pop',    'intermediate'),
      song('norwegian-suicidal',      'Suicidal Thoughts',      'Aurora',                       'Art-Pop',    'intermediate'),
      song('norwegian-runaway',       'Runaway',                'Aurora',                       'Art-Pop',    'advanced'),
    ],
  },
  {
    languageSlug: 'danish',
    songs: [
      song('danish-barbie-girl',      'Barbie Girl',            'Aqua',                         'Eurodance',  'beginner'),
      song('danish-dr-jones',         'Dr. Jones',              'Aqua',                         'Pop',        'beginner'),
      song('danish-whigfield',        'Saturday Night',         'Whigfield',                    'Eurodance',  'beginner'),
      song('danish-lukas-graham',     '7 Years',                'Lukas Graham',                 'Pop',        'intermediate'),
      song('danish-love-someone',     'Love Someone',           'Lukas Graham',                 'Pop',        'intermediate'),
      song('danish-volbeat',          'Still Counting',         'Volbeat',                      'Rock',       'advanced'),
      song('danish-michael-learns',   'Take Me to Your Heart',  'Michael Learns to Rock',       'Pop',        'beginner'),
      song('danish-medina-forever',   'Kun For Mig',            'Medina',                       'Pop',        'intermediate'),
      song('danish-nik-og-jay',       'Hun Er Ej',              'Nik & Jay',                    'Pop',        'intermediate'),
      song('danish-carl-nielsen',     'Fynsk Forar (Spring)',   'Carl Nielsen',                 'Classical',  'advanced'),
    ],
  },
  {
    languageSlug: 'finnish',
    songs: [
      song('finnish-ievan-polkka',    'Ievan Polkka',           'Loituma',                      'Folk',       'intermediate'),
      song('finnish-tahdon',          'Tahdon (I Do)',           'Anna Abreu',                   'Pop',        'intermediate'),
      song('finnish-finlandia',       'Finlandia',              'Jean Sibelius',                'Classical',  'advanced'),
      song('finnish-lordi',           'Hard Rock Hallelujah',   'Lordi',                        'Hard Rock',  'intermediate'),
      song('finnish-haloo-helsinki',  'Baarimagneeetti',        'Haloo Helsinki!',              'Pop-Rock',   'advanced'),
      song('finnish-pmmp',            'Lautturi',               'PMMP',                         'Pop',        'advanced'),
      song('finnish-sunrise-avenue',  'Forever Yours',          'Sunrise Avenue',               'Pop-Rock',   'intermediate'),
      song('finnish-nightwish',       'Wish I Had an Angel',    'Nightwish',                    'Symphonic Metal','intermediate'),
      song('finnish-kemopetrol',      'Enemman kuin ennen',     'Kemopetrol',                   'Pop',        'advanced'),
      song('finnish-him',             'Vaiettu Kaupunki',       'HIM',                          'Gothic Rock','advanced'),
    ],
  },
  {
    languageSlug: 'greek',
    songs: [
      song('greek-zorba',             "Zorba's Dance (Sirtaki)", 'Mikis Theodorakis',            'Folk',       'beginner'),
      song('greek-misirlou',          'Misirlou',               'Traditional / Dick Dale',      'Folk',       'beginner'),
      song('greek-never-on-sunday',   'Never on Sunday',        'Manos Hadjidakis',             'Pop',        'intermediate'),
      song('greek-perase-ki-autos',   'Perase Ki Autos o Kairos','Vasilis Papakonstantinou',    'Rock',       'intermediate'),
      song('greek-stamatis',          'To Dentro',              'Stamatis Kokotas',             'Laika',      'intermediate'),
      song('greek-eleftheria',        'S Agapo',                'Eleftheria Arvanitaki',        'Pop',        'intermediate'),
      song('greek-yiannis',           'An Eisai Endaxi',        'Yiannis Haroulis',             'Folk',       'advanced'),
      song('greek-helena-paparizou',  'My Number One',          'Helena Paparizou',             'Pop',        'beginner'),
      song('greek-kalimera',          'Kalimera',               'Goran Bregovic',               'World',      'beginner'),
      song('greek-stelios',           'Agaph Einai',            'Stelios Kazantzidis',          'Laika',      'advanced'),
    ],
  },
  {
    languageSlug: 'turkish',
    songs: [
      song('turkish-istanbul',        'Istanbul (Not Constantinople)', 'They Might Be Giants',  'Alt-Rock',   'beginner'),
      song('turkish-simarik',         'Simarik (Kiss Kiss)',    'Tarkan',                       'Pop',        'intermediate'),
      song('turkish-almali-elma',     'Elmali Elma',            'Sezen Aksu',                   'Pop',        'advanced'),
      song('turkish-gesi-baglari',    'Gesi Baglari',           'Traditional',                  'Folk',       'beginner'),
      song('turkish-sen-olsan-bari',  'Sen Olsan Bari',         'Muzeyyen Senar',               'Arabesk',    'advanced'),
      song('turkish-firuze',          'Firuze',                 'Zeki Muren',                   'Classical',  'advanced'),
      song('turkish-dogru-bildigim',  'Dogru Bildigim',         'Sertab Erener',                'Pop',        'intermediate'),
      song('turkish-hadise',          'Dum Tek Tek',            'Hadise',                       'Pop',        'intermediate'),
      song('turkish-athena',          'Duduk Caliyor',          'Athena',                       'Ska-Punk',   'advanced'),
      song('turkish-kurtlar',         'Mavi Mavi',              'Sezen Aksu',                   'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'arabic',
    songs: [
      song('arabic-nur-al-ain',       'Nour El Ain',            'Amr Diab',                     'Arabic Pop', 'intermediate'),
      song('arabic-nassam-alayna',    'Nassam Alayna Al Hawa',  'Fairuz',                       'Chanson',    'advanced'),
      song('arabic-ya-tayr',          'Ya Tayr Ya Tayr',        'Fairuz',                       'Folk',       'intermediate'),
      song('arabic-habibi',           'Habibi Ya Nour El Ain',  'Amr Diab',                     'Pop',        'intermediate'),
      song('arabic-wana-maak',        'Wana Maak',              'Kadim Al Sahir',               'Pop',        'advanced'),
      song('arabic-enta-eih',         'Enta Eih',               'Fairuz',                       'Chanson',    'intermediate'),
      song('arabic-sahran-le-habibi', 'Sahran le Habibi',       'Warda Al-Jazairia',            'Chanson',    'advanced'),
      song('arabic-ahlan-wa-sahlan',  'Ahlan Wa Sahlan',        'Umm Kulthum',                  'Tarab',      'advanced'),
      song('arabic-ya-msafer',        'Ya Msafer Wahdak',       'Fairuz',                       'Chanson',    'intermediate'),
      song('arabic-alf-leila',        'Alf Leila wa Leila',     'Umm Kulthum',                  'Tarab',      'advanced'),
    ],
  },
  {
    languageSlug: 'hebrew',
    songs: [
      song('hebrew-hatikvah',         'Hatikvah',               'Traditional (National Anthem)','Folk',       'intermediate'),
      song('hebrew-yerushalayim',     'Yerushalayim Shel Zahav','Naomi Shemer',                 'Folk',       'intermediate'),
      song('hebrew-hine-ma-tov',      'Hineh Ma Tov',           'Traditional',                  'Folk',       'beginner'),
      song('hebrew-dana-intl',        'Diva',                   'Dana International',           'Pop',        'intermediate'),
      song('hebrew-ofra-haza',        'Im Nin\'alu',            'Ofra Haza',                    'World Pop',  'advanced'),
      song('hebrew-subliminal',       'Mifleget Ha-Tzelalim',   'Subliminal',                   'Hip-hop',    'advanced'),
      song('hebrew-static-ben-el',    'Rosh BaAnan',            'Static & Ben El',              'Pop',        'intermediate'),
      song('hebrew-omer-adam',        'Mi Yiten',               'Omer Adam',                    'Pop',        'intermediate'),
      song('hebrew-koolulam',         'Acharei HaChagim',       'Koolulam',                     'Choral',     'advanced'),
      song('hebrew-david-broza',      'Yihye Tov',              'David Broza',                  'Folk-Rock',  'advanced'),
    ],
  },
  {
    languageSlug: 'persian',
    songs: [
      song('persian-googoosh',        'Gharib Ashena',          'Googoosh',                     'Pop',        'intermediate'),
      song('persian-gole-sorkh',      'Gole Sorkh',             'Mohammad Reza Shajarian',      'Classical',  'advanced'),
      song('persian-hamsafar',        'Hamsafar',               'Googoosh',                     'Pop',        'intermediate'),
      song('persian-bia-bia',         'Bia Bia',                'Sattar',                       'Pop',        'intermediate'),
      song('persian-del-tangam',      'Del Tangam',             'Fereydoun Asraei',             'Folk',       'advanced'),
      song('persian-ay-iran',         'Ay Iran',                'Traditional',                  'Patriotic',  'intermediate'),
      song('persian-ey-iran',         'Ey Iran',                'Traditional',                  'Patriotic',  'intermediate'),
      song('persian-ebi-gole-yakh',   'Gole Yakh',              'Ebi',                          'Pop',        'intermediate'),
      song('persian-darya',           'Darya',                  'Shadmehr Aghili',              'Pop',        'intermediate'),
      song('persian-hayedeh',         'Mara Beboos',            'Hayedeh',                      'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'hindi',
    songs: [
      song('hindi-chaiyya-chaiyya',   'Chaiyya Chaiyya',        'AR Rahman',                    'Filmi',      'intermediate'),
      song('hindi-jai-ho',            'Jai Ho',                 'AR Rahman',                    'Filmi',      'beginner'),
      song('hindi-lag-ja-gale',       'Lag Ja Gale',            'Lata Mangeshkar',              'Filmi',      'intermediate'),
      song('hindi-mere-sapno-ki',     'Mere Sapno Ki Rani',     'Kishore Kumar',                'Filmi',      'intermediate'),
      song('hindi-vande-mataram',     'Vande Mataram',          'AR Rahman',                    'Patriotic',  'intermediate'),
      song('hindi-tum-hi-ho',         'Tum Hi Ho',              'Arijit Singh',                 'Filmi',      'beginner'),
      song('hindi-ek-pyaar',          'Ek Pyaar Ka Nagma',      'Lata Mangeshkar',              'Filmi',      'intermediate'),
      song('hindi-dil-se-re',         'Dil Se Re',              'AR Rahman',                    'Filmi',      'advanced'),
      song('hindi-abhi-na-jao',       'Abhi Na Jao Chhod Kar',  'Mohammad Rafi',                'Filmi',      'advanced'),
      song('hindi-gerua',             'Gerua',                  'Arijit Singh',                 'Filmi',      'intermediate'),
    ],
  },
  {
    languageSlug: 'urdu',
    songs: [
      song('urdu-coke-studio',        'Pasoori',                'Ali Sethi & Shae Gill',        'Folk-Fusion', 'intermediate'),
      song('urdu-atif-aslam',         'Teri Yaad',              'Atif Aslam',                   'Pop',        'intermediate'),
      song('urdu-maahi-ve',           'Maahi Ve',               'Ustad Nusrat Fateh Ali Khan',  'Qawwali',    'advanced'),
      song('urdu-abida-parveen',      'Tere Ishq Nachaya',      'Abida Parveen',                'Sufi',       'advanced'),
      song('urdu-junoon-sayonee',     'Sayonee',                'Junoon',                       'Sufi Rock',  'intermediate'),
      song('urdu-nfak-dam-mast',      'Dam Mast Qalandar',      'Nusrat Fateh Ali Khan',        'Qawwali',    'advanced'),
      song('urdu-rahat-tere-mast',    'Tere Mast Mast Do Nain', 'Rahat Fateh Ali Khan',        'Pop-Sufi',   'intermediate'),
      song('urdu-ali-zafar',          'Chan Kithan Guzari',     'Ali Zafar',                    'Pop',        'intermediate'),
      song('urdu-strings-duur',       'Duur',                   'Strings',                      'Rock',       'intermediate'),
      song('urdu-nazia-hassan',       'Disco Deewane',          'Nazia Hassan',                 'Pop',        'beginner'),
    ],
  },
  {
    languageSlug: 'bengali',
    songs: [
      song('bengali-amar-sonar',      'Amar Sonar Bangla',      'Rabindranath Tagore',          'Folk',       'intermediate'),
      song('bengali-ekla-cholo',      'Ekla Cholo Re',          'Rabindranath Tagore',          'Folk',       'intermediate'),
      song('bengali-shona-bondhu',    'Shona Bondhu',           'Traditional',                  'Baul',       'advanced'),
      song('bengali-o-amar-desher',   'O Amar Desher Mati',     'Rabindranath Tagore',          'Folk',       'intermediate'),
      song('bengali-moner-manush',    'Maner Manush',           'Traditional Baul',             'Baul',       'advanced'),
      song('bengali-habib-wahid',     'Kale Kale',              'Habib Wahid',                  'Folk-Pop',   'intermediate'),
      song('bengali-anupam',          'Haway Bheshe Jai',       'Anupam Roy',                   'Indie',      'advanced'),
      song('bengali-emon-khan',       'Mukhosh',                'Emon Khan',                    'Folk',       'intermediate'),
      song('bengali-closure',         'Tumi Robe Nirobe',       'Rabindranath Tagore',          'Rabindra Sangeet','intermediate'),
      song('bengali-james',           'Bheegi Bheegi',          'James (Bangladesh)',            'Rock',       'intermediate'),
    ],
  },
  {
    languageSlug: 'punjabi',
    songs: [
      song('punjabi-balle-balle',     'Balle Balle',            'Traditional',                  'Bhangra',    'beginner'),
      song('punjabi-diljit-dosanjh',  'Lover',                  'Diljit Dosanjh',               'Pop',        'intermediate'),
      song('punjabi-mundian-to',      'Mundian To Bach Ke',     'Panjabi MC',                   'Bhangra',    'intermediate'),
      song('punjabi-tunak-tunak',     'Tunak Tunak Tun',        'Daler Mehndi',                 'Bhangra',    'beginner'),
      song('punjabi-ikk-kudi',        'Ikk Kudi',               'Diljit Dosanjh',               'Indie',      'intermediate'),
      song('punjabi-gur-nalo',        'Gur Nalo Ishq Mitha',    'Traditional',                  'Folk',       'advanced'),
      song('punjabi-ik-vaari-aa',     'Ik Vaari Aa',            'Arijit Singh',                 'Filmi',      'intermediate'),
      song('punjabi-laung-laachi',    'Laung Laachi',           'Mannat Noor',                  'Bhangra-Pop','intermediate'),
      song('punjabi-lamberghini',     'Lamberghini',            'The Doorbeen ft. Ragini',      'Pop',        'intermediate'),
      song('punjabi-surma',           'Surma',                  'Harbhajan Shera',              'Folk',       'advanced'),
    ],
  },
  {
    languageSlug: 'gujarati',
    songs: [
      song('gujarati-garba',          'Garba (Navratri Traditional)', 'Various Artists',        'Folk',       'intermediate'),
      song('gujarati-chel-chabilo',   'Chel Chabilo',           'Traditional',                  'Folk',       'beginner'),
      song('gujarati-fagan-ni-ra',    'Fagan Ni Ratde',         'Traditional Holi Song',        'Folk',       'intermediate'),
      song('gujarati-jalso',          'Jalso',                  'Osman Mir',                    'Folk',       'advanced'),
      song('gujarati-vagad-ni-maa',   'Vagad Ni Maa',           'Hemant Chauhan',               'Devotional', 'intermediate'),
      song('gujarati-tame-vana',      'Tame Vana Na Vela',      'Traditional',                  'Folk',       'intermediate'),
      song('gujarati-gher-shiree',    'Gher Shiree',            'Traditional',                  'Folk',       'beginner'),
      song('gujarati-darshna',        'Darshna Ne Tara Ras',    'Aishwarya Majmudar',           'Classical',  'advanced'),
      song('gujarati-ae-to-game',     'Ae To Game Bau',         'Kirtidan Gadhvi',              'Folk-Pop',   'intermediate'),
      song('gujarati-mari-bhabhi',    'Mari Bhabhi',            'Traditional',                  'Folk',       'beginner'),
    ],
  },
  {
    languageSlug: 'marathi',
    songs: [
      song('marathi-jai-jai',         'Jai Jai Maharashtra Majha', 'Traditional',               'Patriotic',  'intermediate'),
      song('marathi-yad-lagla',       'Yad Lagla',              'Swapnil Bandodkar',            'Folk-Pop',   'intermediate'),
      song('marathi-kombdi-palali',   'Kombdi Palali',          'Traditional',                  'Folk',       'beginner'),
      song('marathi-vaat-pahu-di',    'Vaat Pahu Di',           'Ajay-Atul',                    'Film',       'intermediate'),
      song('marathi-sai-baba',        'Sai Baba',               'Shankar Mahadevan',            'Devotional', 'intermediate'),
      song('marathi-aika-dajiba',     'Aika Dajiba',            'Traditional',                  'Folk',       'beginner'),
      song('marathi-zingaat',         'Zingaat',                'Ajay-Atul',                    'Film',       'intermediate'),
      song('marathi-mauli',           'Mauli Mauli',            'Traditional',                  'Devotional', 'beginner'),
      song('marathi-natali-chandra',  'Natali Chandra',         'Traditional',                  'Folk',       'intermediate'),
      song('marathi-pita',            'Pita',                   'Baban Ghule',                  'Folk',       'intermediate'),
    ],
  },
  {
    languageSlug: 'tamil',
    songs: [
      song('tamil-kannazhaga',        'Kannazhaga',             'AR Rahman',                    'Filmi',      'intermediate'),
      song('tamil-munbe-va',          'Munbe Vaa',              'Harris Jayaraj',               'Filmi',      'intermediate'),
      song('tamil-rowdy-baby',        'Rowdy Baby',             'Yuvan Shankar Raja',           'Filmi',      'intermediate'),
      song('tamil-manjal-veyil',      'Manjal Veyil',           'Yuvan Shankar Raja',           'Filmi',      'advanced'),
      song('tamil-en-iniya-pon',      'En Iniya Pon Nilave',    'Ilayaraja',                    'Filmi',      'advanced'),
      song('tamil-vinnaithaandi',     'Vinnaithaandi Varuvaya', 'AR Rahman',                    'Filmi',      'intermediate'),
      song('tamil-poo-pookum',        'Poo Pookum Osai',        'Ilayaraja',                    'Folk',       'intermediate'),
      song('tamil-thillana',          'Thillana (Classical)',   'Traditional',                  'Classical',  'advanced'),
      song('tamil-ilamai',            'Ilamai Idho Idho',       'Ilayaraja',                    'Filmi',      'intermediate'),
      song('tamil-kanmani',           'Kanmani Anbodu',         'Ilayaraja',                    'Filmi',      'intermediate'),
    ],
  },
  {
    languageSlug: 'telugu',
    songs: [
      song('telugu-naatu-naatu',      'Naatu Naatu',            'MM Keeravani',                 'Filmi',      'intermediate'),
      song('telugu-samajavaragamana', 'Samajavaragamana',       'Sid Sriram',                   'Filmi',      'intermediate'),
      song('telugu-manase-manase',    'Manase Manase',          'SP Balasubrahmanyam',          'Filmi',      'advanced'),
      song('telugu-o-pilla',          'O Pilla',                'Ravi Teja',                    'Filmi',      'intermediate'),
      song('telugu-nuvve-nuvve',      'Nuvve Nuvve',            'Thaman S',                     'Filmi',      'intermediate'),
      song('telugu-khaleja',          'Jalsa Jalsa',            'Devi Sri Prasad',              'Filmi',      'beginner'),
      song('telugu-ye-maya',          'Ye Maya Chesave',        'AR Rahman',                    'Filmi',      'advanced'),
      song('telugu-srivalli',         'Srivalli',               'Devi Sri Prasad',              'Filmi',      'intermediate'),
      song('telugu-buttabomma',       'Buttabomma',             'Armaan Malik',                 'Filmi',      'intermediate'),
      song('telugu-kana-kannu',       'Kana Kannu Chudalenu',   'SP Balasubrahmanyam',          'Filmi',      'advanced'),
    ],
  },
  {
    languageSlug: 'kannada',
    songs: [
      song('kannada-bombe-heluthaite','Bombe Heluthaite',       'Rajkumar',                     'Filmi',      'intermediate'),
      song('kannada-yaarukku',        'Yaarukku Yaarukku',      'SPB & KS Chitra',              'Filmi',      'intermediate'),
      song('kannada-huttidare',       'Huttidare Kannada Nadu', 'Rajkumar',                     'Patriotic',  'intermediate'),
      song('kannada-raate-la',        'Raate La',               'Armaan Malik',                 'Filmi',      'intermediate'),
      song('kannada-tum-tum',         'Tum Tum',                'Ananya Bhat',                  'Pop',        'intermediate'),
      song('kannada-toofan',          'Toofan',                 'Vijay Prakash',                'Filmi',      'intermediate'),
      song('kannada-bannada-hakkiya', 'Bannada Hakkiya',        'Traditional',                  'Folk',       'beginner'),
      song('kannada-nanu-nanna',      'Nanu Nanna Kavanave',    'SP Balasubrahmanyam',          'Filmi',      'advanced'),
      song('kannada-kgf-salaam',      'Salaam Rocky Bhai',      'Ravi Basrur',                  'Filmi',      'intermediate'),
      song('kannada-yella-nanna',     'Yella Nanna Deva',       'Traditional Devotional',       'Devotional', 'intermediate'),
    ],
  },
  {
    languageSlug: 'malayalam',
    songs: [
      song('malayalam-entammede',     'Entammede Jimikki Kammal','Vineeth Sreenivasan',         'Folk-Pop',   'intermediate'),
      song('malayalam-oru-adaar',     'Oru Adaar Love',         'Shaan Rahman',                 'Filmi',      'intermediate'),
      song('malayalam-malare',        'Malare',                 'Vijay Yesudas',                'Filmi',      'intermediate'),
      song('malayalam-kaithapram',    'Kaithapram',             'Kaithapram Damodaran Namboothiri','Classical','advanced'),
      song('malayalam-chandanamazha', 'Chandanamazha',          'KJ Yesudas',                   'Filmi',      'intermediate'),
      song('malayalam-salam',         'Salam Bombay',           'Ilaiyaraaja',                  'Filmi',      'intermediate'),
      song('malayalam-thumbi',        'Thumbi Vaa',             'Yuvan Shankar Raja',           'Filmi',      'intermediate'),
      song('malayalam-innale',        'Innale',                 'Vidyasagar',                   'Filmi',      'advanced'),
      song('malayalam-manikya',       'Manikya Malaraya Poovi', 'Traditional',                  'Folk',       'intermediate'),
      song('malayalam-kerala-piravi', 'Kerala Piravi',          'Traditional',                  'Patriotic',  'intermediate'),
    ],
  },
  {
    languageSlug: 'mandarin',
    songs: [
      song('mandarin-yueliang',       'Yueliang Daibiao Wo De Xin','Teresa Teng',              'Pop',        'beginner'),
      song('mandarin-tian-mi-mi',     'Tian Mi Mi',             'Teresa Teng',                  'Pop',        'intermediate'),
      song('mandarin-chengdu',        'Chengdu',                'Zhao Lei',                     'Folk-Pop',   'intermediate'),
      song('mandarin-qilixiang',      'Qili Xiang',             'Jay Chou',                     'R&B',        'advanced'),
      song('mandarin-tong-hua',       'Tong Hua',               'Guang Liang',                  'Pop',        'intermediate'),
      song('mandarin-nv-ren-hua',     'Nu Ren Hua',             'Zhang Huimei',                 'Pop',        'intermediate'),
      song('mandarin-you-mei-you',    'You Mei You Ren',        'Lo Ta-yu',                     'Folk-Rock',  'advanced'),
      song('mandarin-beijing',        'Beijing, Beijing',       'Wang Feng',                    'Rock',       'advanced'),
      song('mandarin-gu-niang',       'Gu Niang',               'Wang Feng',                    'Rock',       'advanced'),
      song('mandarin-fang-shou',      'Fang Shou',              'Eason Chan',                   'Cantopop',   'advanced'),
    ],
  },
  {
    languageSlug: 'cantonese',
    songs: [
      song('cantonese-gongzhu',       'Gongzhu (Princess)',     'Faye Wong',                    'Pop',        'intermediate'),
      song('cantonese-meng-zhong-ren','Meng Zhong Ren',         'Anita Mui',                    'Pop',        'intermediate'),
      song('cantonese-nan-er',        'Nan Er Dang Zi Qiang',   'George Lam',                   'Film',       'advanced'),
      song('cantonese-sally-yeh',     'Qian Qian Que Ge',       'Sally Yeh',                    'Pop',        'intermediate'),
      song('cantonese-leslie',        'Tong Ai',                'Leslie Cheung',                'Pop',        'intermediate'),
      song('cantonese-jackie-chan',   'Nan Er Zhi Zai Sifang',  'Jackie Chan',                  'Film',       'intermediate'),
      song('cantonese-beyond',        'Hai Kuo Tian Kong',      'Beyond',                       'Rock',       'intermediate'),
      song('cantonese-sandy-lam',     'Yi Wo Qing Shen',        'Sandy Lam',                    'Pop',        'intermediate'),
      song('cantonese-eason-chan',     'Fu Mu',                  'Eason Chan',                   'Pop',        'advanced'),
      song('cantonese-hacken-lee',    'Ji Mo Nan Nai',          'Hacken Lee',                   'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'japanese',
    songs: [
      song('japanese-sukiyaki',       'Ue wo Muite Aruko (Sukiyaki)','Kyu Sakamoto',            'Pop',        'beginner'),
      song('japanese-lemon',          'Lemon',                  'Kenshi Yonezu',                'J-Pop',      'intermediate'),
      song('japanese-pretender',      'Pretender',              'Official HIGE DANdism',        'J-Pop',      'intermediate'),
      song('japanese-gurenge',        'Gurenge',                'LiSA',                         'Anime',      'intermediate'),
      song('japanese-paprika',        'Paprika',                'Foorin',                       'J-Pop',      'beginner'),
      song('japanese-koi',            'Koi',                    'Gen Hoshino',                  'J-Pop',      'intermediate'),
      song('japanese-dragon-night',   'Dragon Night',           'SEKAI NO OWARI',               'J-Pop',      'intermediate'),
      song('japanese-furusato',       'Furusato',               'Traditional',                  'Folk',       'intermediate'),
      song('japanese-sakura',         'Sakura',                 'Naotaro Moriyama',             'J-Pop',      'intermediate'),
      song('japanese-kiseki',         'Kiseki',                 'GReeeeN',                      'J-Pop',      'intermediate'),
    ],
  },
  {
    languageSlug: 'korean',
    songs: [
      song('korean-gangnam-style',    'Gangnam Style',          'PSY',                          'K-Pop',      'beginner'),
      song('korean-dynamite',         'Dynamite',               'BTS',                          'K-Pop',      'beginner'),
      song('korean-spring-day',       'Spring Day',             'BTS',                          'K-Pop',      'intermediate'),
      song('korean-boombayah',        'BOOMBAYAH',              'BLACKPINK',                    'K-Pop',      'intermediate'),
      song('korean-gee',              'Gee',                    'Girls Generation (SNSD)',      'K-Pop',      'beginner'),
      song('korean-haru-haru',        'Haru Haru (Day by Day)', 'BIGBANG',                      'K-Pop',      'intermediate'),
      song('korean-growl',            'Growl',                  'EXO',                          'K-Pop',      'intermediate'),
      song('korean-sorry-sorry',      'Sorry Sorry',            'Super Junior',                 'K-Pop',      'intermediate'),
      song('korean-bboom-bboom',      'BBoom BBoom',            'MOMOLAND',                     'K-Pop',      'beginner'),
      song('korean-taeyeon-i',        'I',                      'Taeyeon',                      'K-Pop',      'intermediate'),
    ],
  },
  {
    languageSlug: 'vietnamese',
    songs: [
      song('vietnamese-em-oi-ha-noi', 'Em Oi Ha Noi Pho',      'Phuong Thanh',                 'Pop',        'advanced'),
      song('vietnamese-mot-coi-di-ve','Mot Coi Di Ve',          'Trinh Cong Son',               'Folk',       'advanced'),
      song('vietnamese-tinh-nho',     'Tinh Nho',               'Khanh Ly',                     'Chanson',    'advanced'),
      song('vietnamese-du-say',       'Du Say Van Nho Duong Ve','Various',                      'Pop',        'intermediate'),
      song('vietnamese-lien-khuc',    'Lien Khuc Dan Ca',       'Traditional',                  'Folk',       'intermediate'),
      song('vietnamese-bong-hong',    'Bong Hong Cai Ao',       'Traditional',                  'Folk',       'intermediate'),
      song('vietnamese-nhu-canh-vac', 'Nhu Canh Vac Bay',       'Le Thu',                       'Chanson',    'advanced'),
      song('vietnamese-bao-gio',      'Bao Gio Tro Lai',        'Trinh Cong Son',               'Folk',       'advanced'),
      song('vietnamese-nu-cuoi',      'Nu Cuoi',                'My Tam',                       'Pop',        'intermediate'),
      song('vietnamese-lac-troi',     'Lac Troi',               'Son Tung M-TP',                'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'thai',
    songs: [
      song('thai-ruang-khong',        'Ruang Khong Khon Joy',   'Pongsit Kampee',               'Phleng Phuea Chiwit','advanced'),
      song('thai-rak-thae-thae',      'Rak Thae Thae',          'Bird Thongchai',               'Pop',        'intermediate'),
      song('thai-kho-thod',           'Kho Thod',               'Golf - Mike',                  'Pop',        'intermediate'),
      song('thai-pleng-chart',        'Pleng Chart Thai',       'Traditional',                  'Folk',       'intermediate'),
      song('thai-one-2-three',        'One 2 Three',            '4EVE',                         'T-Pop',      'intermediate'),
      song('thai-muen-mai-chai',      'Muen Mai Chai Yak Rong Hai','Palaphol Suwansilp',        'Country',    'advanced'),
      song('thai-siang-plao',         'Siang Plao Plao',        'Ink Waruntorn',                'Pop',        'intermediate'),
      song('thai-gun-mai',            'Gun Mai',                'Jannine Weigel',               'Pop',        'beginner'),
      song('thai-wai-krun',           'Wai Kru Song',           'Traditional',                  'Folk',       'beginner'),
      song('thai-tawan',              'Tawan',                  'Carabao',                      'Phleng Phuea Chiwit','advanced'),
    ],
  },
  {
    languageSlug: 'indonesian',
    songs: [
      song('indonesian-bento',        'Bento',                  'Iwan Fals',                    'Rock',       'advanced'),
      song('indonesian-andai-ku-tahu','Andai Ku Tahu',          'Ungu',                         'Pop',        'intermediate'),
      song('indonesian-pelangi',      'Pelangi Pelangi',        'Traditional',                  'Folk',       'beginner'),
      song('indonesian-rasa-sayange', 'Rasa Sayange',           'Traditional',                  'Folk',       'beginner'),
      song('indonesian-cicak',        'Cicak di Dinding',       'Traditional',                  'Children',   'beginner'),
      song('indonesian-kotak',        'Tinggalkan Saja',        'Kotak',                        'Rock',       'intermediate'),
      song('indonesian-noah',         'Separuh Aku',            'Noah (Peterpan)',               'Pop-Rock',   'intermediate'),
      song('indonesian-sheila-on-7',  'Dan',                    'Sheila on 7',                  'Pop',        'intermediate'),
      song('indonesian-raisa',        'Kali Kedua',             'Raisa',                        'Pop',        'intermediate'),
      song('indonesian-nadin-amizah', 'Bertaut',                'Nadin Amizah',                 'Indie',      'advanced'),
    ],
  },
  {
    languageSlug: 'malay',
    songs: [
      song('malay-warisan',           'Warisan',                'Sudirman',                     'Pop',        'intermediate'),
      song('malay-sejati',            'Sejati',                 'Sheila Majid',                 'Pop-Jazz',   'advanced'),
      song('malay-balik-kampung',     'Balik Kampung',          'Sudirman',                     'Pop',        'intermediate'),
      song('malay-di-mana-kan',       'Di Mana Kan Ku Cari Ganti','Ramlah Ram',                'Pop',        'intermediate'),
      song('malay-cinta',             'Cinta',                  'Siti Nurhaliza',               'Pop',        'intermediate'),
      song('malay-hari-raya',         'Selamat Hari Raya',      'Traditional',                  'Folk',       'beginner'),
      song('malay-hujan',             'Suatu Masa',             'Hujan',                        'Rock',       'intermediate'),
      song('malay-yuna-terukir',      'Terukir Di Bintang',     'Yuna',                         'Pop',        'intermediate'),
      song('malay-lagu-untukmu',      'Lagu Untukmu',           'Exist',                        'Pop-Rock',   'intermediate'),
      song('malay-negaraku',          'Negaraku',               'Traditional (National Anthem)','Patriotic',  'intermediate'),
    ],
  },
  {
    languageSlug: 'tagalog',
    songs: [
      song('tagalog-dahil-sa-iyo',    'Dahil Sa Iyo',           'Traditional',                  'Kundiman',   'intermediate'),
      song('tagalog-bayan-ko',        'Bayan Ko',               'Traditional',                  'Folk',       'intermediate'),
      song('tagalog-ikaw',            'Ikaw',                   'Yeng Constantino',             'Pop',        'intermediate'),
      song('tagalog-kahit-maputi',    'Kahit Maputi Na Ang Buhok Ko','Rey Valera',              'Pop',        'intermediate'),
      song('tagalog-hanggang',        'Hanggang',               'Wency Cornejo',                'Pop',        'intermediate'),
      song('tagalog-sana-maulit',     'Sana Maulit Muli',       'Gary Valenciano',              'Pop',        'intermediate'),
      song('tagalog-parokya',         'Halaga',                 'Parokya ni Edgar',             'Rock',       'advanced'),
      song('tagalog-kaibigan',        'Kaibigan',               'Rivermaya',                    'Rock',       'intermediate'),
      song('tagalog-piling-piling',   'Piling-Piling Tao',      'Apo Hiking Society',           'Folk',       'advanced'),
      song('tagalog-lupang-hinirang', 'Lupang Hinirang',        'Traditional (National Anthem)','Patriotic',  'intermediate'),
    ],
  },
  {
    languageSlug: 'swahili',
    songs: [
      song('swahili-malaika',         'Malaika',                'Miriam Makeba / Traditional',  'Folk',       'beginner'),
      song('swahili-jambo-bwana',     'Jambo Bwana',            'Them Mushrooms',               'Benga',      'beginner'),
      song('swahili-shujaa',          'Shujaa Mwenye Nguvu',    'Traditional',                  'Folk',       'intermediate'),
      song('swahili-dunia',           'Dunia Nzuri',            'John Nzenze',                  'Benga',      'intermediate'),
      song('swahili-hakuna-matata',   'Hakuna Matata',          'Solomon King',                 'Folk',       'beginner'),
      song('swahili-nakupenda',       'Nakupenda',              'Various Artists',              'Pop',        'intermediate'),
      song('swahili-mama',            'Mama',                   'Diamond Platnumz',             'Bongo Flava','intermediate'),
      song('swahili-number-one',      'Number One',             'Diamond Platnumz',             'Afropop',    'intermediate'),
      song('swahili-mbagala',         'Mbagala',                'Harmonize',                    'Bongo Flava','intermediate'),
      song('swahili-wimbo',           'Wimbo wa Taifa',         'Traditional (Kenya National Anthem)','Patriotic','intermediate'),
    ],
  },
  {
    languageSlug: 'amharic',
    songs: [
      song('amharic-tizita',          'Tizita',                 'Tilahun Gessesse',             'Traditional','advanced'),
      song('amharic-abet-abet',       'Abet Abet',              'Mahmoud Ahmed',                'Traditional','advanced'),
      song('amharic-enkutatash',      'Enkutatash',             'Traditional',                  'Folk',       'intermediate'),
      song('amharic-ethiopia',        'Ethiopia',               'Aster Aweke',                  'Pop',        'intermediate'),
      song('amharic-lij-lijoch',      'Lij Lijoch',             'Traditional',                  'Children',   'beginner'),
      song('amharic-sew-new',         'Sew New Sew',            'Hamelmal Abate',               'Pop',        'intermediate'),
      song('amharic-hagere',          'Hagere',                 'Teddy Afro',                   'Pop-Folk',   'intermediate'),
      song('amharic-tikur-sew',       'Tikur Sew',              'Teddy Afro',                   'Pop',        'advanced'),
      song('amharic-ethiopia-hoy',    'Ethiopia Hoy',           'Tsedenia Gebremarkos',         'Pop',        'intermediate'),
      song('amharic-filfil',          'Filfil',                 'Yegna',                        'Pop',        'intermediate'),
    ],
  },
  {
    languageSlug: 'yoruba',
    songs: [
      song('yoruba-je-ka-jo',         'Je Ka Jo',               'Fela Kuti',                    'Afrobeat',   'advanced'),
      song('yoruba-zombie',           'Zombie',                 'Fela Kuti',                    'Afrobeat',   'advanced'),
      song('yoruba-lady',             'Lady',                   'Fela Kuti',                    'Afrobeat',   'advanced'),
      song('yoruba-omo-obirin',       'Omo Obirin',             'King Sunny Ade',               'Juju',       'advanced'),
      song('yoruba-synchro-system',   'Synchro System',         'King Sunny Ade',               'Juju',       'advanced'),
      song('yoruba-oro-ti-won-so',    'Oro Ti Won So',          'Ebenezer Obey',                'Juju',       'advanced'),
      song('yoruba-fe-mi',            'Fe Mi',                  'Flavour ft. Femi Kuti',        'Afropop',    'intermediate'),
      song('yoruba-nobody',           'Nobody',                 'DJ Neptune ft. Laycon',        'Afropop',    'intermediate'),
      song('yoruba-omo-alhaji',       'Omo Alhaji',             'Adekunle Gold',                'Afropop',    'intermediate'),
      song('yoruba-pheelz',           'Finesse',                'Pheelz ft. BNXN',             'Afropop',    'intermediate'),
    ],
  },
  {
    languageSlug: 'igbo',
    songs: [
      song('igbo-onye-ne-enyi',       'Onye Ne Enyi',           'Traditional',                  'Folk',       'intermediate'),
      song('igbo-ije-ife',            'Ije Ife',                "Flavour N'abania",              'Afropop',    'intermediate'),
      song('igbo-nwa-baby',           'Nwa Baby',               'Flavour',                      'Afropop',    'intermediate'),
      song('igbo-chimamanda',         'Chimamanda',             'Flavour ft. Chimamanda',       'Afropop',    'intermediate'),
      song('igbo-ukwu',               'Ukwu',                   '2face Idibia',                 'Afropop',    'intermediate'),
      song('igbo-eji-owu',            'Eji Owu Aga',            'Traditional',                  'Folk',       'advanced'),
      song('igbo-igbo-kwenu',         'Igbo Kwenu',             'Traditional',                  'Folk',       'beginner'),
      song('igbo-onye-isi-ulo',       'Onye Isi Ulo',           'Traditional',                  'Folk',       'intermediate'),
      song('igbo-nne',                'Nne',                    'Kcee',                         'Afropop',    'intermediate'),
      song('igbo-agboghobiuwa',       'Agboghobiuwa',           'Flavour',                      'Afropop',    'advanced'),
    ],
  },
  {
    languageSlug: 'hausa',
    songs: [
      song('hausa-nigeriya',          'Nigeriya',               'Rarara',                       'Hausa Pop',  'intermediate'),
      song('hausa-jan-doki',          'Jan Doki',               'Ali Jita',                     'Hausa Pop',  'intermediate'),
      song('hausa-sifili',            'Sifili',                 'Mamman Shata',                 'Traditional','advanced'),
      song('hausa-ada',               'Ada',                    'Ali Jita',                     'Hausa Pop',  'intermediate'),
      song('hausa-budurwar-zuciya',   'Budurwar Zuciya',        'Rarara',                       'Hausa Pop',  'intermediate'),
      song('hausa-aure',              'Aure',                   'Hamisu Breaker',               'Hausa Pop',  'intermediate'),
      song('hausa-kalli',             'Kalli',                  'Sani Danja',                   'Hausa Pop',  'intermediate'),
      song('hausa-ta-zo',             'Ta Zo',                  'Ali Jita',                     'Hausa Pop',  'intermediate'),
      song('hausa-wata-sha-ta',       'Wata Shata',             'Traditional',                  'Folk',       'advanced'),
      song('hausa-mai-sona',          'Mai Sona',               'Rarara',                       'Hausa Pop',  'intermediate'),
    ],
  },
  {
    languageSlug: 'zulu',
    songs: [
      song('zulu-shosholoza',         'Shosholoza',             'Traditional',                  'Folk',       'beginner'),
      song('zulu-isigqi',             'Isigqi Sesimanje',       'Miriam Makeba',                'Traditional','intermediate'),
      song('zulu-ubuhle-bomhlaba',    'Ubuhle Bomhlaba',        'Ladysmith Black Mambazo',      'Isicathamiya','intermediate'),
      song('zulu-hello-my-baby',      'Hello My Baby',          'Ladysmith Black Mambazo',      'Isicathamiya','beginner'),
      song('zulu-awimbube',           'Awimbube',               'Traditional',                  'Folk',       'beginner'),
      song('zulu-bayete',             'Bayete',                 'Traditional',                  'Folk',       'intermediate'),
      song('zulu-nkosi-sikelel',      "Nkosi Sikelel' iAfrika", 'Traditional (National Anthem)','Patriotic',  'intermediate'),
      song('zulu-mtha-ndawo',         'Mthandazo',              'Joyous Celebration',           'Gospel',     'intermediate'),
      song('zulu-umqombothi',         'Umqombothi',             'Yvonne Chaka Chaka',           'Afropop',    'intermediate'),
      song('zulu-phefumula',          'Phefumula',              'Benjamin Dube',                'Gospel',     'intermediate'),
    ],
  },
  {
    languageSlug: 'afrikaans',
    songs: [
      song('afrikaans-hier-in-my-hart','Hier In My Hart',       'Kurt Darren',                  'Pop',        'intermediate'),
      song('afrikaans-de-la-rey',     'De La Rey',              'Bok van Blerk',                'Folk-Rock',  'advanced'),
      song('afrikaans-vlieg-saam',    'Vlieg Saam',             'Die Heuwels Fantasties',       'Indie',      'advanced'),
      song('afrikaans-soldate',       'Soldate',                'Bok van Blerk',                'Folk',       'advanced'),
      song('afrikaans-dis-al',        'Dis Al',                 'Mimi',                         'Pop',        'intermediate'),
      song('afrikaans-liefling',      'Liefling',               'Bles Bridges',                 'Pop',        'intermediate'),
      song('afrikaans-jan-pierewiet', 'Jan Pierewiet',          'Traditional',                  'Folk',       'beginner'),
      song('afrikaans-boland',        'Boland Nuwejaar',        'Steve Hofmeyr',                'Pop',        'intermediate'),
      song('afrikaans-sarie-marais',  'Sarie Marais',           'Traditional',                  'Folk',       'beginner'),
      song('afrikaans-halleluja',     'Halleluja',              'Karin Bloem',                  'Gospel',     'intermediate'),
    ],
  },
  {
    languageSlug: 'ukrainian',
    songs: [
      song('ukrainian-chervona-ruta', 'Chervona Ruta',          'Sophia Rotaru',                'Pop',        'intermediate'),
      song('ukrainian-stefania',      'Stefania',               'Kalush Orchestra',             'Folk-Rap',   'intermediate'),
      song('ukrainian-oi-u-luzi',     'Oi U Luzi',              'Traditional',                  'Folk',       'intermediate'),
      song('ukrainian-nichna-vidma',  'Nichna Vidma',           'Okean Elzy',                   'Rock',       'advanced'),
      song('ukrainian-vohon',         'Vohon',                  'Okean Elzy',                   'Rock',       'intermediate'),
      song('ukrainian-svitlo',        'Svitlo',                 'Go_A',                         'Electronic', 'intermediate'),
      song('ukrainian-shchedryk',     'Shchedryk (Carol of the Bells)','Traditional',          'Folk',       'beginner'),
      song('ukrainian-ne-bude',       'Ne Bude Ukrainy',        'Boombox',                      'Rock',       'advanced'),
      song('ukrainian-kvitka-dushi',  'Kvitka-Dusha',           'Traditional',                  'Folk',       'intermediate'),
      song('ukrainian-mandry',        'Scho Tebe Chekaye',      'Mandry',                       'Folk-Pop',   'advanced'),
    ],
  },
  {
    languageSlug: 'romanian',
    songs: [
      song('romanian-dragostea-din-tei','Dragostea Din Tei (Numa Numa)','O-Zone',              'Pop',        'beginner'),
      song('romanian-haiducii',       'Haiducii',               'Haiducii',                     'Pop',        'intermediate'),
      song('romanian-balada',         'Balada',                 'Ciprian Porumbescu',           'Classical',  'advanced'),
      song('romanian-mama',           'Mama',                   'Maria Tanase',                 'Folk',       'intermediate'),
      song('romanian-ciuleandra',     'Ciuleandra',             'Traditional',                  'Folk',       'intermediate'),
      song('romanian-inna-hot',       'Hot',                    'Inna',                         'Pop',        'intermediate'),
      song('romanian-alexandra-stan', 'Mr. Saxobeat',           'Alexandra Stan',               'Pop',        'beginner'),
      song('romanian-doina',          'Doina',                  'Traditional',                  'Folk',       'advanced'),
      song('romanian-sandu-ciorba',   'Ciorba de Burta',        'Sandu Ciorba',                 'Pop',        'intermediate'),
      song('romanian-cola-song',      'Cola Song',              'Inna ft. J Balvin',            'Pop',        'beginner'),
    ],
  },
  {
    languageSlug: 'hungarian',
    songs: [
      song('hungarian-gloomy-sunday', 'Gloomy Sunday (Szomoru Vasarnap)','Rezso Seress',       'Jazz',       'advanced'),
      song('hungarian-kodaly',        'Hary Janos Suite',       'Zoltan Kodaly',                'Classical',  'advanced'),
      song('hungarian-bartok',        'Romanian Folk Dances',   'Bela Bartok',                  'Classical',  'advanced'),
      song('hungarian-omega',         'Gyongyhafu Lany',        'Omega',                        'Rock',       'intermediate'),
      song('hungarian-neoton',        'Santa Maria',            'Neoton Familia',               'Pop',        'intermediate'),
      song('hungarian-republic',      'Moszkva Ter',            'Quimby',                       'Pop-Rock',   'advanced'),
      song('hungarian-pal-utcai-fik', 'Pal Utcai Fiuk (Soundtrack)','Various',                'Film',       'intermediate'),
      song('hungarian-hej-babam',     'Hej, Babam',             'Traditional',                  'Folk',       'intermediate'),
      song('hungarian-anna',          'Anna es Az Ot Fiuk',     'Ganxsta Zolee',                'Hip-hop',    'advanced'),
      song('hungarian-tisza',         'Tisza-parti Dalok',      'Traditional',                  'Folk',       'intermediate'),
    ],
  },
  {
    languageSlug: 'catalan',
    songs: [
      song('catalan-lestaca',         "L'Estaca",               'Lluis Llach',                  'Folk',       'intermediate'),
      song('catalan-el-cant',         'El Cant dels Ocells',    'Traditional / Pablo Casals',   'Classical',  'advanced'),
      song('catalan-els-segadors',    'Els Segadors',           'Traditional (National Anthem)','Folk',       'intermediate'),
      song('catalan-montserrat',      'Virolai',                'Traditional',                  'Devotional', 'advanced'),
      song('catalan-macaco',          'Rumba',                  'Macaco',                       'Rumba',      'intermediate'),
      song('catalan-mishima',         'Un Dia Perfecte',        'Mishima',                      'Indie',      'advanced'),
      song('catalan-antonia-font',    'Tren de Mitjanit',       'Antonia Font',                 'Indie',      'advanced'),
      song('catalan-au-au',           'Au, Au',                 'Joan Isaac',                   'Folk',       'intermediate'),
      song('catalan-nino-bravo',      'Libre',                  'Nino Bravo',                   'Pop',        'intermediate'),
      song('catalan-la-santa',        'Un Altre Dia',           'La Santa Espina',              'Folk',       'intermediate'),
    ],
  },
  {
    languageSlug: 'latin',
    songs: [
      song('latin-gaudeamus',         'Gaudeamus Igitur',       'Traditional',                  'Academic',   'intermediate'),
      song('latin-dies-irae',         'Dies Irae',              'Traditional (Gregorian)',       'Choral',     'advanced'),
      song('latin-panis-angelicus',   'Panis Angelicus',        'Cesar Franck',                 'Choral',     'intermediate'),
      song('latin-ave-maria',         'Ave Maria',              'Franz Schubert / Traditional', 'Classical',  'beginner'),
      song('latin-kyrie',             'Kyrie Eleison',          'Traditional (Gregorian)',       'Choral',     'intermediate'),
      song('latin-agnus-dei',         'Agnus Dei',              'Traditional',                  'Choral',     'intermediate'),
      song('latin-veni-creator',      'Veni Creator Spiritus',  'Traditional (Gregorian)',       'Choral',     'advanced'),
      song('latin-puer-natus',        'Puer Natus Est Nobis',   'Traditional',                  'Choral',     'intermediate'),
      song('latin-adeste-fideles',    'Adeste Fideles',         'Traditional',                  'Choral',     'beginner'),
      song('latin-o-fortuna',         'O Fortuna (Carmina Burana)','Carl Orff',                 'Classical',  'advanced'),
    ],
  },
  {
    languageSlug: 'esperanto',
    songs: [
      song('esperanto-la-espero',     'La Espero',              'Felicien Menu de Menil',       'Patriotic',  'intermediate'),
      song('esperanto-jam-ne',        'Jam Ne Subiras',         'Traditional',                  'Folk',       'intermediate'),
      song('esperanto-tra-la-mondo',  'Tra La Tuta Mondo',      'Traditional',                  'Folk',       'intermediate'),
      song('esperanto-mia-penso',     'Mia Penso',              'Ludwik Lazaro Zamenhof',       'Classic',    'advanced'),
      song('esperanto-verdaj-flag',   'Sub La Verda Standardo', 'Traditional',                  'Folk',       'intermediate'),
      song('esperanto-ebena-vojeto',  'Ebena Vojeto',           'Traditional',                  'Folk',       'beginner'),
      song('esperanto-manon',         'Kiel Skribe',            'Martin Kay',                   'Pop',        'intermediate'),
      song('esperanto-libera-mondo',  'Libera Mondo',           'La Perdita Generacio',         'Rock',       'advanced'),
      song('esperanto-katarina',      'Katarina',               'Various Artists',              'Pop',        'intermediate'),
      song('esperanto-birdo',         'La Birdoj',              'Traditional',                  'Folk',       'beginner'),
    ],
  },
]

// ─── Public API ──────────────────────────────────────────────────────────────

export function getSongsForLanguage(languageSlug: string): SongLink[] {
  const entry = SONGS_BY_LANGUAGE.find(l => l.languageSlug === languageSlug)
  return (entry?.songs || []).map(applyOverrides)
}

export function getAllLanguageSongs(): LanguageSongs[] {
  return SONGS_BY_LANGUAGE.map(l => ({
    ...l,
    songs: l.songs.map(applyOverrides),
  }))
}

// ─── Bulk URL patcher — paste real URLs here ──────────────────────────────
// Example:
//   patchSongUrls('japanese-lemon', {
//     spotifyUrl: 'https://open.spotify.com/track/6RRNNciQGZEXnqk8SQ9yv5',
//     youtubeUrl: 'https://www.youtube.com/watch?v=SX_ViT4Ra7k',
//   })
