-- seed_content.sql
-- Run AFTER schema_v2.sql. Seeds Spanish course, lessons, lesson_contents, news, and music.

DO $$
DECLARE
  v_lang_id    UUID;
  v_course_id  UUID;
  v_lesson1_id UUID;
  v_lesson2_id UUID;
  v_lesson3_id UUID;
  v_lesson4_id UUID;
  v_lesson5_id UUID;
BEGIN

  SELECT id INTO v_lang_id FROM public.languages WHERE slug = 'spanish' LIMIT 1;
  IF v_lang_id IS NULL THEN
    RAISE EXCEPTION 'Spanish language not found. Run schema_v2.sql first.';
  END IF;

  -- ========================
  -- COURSE: Core Reading & Writing
  -- ========================
  INSERT INTO public.courses (language_id, title, description, level_min, level_max, type, order_index, is_published)
  VALUES (
    v_lang_id,
    'Core Reading & Writing',
    'Build your Spanish foundation through essential vocabulary, authentic texts, and structured writing practice.',
    'A1', 'B1', 'reading_writing', 1, true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO v_course_id;

  IF v_course_id IS NULL THEN
    SELECT id INTO v_course_id FROM public.courses
    WHERE language_id = v_lang_id AND title = 'Core Reading & Writing' LIMIT 1;
  END IF;

  -- ========================
  -- LESSON 1: Greetings Vocab
  -- ========================
  INSERT INTO public.lessons (course_id, title, kind, level, estimated_minutes, order_index, is_published)
  VALUES (v_course_id, 'Lesson 1: Essential Greetings', 'vocab', 'A1', 8, 1, true)
  RETURNING id INTO v_lesson1_id;

  INSERT INTO public.lesson_contents (lesson_id, content_type, body, order_index, metadata) VALUES
  (v_lesson1_id, 'vocab_list',
   'Hola = Hello | Buenos dias = Good morning | Buenas tardes = Good afternoon | Buenas noches = Good evening / Good night | Por favor = Please | Gracias = Thank you | De nada = You are welcome | Perdon = Excuse me / Sorry | Si = Yes | No = No | Como te llamas? = What is your name? | Me llamo... = My name is... | Mucho gusto = Nice to meet you | Hasta luego = See you later | Adios = Goodbye',
   1, '{"word_count": 15}'),
  (v_lesson1_id, 'exercise',
   'Exercise: Match the Spanish phrase to its English meaning.\n1. Buenas tardes\n2. Gracias\n3. Como te llamas?\n4. Hasta luego\n5. De nada\n\nAnswers: 1-Good afternoon, 2-Thank you, 3-What is your name?, 4-See you later, 5-You are welcome',
   2, '{"exercise_type": "matching"}');

  -- ========================
  -- LESSON 2: Reading - El mercado
  -- ========================
  INSERT INTO public.lessons (course_id, title, kind, level, estimated_minutes, order_index, is_published)
  VALUES (v_course_id, 'Lesson 2: Reading - El mercado', 'reading', 'A1', 12, 2, true)
  RETURNING id INTO v_lesson2_id;

  INSERT INTO public.lesson_contents (lesson_id, content_type, body, order_index, license_info, metadata) VALUES
  (v_lesson2_id, 'public_domain_text',
   'EL MERCADO

Maria va al mercado todos los sabados por la manana. El mercado es grande y hay muchos colores. Ella compra tomates rojos, lechugas verdes, y manzanas amarillas. El vendedor se llama Carlos. Carlos es simpatico y siempre saluda con una sonrisa.

"Buenos dias, Maria. Como esta usted hoy?" dice Carlos.
"Muy bien, gracias. Y usted?" responde Maria.
"Muy bien tambien. Hoy tengo fresas muy frescas. Quiere probar una?"
"Si, por favor. Que ricas!"

Maria paga cinco euros por las fresas y dice "Hasta el sabado proximo." Carlos sonrie y dice "Adios, Maria. Que tenga un buen dia."

Vocabulario clave:
- el mercado = the market
- todos los sabados = every Saturday
- compra = she buys
- el vendedor = the vendor / seller
- simpatico = friendly / nice
- la sonrisa = the smile
- fresas = strawberries
- frescas = fresh
- paga = she pays',
   1, 'Public domain educational content', '{"word_count": 148, "topic": "shopping"}'),
  (v_lesson2_id, 'exercise',
   'Comprehension Questions (answer in English):\n1. When does Maria go to the market?\n2. What does she buy? (name 3 things)\n3. What is the vendor''s name?\n4. How much does Maria pay for the strawberries?\n5. What does Carlos offer Maria to try?\n\nAnswers: 1-Every Saturday morning, 2-Tomatoes, lettuce, yellow apples (and strawberries), 3-Carlos, 4-Five euros, 5-Fresh strawberries',
   2, '{"exercise_type": "comprehension"}');

  -- ========================
  -- LESSON 3: Writing - Mi familia
  -- ========================
  INSERT INTO public.lessons (course_id, title, kind, level, estimated_minutes, order_index, is_published)
  VALUES (v_course_id, 'Lesson 3: Writing - Mi familia', 'writing', 'A1', 15, 3, true)
  RETURNING id INTO v_lesson3_id;

  INSERT INTO public.lesson_contents (lesson_id, content_type, body, order_index, metadata) VALUES
  (v_lesson3_id, 'vocab_list',
   'la familia = the family | la madre / la mama = mother / mom | el padre / el papa = father / dad | el hermano = brother | la hermana = sister | el abuelo = grandfather | la abuela = grandmother | el tio = uncle | la tia = aunt | el primo / la prima = cousin | los padres = parents | los hijos = children | mayor = older | menor = younger | querido/a = dear / beloved',
   1, '{"word_count": 15}'),
  (v_lesson3_id, 'exercise',
   'Writing Prompt: Write 5-8 sentences describing your family in Spanish. Use the vocabulary above.

Example model text:
"Mi familia es pequena pero muy unida. Tengo una madre, un padre, y una hermana. Mi madre se llama Ana y es muy trabajadora. Mi padre se llama Jorge y es muy divertido. Mi hermana se llama Sofia y es menor que yo. Los fines de semana, toda la familia come junta. Me gusta mucho mi familia."

Your turn: Write about your own family. Try to include: family members'' names, their personalities, and one thing you do together.',
   2, '{"exercise_type": "free_writing", "min_sentences": 5}');

  -- ========================
  -- LESSON 4: Reading - La ciudad
  -- ========================
  INSERT INTO public.lessons (course_id, title, kind, level, estimated_minutes, order_index, is_published)
  VALUES (v_course_id, 'Lesson 4: Reading - La ciudad', 'reading', 'A2', 12, 4, true)
  RETURNING id INTO v_lesson4_id;

  INSERT INTO public.lesson_contents (lesson_id, content_type, body, order_index, license_info, metadata) VALUES
  (v_lesson4_id, 'public_domain_text',
   'LA CIUDAD

Madrid es la capital de Espana y una de las ciudades mas grandes de Europa. Tiene mas de tres millones de habitantes. La ciudad es famosa por sus museos, sus parques y su vida nocturna.

El Museo del Prado es uno de los museos mas importantes del mundo. Alli se pueden ver obras de pintores famosos como Velazquez y Goya. El Parque del Retiro es un lugar perfecto para pasear, leer un libro, o simplemente descansar bajo los arboles.

La Gran Via es la calle mas famosa de Madrid. Hay tiendas, restaurantes, teatros y cines. Por la noche, la ciudad se llena de vida. Los madrilehos cenan tarde, a las nueve o las diez de la noche, y les gusta salir con amigos.

El transporte publico en Madrid es excelente. El metro conecta todos los barrios de la ciudad. Tambien hay autobuses y taxis. Es facil moverse por la ciudad sin coche.

Vocabulario:
- la capital = the capital
- los habitantes = inhabitants / residents
- los museos = museums
- las obras = works (of art)
- pasear = to stroll / walk
- descansar = to rest
- cenan = they dine / have dinner
- el barrio = the neighborhood
- moverse = to get around',
   1, 'Public domain educational content', '{"word_count": 196, "topic": "city life"}'),
  (v_lesson4_id, 'exercise',
   'True or False (Verdadero o Falso):\n1. Madrid tiene mas de tres millones de habitantes. (V/F)\n2. El Museo del Prado esta en Barcelona. (V/F)\n3. La Gran Via es famosa por sus museos. (V/F)\n4. Los madrilenos cenan muy temprano. (V/F)\n5. El metro conecta los barrios de Madrid. (V/F)\n\nAnswers: 1-V, 2-F (it is in Madrid), 3-F (famous for shops, restaurants, theaters, cinemas), 4-F (they dine late), 5-V',
   2, '{"exercise_type": "true_false"}');

  -- ========================
  -- LESSON 5: Conversation - En el cafe
  -- ========================
  INSERT INTO public.lessons (course_id, title, kind, level, estimated_minutes, order_index, is_published)
  VALUES (v_course_id, 'Lesson 5: Conversation - En el cafe', 'conversation', 'A2', 10, 5, true)
  RETURNING id INTO v_lesson5_id;

  INSERT INTO public.lesson_contents (lesson_id, content_type, body, order_index, metadata) VALUES
  (v_lesson5_id, 'text',
   'DIALOGO: En el cafe

Camarero: Buenas tardes. Bienvenido. Que desea tomar?
Cliente: Buenas tardes. Quiero un cafe con leche, por favor. Y tambien un croissant.
Camarero: Perfecto. Lo trae enseguida. Algo mas?
Cliente: No, gracias. Cuanto cuesta?
Camarero: El cafe con leche son dos euros y el croissant un euro y medio. En total, tres euros y medio.
Cliente: Aqui tiene. Gracias.
Camarero: Gracias a usted. Que aproveche!
Cliente: Gracias, igualmente.

Frases utiles para el cafe:
- Quiero / Quisiera... = I want / I would like...
- La carta / el menu, por favor = The menu, please
- La cuenta, por favor = The bill, please
- Que desea? = What would you like?
- Enseguida = Right away
- Que aproveche = Enjoy your meal
- Esta incluido el servicio? = Is service included?',
   1, '{"topic": "cafe", "dialogue": true}'),
  (v_lesson5_id, 'exercise',
   'Role Play Practice:\nPractice this conversation with your AI tutor. You are the customer (cliente). Try to:\n1. Order a coffee and a pastry\n2. Ask how much it costs\n3. Pay and say thank you\n\nBonus challenge: Ask for the menu first, then order something different from the model dialogue.',
   2, '{"exercise_type": "role_play"}');

  -- ========================
  -- NEWS ARTICLES (Spanish)
  -- ========================
  INSERT INTO public.news_articles (language_id, title, source_name, url, summary, difficulty, published_at) VALUES
  (v_lang_id,
   'La economia espanola crece un 2,5% en el primer trimestre',
   'El Pais',
   'https://elpais.com',
   'La economia de Espana mostro un crecimiento solido en el primer trimestre del ano, impulsada por el turismo y las exportaciones. Los expertos esperan que este ritmo continue durante el resto del ano.',
   'B1',
   now() - interval '2 days'),
  (v_lang_id,
   'Nuevo record de turistas en Barcelona este verano',
   'La Vanguardia',
   'https://lavanguardia.com',
   'Barcelona recibio un numero record de visitantes internacionales este verano. La ciudad catala sigue siendo uno de los destinos turisticos mas populares de Europa, con millones de viajeros de todo el mundo.',
   'A2',
   now() - interval '5 days'),
  (v_lang_id,
   'Espana lidera Europa en energia solar renovable',
   'El Mundo',
   'https://elmundo.es',
   'Espana se ha convertido en el pais europeo con mayor produccion de energia solar. El gobierno espanol tiene planes ambiciosos para aumentar la capacidad de energia renovable en los proximos anos.',
   'B2',
   now() - interval '1 day');

  -- ========================
  -- MUSIC TRACKS (Spanish)
  -- ========================
  INSERT INTO public.music_tracks (language_id, title, artist, external_url, difficulty, snippet) VALUES
  (v_lang_id,
   'La Bamba',
   'Ritchie Valens (Traditional Mexican folk)',
   'https://www.youtube.com/watch?v=tR_EcFG62w8',
   'A1',
   'Para bailar la bamba, para bailar la bamba se necesita una poca de gracia...'),
  (v_lang_id,
   'Ojalá',
   'Silvio Rodriguez',
   'https://www.youtube.com/watch?v=wFaMCGI5Aas',
   'B2',
   'Ojala que las hojas no te toquen el cuerpo cuando caigan...'),
  (v_lang_id,
   'Guantanamera',
   'Joseito Fernandez (Traditional Cuban)',
   'https://www.youtube.com/watch?v=8cs8IqNa6_Y',
   'A2',
   'Guantanamera, guajira guantanamera. Yo soy un hombre sincero, de donde crece la palma...');

END $$;
