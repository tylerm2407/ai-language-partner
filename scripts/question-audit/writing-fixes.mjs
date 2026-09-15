/** Target-language scaffolds, authored for independent language review.
 * English instructions/semantic vocabulary ideas are intentionally retained.
 * The loop expands exact inspected duplicate templates, not unseen questions. */
const localized = {
  es: {
    name: 'Me llamo ___ y vivo en una ciudad.', family: 'Número de hermanos y hermanas: ___.',
    intro: ['Me llamo', 'Soy de', 'Me gusta'],
    routine: ['Por la mañana,', 'Después,', 'Por la tarde,', 'Antes de acostarme,'],
    food: ['Mi comida favorita es', 'Me gusta porque', 'Normalmente la como'],
    trip: ['El año pasado viajé', 'Lo más interesante fue', 'Aprendí que', 'Recomendaría este viaje porque'],
  },
  fr: {
    name: "Je m'appelle ___ et j'habite dans une ville.", family: 'Nombre de frères et sœurs : ___.',
    intro: ["Je m'appelle", 'Je viens', "J'aime"],
    routine: ['Le matin,', 'Ensuite,', 'Le soir,', 'Avant de me coucher,'],
    food: ['Mon plat préféré est', "Je l'aime car", 'En général, je le mange'],
    trip: ["L'année dernière, j'ai voyagé", 'Le plus intéressant était', "Ce voyage m'a appris une chose :", 'Je recommanderais ce voyage car'],
  },
  de: {
    name: 'Ich heiße ___ und wohne in einer Stadt.', family: 'Anzahl der Geschwister: ___.',
    intro: ['Ich heiße', 'Ich komme aus', 'In meiner Freizeit'],
    routine: ['Morgens', 'Danach', 'Abends', 'Vor dem Schlafengehen'],
    food: ['Mein Lieblingsessen ist', 'Ich mag es, weil', 'Normalerweise esse ich es'],
    trip: ['Letztes Jahr bin ich', 'Am interessantesten war', 'Ich habe gelernt, dass', 'Ich würde diese Reise empfehlen, weil'],
  },
  it: {
    name: 'Mi chiamo ___ e vivo in una città.', family: 'Numero di fratelli e sorelle: ___.',
    intro: ['Mi chiamo', 'Vengo', 'Mi piace'],
    routine: ['La mattina,', 'Dopo,', 'La sera,', 'Prima di andare a letto,'],
    food: ['Il mio piatto preferito è', 'Mi piace perché', 'Di solito lo mangio'],
    trip: ["L'anno scorso ho viaggiato", 'La cosa più interessante è stata', 'Ho imparato che', 'Consiglierei questo viaggio perché'],
  },
  pt: {
    name: 'O meu nome é ___ e vivo numa cidade.', family: 'Número de irmãos e irmãs: ___.',
    intro: ['O meu nome é', 'Sou', 'Gosto de'],
    routine: ['De manhã,', 'Depois,', 'À noite,', 'Antes de dormir,'],
    food: ['A minha comida favorita é', 'Gosto dela porque', 'Normalmente, como esta comida'],
    trip: ['No ano passado, viajei', 'O mais interessante foi', 'Aprendi que', 'Recomendaria esta viagem porque'],
  },
  ja: {
    name: '私の名前は___です。私は都市に住んでいます。', family: '自分以外のきょうだい：___人。',
    intro: ['私の名前は___です。', '出身地は___です。', '好きなことは___です。'],
    routine: ['朝は___。', 'その後、___。', '夕方は___。', '寝る前に___。'],
    food: ['好きな食べ物は___です。', '好きな理由は___からです。', '普段は___。'],
    trip: ['去年、___へ旅行しました。', '一番おもしろかったのは___です。', 'この旅行で___ということを学びました。', 'この旅行をおすすめする理由は___からです。'],
  },
  ko: {
    name: '제 이름은 ___입니다. 저는 도시에 살아요.', family: '나를 제외한 형제자매 수: ___명.',
    intro: ['제 이름은 ___입니다.', '저는 ___ 출신입니다.', '제가 좋아하는 것은 ___입니다.'],
    routine: ['아침에는 ___.', '그다음에는 ___.', '저녁에는 ___.', '잠자리에 들기 전에는 ___.'],
    food: ['제가 가장 좋아하는 음식은 ___입니다.', '이 음식을 좋아하는 이유는 ___.', '저는 보통 이 음식을 ___.'],
    trip: ['작년에 저는 ___에 다녀왔어요.', '가장 흥미로웠던 것은 ___.', '이 여행을 통해 ___ 배웠어요.', '이 여행을 추천하는 이유는 ___.'],
  },
  zh: {
    name: '我叫___，我住在城市里。', family: '兄弟姐妹（不包括自己）：___人。',
    intro: ['我叫___。', '我来自___。', '我喜欢___。'],
    routine: ['早上，我___。', '然后，我___。', '晚上，我___。', '睡觉前，我___。'],
    food: ['我最喜欢的食物是___。', '我喜欢它，因为___。', '我通常___。'],
    trip: ['去年，我去___旅行了。', '最有趣的是___。', '我学到了___。', '我推荐这次旅行，因为___。'],
  },
  ru: {
    name: 'Меня зовут ___. Я живу в городе.', family: 'Количество братьев и сестёр: ___.',
    intro: ['Меня зовут', 'Я из', 'Мне нравится'],
    routine: ['Утром я', 'После этого я', 'Вечером я', 'Перед сном я'],
    food: ['Моё любимое блюдо —', 'Мне оно нравится, потому что', 'Обычно я ем его'],
    trip: ['В прошлом году', 'Самым интересным было', 'Во время этой поездки', 'Я рекомендую эту поездку, потому что'],
  },
};
const originalStarters = {
  intro: ['My name is', 'I am from', 'I like to'],
  routine: ['In the morning, I', 'After that, I', 'In the evening, I', 'Before bed, I'],
  food: ['My favorite food is', 'I like it because', 'I usually eat it'],
  trip: ['Last year, I traveled to', 'The most interesting thing was', 'I learned that', 'I would recommend this trip because'],
};
const topicCorrections = {
  'Opinions & Current Events': {
    before: 'Write about your daily routine. Include: what time you wake up, what you eat for breakfast, how you get to work or school, and what you do in the evening. Use at least 80 words.',
    after: 'Write about a current issue in your town or in the news. Explain the issue, give your opinion, and support it with at least two reasons or examples. Make clear which statements are facts and which are your opinions. Use at least 80 words.',
  },
  'Work & Career': {
    before: 'Describe your ideal vacation. Where would you go? Who would you travel with? What activities would you do? Write at least 80 words.',
    after: 'Describe your ideal job. What would your responsibilities be? Which skills would you need, and why would this work suit you? Give specific examples. Write at least 80 words.',
  },
  'Environment & Nature': {
    before: 'Describe a memorable experience from your childhood. What happened? How did you feel? Why is it memorable? Use past tenses.',
    after: 'Describe a memorable experience in nature. What happened? What did you notice about the environment, and how did you feel? Explain why the experience was memorable. Use appropriate forms to talk about the past.',
  },
  'Professional Communication': {
    before: 'Write a critical review of a recent film, book, or TV series. Analyze the plot, characters, themes, and your overall impression. Write at least 150 words.',
    after: 'Write a professional email to a colleague recommending or advising against a book, film, or training video for a workplace discussion. Summarize its main ideas, explain its relevance, and make a clear recommendation. Use an appropriate professional greeting and closing. Write at least 150 words.',
  },
};

export function writingFixes({ snapshot, update }) {
  const courses = new Map(snapshot.courses.map(c => [c.id, c]));
  const units = new Map(snapshot.units.map(u => [u.id, u]));
  let scaffolds = 0, topics = 0;
  for (const row of snapshot.writing_prompts) {
    const language = courses.get(row.course_id).target_language;
    const translation = localized[language];
    if (!translation) throw new Error(`Unreviewed scaffold language ${language}`);
    const after = {};
    const reasons = [];
    if (row.scaffold_type === 'fill_blank') {
      const data = row.scaffold_data;
      const isName = data.sentence === 'My name is ___ and I live in a city.';
      const isFamily = data.sentence === 'I have ___ brothers and sisters.';
      if (!isName && !isFamily) throw new Error(`Unreviewed fill-blank template ${row.id}`);
      const { blank_index: unusedLegacyIndex, ...rest } = data;
      after.scaffold_data = { ...rest, sentence: translation[isName ? 'name' : 'family'],
        hint: isName ? 'Write your name.' : 'Write the number of brothers and sisters you have, not including yourself.' };
      if (isFamily) after.prompt_text = 'Complete the information about your family.';
      reasons.push('Replace English text inserted into target-language writing with a grammatical target-language scaffold. The family count uses a label so zero/one/multiple siblings do not force incorrect number agreement.');
      scaffolds++;
    } else if (['sentence_frame', 'guided_paragraph'].includes(row.scaffold_type)) {
      const template = Object.keys(originalStarters).find(key => JSON.stringify(row.scaffold_data.starters) === JSON.stringify(originalStarters[key]));
      if (!template) throw new Error(`Unreviewed starter template ${row.id}`);
      after.scaffold_data = { ...row.scaffold_data, starters: translation[template] };
      reasons.push('Replace English sentence material inserted into the submission with target-language frames; marked frames preserve post-answer sentence endings.');
      scaffolds++;
    }
    const correction = topicCorrections[units.get(row.unit_id)?.title];
    if (correction) {
      if (row.prompt_text !== correction.before) throw new Error(`Topic correction source changed: ${row.id}`);
      after.prompt_text = correction.after;
      reasons.push(`Correct a confirmed mismatch with the assigned ${units.get(row.unit_id).title} unit while preserving the original CEFR band and length bounds.`);
      topics++;
    }
    if (reasons.length) update('writing_prompts', row.id, after, reasons.join(' '));
  }
  if (topics !== 36) throw new Error(`Expected 36 inspected topic mismatches, got ${topics}`);
  return { scaffolds, topics };
}
