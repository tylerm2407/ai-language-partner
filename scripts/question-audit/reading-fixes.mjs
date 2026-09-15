/** Authored, evidence-backed corrections. Independent remediation review pending. */
export function readingFixes({ update, replaceText }) {
  update('reading_questions', '0cbea5de-17d8-44ed-b448-c830b4a39f20', {
    correct_answer: 'They had more grey matter in their brains, according to the passage.',
    accepted_answers: ['More grey matter', 'More gray matter', 'They had more grey matter.', 'They had more gray matter.'],
  }, 'ko-R0001: the passage says 회백질 (grey/gray matter), not white matter. This corrects textual comprehension, not verification of the unnamed study.');
  update('reading_questions', '15cf19f2-ca23-47f6-a3fa-85da7a715656', {
    correct_answer: 'JR', accepted_answers: ['The artist JR'],
  }, 'fr-R0002: remove an invented expansion of JR and marking instructions from the answer.', ['https://www.jr-art.net/about']);
  update('reading_questions', '43768128-ddf4-4c34-9b30-220b55c21b23', {
    question_text: 'According to the passage, can learning a language change the brain in adulthood?',
    correct_answer: 'Yes. These brain changes can also occur when adults learn a language.',
    accepted_answers: ['Yes', 'Yes, also in adulthood', 'Yes, adults can experience these changes.'],
  }, 'fr-R0007: ask what the passage supports (changes in adulthood), not an exact stopping age that it never gives.');
  update('reading_questions', 'aabbccdd-1111-4005-a001-0b0000000002', {
    correct_answer: 'Empathy', accepted_answers: ['Empatía', 'It helps develop empathy.'],
  }, 'es-R0033: the question asks what storytelling develops; the old key combines empathy with an ungrammatical extra verb phrase.');
  update('reading_questions', '17c32f40-e8b7-40c3-9f06-c310fb8b2d53', {
    correct_answer: 'Douyin', accepted_answers: ['抖音'],
  }, 'zh-R0009: Douyin and TikTok are separate products; the passage names Douyin.', ['https://www.bytedance.com/en/products']);
  update('reading_questions', '690a6546-0486-466e-981e-db8ad6d88ba2', {
    correct_answer: '慕课网 (IMOOC) and 学而思 (Xueersi)',
    accepted_answers: ['慕课网和学而思', '学而思和慕课网', 'IMOOC and Xueersi', 'Xueersi and IMOOC'],
  }, 'zh-R0015: remove the wrong Mooc.com expansion of 慕课网; preserve the two named platforms.', ['https://www.imooc.com/article/334539']);
  update('reading_questions', 'aa718836-56d7-4ded-bb6e-be783a6d7ddf', {
    question_text: 'What record temperature was measured in Sicily in August 2021?',
    correct_answer: '48.8 degrees Celsius', accepted_answers: ['48.8°C', '48.8 °C', '48,8 °C', '48.8', '48,8'],
  }, 'it-R0021: align both question and key with the verified 2021 European temperature record.', ['https://wmo.int/news/media-centre/wmo-confirms-verification-of-new-continental-european-temperature-record']);
  update('reading_questions', 'aae821f4-2e32-4e6c-9280-0258e82b836b', {
    question_text: 'In the 2015 Nomura Research Institute estimate mentioned in the passage, about what percentage of Japan’s working population held jobs considered technically replaceable by AI or robots?',
    correct_answer: 'About 49% of the working population', accepted_answers: ['49%', 'About 49%', 'Approximately 49 percent', '49 percent'],
  }, 'ja-R0019: correct the institution, reference date and denominator; 49% refers to workers in potentially automatable occupations, not 49% of occupation categories or a prediction of actual unemployment.', ['https://www.nri.com/content/900037164.pdf']);

  update('reading_questions', '65f1ed42-f45d-4a6a-be3d-5eaf16ad1d51', {
    correct_answer: 'Films, novels, fairy tales and theatre productions',
    accepted_answers: ['Films and novels', 'Films and fairy tales', 'Films and theatre productions', 'Novels and fairy tales', 'Novels and theatre productions', 'Fairy tales and theatre productions'],
  }, 'fr-R0012: paired with the Régy passage correction. Do not describe his theatre productions as films. The prompt asks for some examples, not every author and form.', ['https://festival-avignon.com/fr/artistes/claude-regy-12988']);
  update('reading_questions', 'a7e38d60-052b-4fe6-96d2-f119e7b2b318', {
    correct_answer: 'Artists used paintings and sculptures to resist oppression and express political messages.',
    accepted_answers: ['Art was a tool for resisting oppression.', 'Artists resisted oppression through paintings and sculptures.'],
  }, 'ko-R0024: the question concerns the 1980s democratization movement. Remove the later Gwangju Biennale from this answer; its chronology is separately corrected in the passage.', ['https://www.gwangjubiennale.org/gb/biennale/past/34.do?Cmenucode=02&subPageCode=program']);
  update('reading_questions', 'c848e40d-b1cb-42c8-acec-c4a7f8619fcd', {
    correct_answer: 'Both inexpensive and expensive options are available.',
    accepted_answers: ['From inexpensive to expensive', 'From inexpensive cafés to expensive restaurants', 'There are inexpensive cafés and expensive restaurants.'],
  }, 'ru-R0024: pair the passage repair with a price-range answer that does not compare prices directly to establishments.');
  update('reading_questions', '9a396597-590b-46d7-b679-88629c612898', {
    correct_answer: 'Investing in public transport and cycling',
    accepted_answers: ['Investing in public transport and bicycles', 'Investing in cycling and public transport'],
  }, 'it-R0018: the passage assigns transport/cycling investment to cities; the renewable-energy choice is made by many Italians, not explicitly by the cities asked about.');
  replaceText('reading_questions', '358473ef-73e4-4872-9ee2-389d42a393be', 'correct_answer', [
    ['to work abroad and returning with new perspectives', 'to work abroad and return with new perspectives'],
  ], 'pt-R0010: repair English parallel verb structure while retaining the supported answer.');
  update('reading_questions', 'a270d94e-f6a8-4450-8ac0-9d519c50f97d', {
    question_text: 'What two architectural features of Sagrada Familia are mentioned in the passage?',
    correct_answer: 'Complex decorations and tall towers', accepted_answers: ['Tall towers and complex decorations', 'Intricate decoration and high towers'],
  }, 'ja-R0016: the passage names two architectural features but never ranks one as the most famous. Ask for the two stated features without an unsupported superlative.');
  update('reading_questions', 'a6ba4867-082e-477d-9d71-7043c5940fa6', {
    correct_answer: 'Using reusable bags and sorting rubbish correctly',
    accepted_answers: ['Sorting rubbish correctly and using reusable bags', 'Using reusable bags and public transport', 'Using public transport and reusable bags', 'Using reusable bags and cycling', 'Cycling and using reusable bags', 'Sorting rubbish correctly and using public transport', 'Using public transport and sorting rubbish correctly', 'Sorting rubbish correctly and cycling', 'Cycling and sorting rubbish correctly', 'Using public transport and cycling', 'Cycling and using public transport'],
  }, 'ja-R0018: bicycles are not themselves public transport. Keep the requested two measures and list valid two-category combinations without demanding all measures; broader paraphrase grading remains separately pending.');
  update('reading_questions', '34797391-4593-4132-8c72-4841553bf182', {
    question_text: 'Which Naver AI brand is mentioned in the passage?',
    correct_answer: 'Clova', accepted_answers: ['CLOVA', '클로바', "Naver's Clova"],
  }, 'ko-R0006: paired passage now distinguishes the Clova brand from Kakao Brain, an AI research/development company; stop asking for two consumer services.', ['https://www.kakaocorp.com/page/detail/11005']);
  update('reading_questions', 'aabbccdd-1111-4004-a001-0b0000000001', {
    accepted_answers: ['Responsibility for accidents involving autonomous cars', 'Who is responsible when a self-driving car causes an accident?', 'Discriminatory algorithms', 'Racial or gender bias in algorithms', 'Preventing algorithms from perpetuating racial or gender bias'],
  }, 'es-R0028: the passage gives both autonomous-car responsibility and discriminatory algorithms as ethical dilemmas; the question does not limit answers to the first example.');
  update('reading_questions', '311d3bf5-4381-49e3-a4ba-291b3fc3832d', {
    correct_answer: 'Cycling and saving energy',
    accepted_answers: ['Saving energy and cycling', 'Cycling and eating less meat', 'Eating less meat and cycling', 'Eating less meat and saving energy', 'Saving energy and eating less meat'],
  }, 'de-R0006: remove the overbroad age-only driving-ban alternative and honor any two of the three citizen actions explicitly listed together in the passage.', ['https://www.umweltbundesamt.de/themen/luft/luftschadstoffe/feinstaub/umweltzonen-in-deutschland']);

  const text = (id, edits, reason, sources = []) => replaceText('reading_passages', id, 'content', edits, reason, sources);
  text('aabbccdd-2222-4005-a001-000000000000', [
    ['les films de Claude Régy continuent à inspirer les cinéastes modernes', 'les mises en scène de Claude Régy continuent à inspirer le théâtre contemporain'],
  ], 'French passage: Claude Régy is the theatre director referenced, not a film director.', ['https://festival-avignon.com/fr/artistes/claude-regy-12988']);
  text('aabbccdd-3333-3005-a001-000000000000', [
    ['Das bedeutet, dass das Land nicht mehr CO₂ in die Atmosphäre ausstoßen darf.', 'Das bedeutet, dass nicht mehr Treibhausgase ausgestoßen werden, als wieder aus der Atmosphäre entfernt werden.'],
    ['In vielen deutschen Städten gibt es bereits Umweltzonen, in denen alte Autos nicht fahren dürfen.', 'In einigen deutschen Städten gibt es Umweltzonen mit besonderen Abgasvorschriften für Fahrzeuge.'],
  ], 'German passage: climate neutrality is a net greenhouse-gas balance, not an absolute prohibition of every CO₂ emission. Environmental zones depend on emission rules, not age alone; avoid implying that exempt classic cars are universally banned.', ['https://www.bundesregierung.de/breg-en/service/archive/climate-change-act-2021-1913970', 'https://www.umweltbundesamt.de/themen/luft/luftschadstoffe/feinstaub/umweltzonen-in-deutschland']);
  text('aabbccdd-2222-4006-a001-000000000000', [['apprennent une langue tardive', 'apprennent une langue tardivement']], 'French passage: the learning occurs late; the language itself is not tardive.');
  text('aabbccdd-2222-4003-a001-000000000000', [['rayonnent la culture française', 'font rayonner la culture française']], 'French passage: use the causative construction for promoting the influence of French culture.', ['https://www.dictionnaire-academie.fr/article/A9R0679']);
  text('aabbccdd-6666-4003-a001-000000000000', [['コンテンツが容易にアクセスできる', 'コンテンツに容易にアクセスできる']], 'Japanese passage: mark the content accessed with に, not as the subject capable of accessing.');
  text('aabbccdd-7777-4004-a001-000000000000', [
    ['네이버의 클로바, 카카오의 카카오 브레인 같은 AI 서비스들이 일상생활 속에 깊숙이 들어와 있습니다.', '네이버의 클로바는 AI 기술 브랜드입니다. 카카오의 AI 연구·개발 자회사였던 카카오브레인은 언어 모델과 이미지 생성 모델을 개발했습니다.'],
  ], 'Korean passage: distinguish the Clova AI brand from the Kakao Brain development organization; do not present a company itself as a consumer service.', ['https://www.kakaocorp.com/page/detail/11005', 'https://clova.ai']);
  text('aabbccdd-8888-4006-a001-000000000000', [
    ['这个过程叫做神经可塑性。', '大脑还能随着学习和经验改变结构、功能以及神经连接，这种能力叫做神经可塑性。'],
  ], 'Chinese passage: neuroplasticity is the capacity for experience-related structural/functional/connection changes, not simply transient activation.', ['https://pmc.ncbi.nlm.nih.gov/articles/PMC3102236/']);
  text('aabbccdd-4444-3003-a001-000000000000', [
    ['la spiaggia di Montserrat', 'il monastero di Montserrat'],
  ], 'Italian travel passage: Montserrat is an inland mountain/monastery destination, not the named beach.', ['https://www.montserratvisita.com/en/how-to-get-there/cremallera-train']);
  text('aabbccdd-4444-3005-a001-000000000000', [
    ['Nel 2023, la Sicilia ha raggiunto 48 gradi Celsius, record negativo europeo.', 'L’11 agosto 2021, in Sicilia è stata misurata una temperatura di 48,8 gradi Celsius, il record europeo confermato dall’Organizzazione meteorologica mondiale.'],
  ], 'Italian climate passage: replace the wrong year and rounded record with the WMO-verified measurement.', ['https://wmo.int/news/media-centre/wmo-confirms-verification-of-new-continental-european-temperature-record']);
  text('aabbccdd-4444-3008-a001-000000000000', [['kombiniamo', 'combiniamo']], 'Italian passage: correct the misspelling of combiniamo; retain valid literary apocope mantener.');
  text('aabbccdd-4444-4001-a001-000000000000', [['Il vero sfida', 'La vera sfida']], 'Italian passage: feminine agreement with sfida.');
  text('aabbccdd-4444-4002-a001-000000000000', [
    ['le muri grigie', 'i muri grigi'], ['Cantanti come Ennio Morricone', 'Compositori come Ennio Morricone'],
  ], 'Italian passage: correct masculine agreement with muri and identify Morricone as a composer.', ['https://www.fondazionemorricone.it/la-biografia/']);
  text('aabbccdd-4444-4005-a001-000000000000', [['comprendre', 'comprendere']], 'Italian passage: remove a French-form spelling from the Italian infinitive.');
  text('aabbccdd-5555-4002-a001-000000000000', [['palavras explicitas', 'palavras explícitas']], 'Portuguese passage: required accent in the adjective explícitas.');
  text('aabbccdd-6666-4001-a001-000000000000', [
    ['日本銀行の調査によれば、今後20年で、自動化される可能性がある職業は全体の約49％に上るとされています。', '野村総合研究所が2015年に発表した推計では、日本の労働人口の約49％が就く職業は、その後10～20年で技術的にはAIやロボットに代替される可能性があるとされました。これは、実際にそれだけの仕事が失われるという予測ではありません。'],
  ], 'Japanese passage: correct attribution to NRI, anchor the old projection to 2015, and distinguish technical substitutability from actual job loss.', ['https://www.nri.com/content/900037164.pdf']);
  text('aabbccdd-7777-4002-a001-000000000000', [
    ['광주 비엔날레와 같은 전시회들은', '그 후 1995년에 처음 열린 광주 비엔날레와 같은 전시회들은'],
  ], 'Korean passage: distinguish the later Biennale from the preceding paragraph’s 1980s democratization movement.', ['https://www.gwangjubiennale.org/gb/biennale/past/34.do?Cmenucode=02&subPageCode=program']);
  text('aabbccdd-9999-3003-a001-000000000000', [['На последний день', 'В последний день']], 'Russian passage: correct the time expression for on the last day.');
  update('reading_passages', 'aabbccdd-9999-3003-a001-000000000000', { title: 'Неделя в Барселоне' }, 'Russian passage title: the story explicitly describes a week, not a weekend.');
  text('aabbccdd-9999-3005-a001-000000000000', [
    ['Много россиян беспокоят эти проблемы и участвуют', 'Многие россияне обеспокоены этими проблемами и участвуют'],
  ], 'Russian passage: repair the incompatible subject/case construction while preserving the meaning.');
  text('aabbccdd-9999-3007-a001-000000000000', [
    ['Цены варьируются от дешёвых кафе до дорогих ресторанов.', 'Здесь есть и недорогие кафе, и дорогие рестораны.'],
  ], 'Russian passage: prices cannot range from cafés to restaurants; express the intended range of venues directly. Preserve the original recipe wording because its stylistic/metonymic concern was not established as a clear error.');
  text('aabbccdd-9999-4001-a001-000000000000', [
    ['чтобы они могли работать рядом с ИИ, а не вместо них.', 'чтобы они могли работать вместе с ИИ, а не быть заменёнными им.'],
  ], 'Russian passage: repair the dangling plural pronoun and reversed worker/AI replacement relation.');
  text('aabbccdd-9999-4002-a001-000000000000', [
    ['вдохновляя следующие поколения к переменам', 'вдохновляя следующие поколения на перемены'],
  ], 'Russian passage: correct the complement of вдохновлять; preserve the valid description of Mayakovsky as an artist.');
}
