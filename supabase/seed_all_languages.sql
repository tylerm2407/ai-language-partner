DO $$
DECLARE
  r RECORD;
  lang_id UUID;
  course_id UUID;
  lesson_id UUID;
BEGIN

FOR r IN SELECT * FROM (VALUES
  ('Spanish','es','spanish','🇪🇸','The world''s second most spoken language. From Madrid to Mexico City.',52000),
  ('French','fr','french','🇫🇷','The language of love, cuisine, and international diplomacy.',31000),
  ('Japanese','ja','japanese','🇯🇵','Master hiragana, katakana, kanji, and polite conversation.',18000),
  ('Mandarin Chinese','zh','mandarin','🇨🇳','The most spoken language on Earth with over a billion native speakers.',24000),
  ('German','de','german','🇩🇪','Precision engineering meets rich literary tradition.',14000),
  ('Portuguese','pt','portuguese','🇧🇷','From Lisbon to Sao Paulo - spanning two continents.',11000),
  ('Italian','it','italian','🇮🇹','The language of art, opera, and the world finest cuisine.',9000),
  ('Korean','ko','korean','🇰🇷','K-pop K-drama and one of the most logical writing systems ever.',8000),
  ('Arabic','ar','arabic','🇸🇦','Over 400 million speakers across 22 countries.',7000),
  ('Russian','ru','russian','🇷🇺','Literature science and space exploration in one rich language.',6000),
  ('Hindi','hi','hindi','🇮🇳','The language of Bollywood and over 600 million speakers.',5500),
  ('Vietnamese','vi','vietnamese','🇻🇳','A tonal language with a fascinating history and culture.',4000),
  ('Turkish','tr','turkish','🇹🇷','Bridging Europe and Asia with 80 million speakers.',3800),
  ('Polish','pl','polish','🇵🇱','One of Europe most complex and beautiful Slavic languages.',3500),
  ('Dutch','nl','dutch','🇳🇱','The language of Rembrandt tulips and global trade.',3200),
  ('Greek','el','greek','🇬🇷','The foundation of Western civilization and philosophy.',3000),
  ('Thai','th','thai','🇹🇭','A tonal language with an elegant script and rich culture.',2800),
  ('Swedish','sv','swedish','🇸🇪','The language of ABBA IKEA and Scandinavian design.',2600),
  ('Norwegian','no','norwegian','🇳🇴','Gateway to fjords Vikings and Nordic literature.',2400),
  ('Danish','da','danish','🇩🇰','The language of Lego hygge and Hans Christian Andersen.',2200),
  ('Finnish','fi','finnish','🇫🇮','A unique language unlike any other European tongue.',2000),
  ('Romanian','ro','romanian','🇷🇴','A Romance language with fascinating Slavic influence.',1800),
  ('Czech','cs','czech','🇨🇿','The language of Kafka Dvorak and beautiful Prague.',1700),
  ('Hungarian','hu','hungarian','🇭🇺','One of Europe most unique and expressive languages.',1600),
  ('Hebrew','he','hebrew','🇮🇱','An ancient language reborn as a modern living tongue.',1500),
  ('Indonesian','id','indonesian','🇮🇩','The lingua franca of the world largest archipelago.',1400),
  ('Malay','ms','malay','🇲🇾','Spoken across Malaysia Brunei Singapore and Indonesia.',1300),
  ('Filipino','tl','filipino','🇵🇭','The national language of the Philippines rooted in Tagalog.',1200),
  ('Ukrainian','uk','ukrainian','🇺🇦','A rich Slavic language with a proud literary tradition.',1100),
  ('Catalan','ca','catalan','🏴','Spoken in Barcelona Valencia and the Balearic Islands.',1000),
  ('Croatian','hr','croatian','🇭🇷','The language of the Adriatic coast and Dalmatian culture.',950),
  ('Serbian','sr','serbian','🇷🇸','A South Slavic language written in both Cyrillic and Latin.',900),
  ('Slovak','sk','slovak','🇸🇰','The language of the heart of Central Europe.',850),
  ('Slovenian','sl','slovenian','🇸🇮','A South Slavic language spoken in beautiful Slovenia.',800),
  ('Bulgarian','bg','bulgarian','🇧🇬','The first written Slavic language with Cyrillic script.',750),
  ('Lithuanian','lt','lithuanian','🇱🇹','The oldest living Indo-European language.',700),
  ('Latvian','lv','latvian','🇱🇻','A Baltic language with ancient Indo-European roots.',650),
  ('Estonian','et','estonian','🇪🇪','A Finno-Ugric language closely related to Finnish.',600),
  ('Swahili','sw','swahili','🇰🇪','The most widely spoken African language.',550),
  ('Persian','fa','persian','🇮🇷','The language of Rumi poetry and a 2500-year civilization.',500),
  ('Bengali','bn','bengali','🇧🇩','One of the world most spoken languages rich in literature.',480),
  ('Punjabi','pa','punjabi','🇮🇳','A vibrant language spoken by 125 million people.',450),
  ('Tamil','ta','tamil','🇮🇳','One of the world oldest classical languages still thriving.',430),
  ('Telugu','te','telugu','🇮🇳','The language of Tollywood and 90 million speakers.',400),
  ('Urdu','ur','urdu','🇵🇰','A lyrical language shared between Pakistan and India.',380),
  ('Kannada','kn','kannada','🇮🇳','The language of Karnataka with a 2000-year literary tradition.',360),
  ('Gujarati','gu','gujarati','🇮🇳','The language of Gandhi and vibrant merchant communities.',340),
  ('Marathi','mr','marathi','🇮🇳','Spoken by over 80 million people in Maharashtra India.',320),
  ('Nepali','ne','nepali','🇳🇵','The official language of Nepal spoken in the Himalayas.',300),
  ('Sinhala','si','sinhala','🇱🇰','The language of Sri Lanka with a beautiful ancient script.',280)
) AS t(name,code,slug,flag,description,learner_count)
LOOP
  -- Upsert language
  INSERT INTO public.languages (name,code,slug,flag,description,is_active,learner_count)
  VALUES (r.name, r.code, r.slug, r.flag, r.description, true, r.learner_count)
  ON CONFLICT (slug) DO UPDATE SET
    flag = EXCLUDED.flag,
    description = EXCLUDED.description,
    is_active = true,
    learner_count = GREATEST(public.languages.learner_count, EXCLUDED.learner_count)
  RETURNING id INTO lang_id;

  IF lang_id IS NULL THEN
    SELECT id INTO lang_id FROM public.languages WHERE slug = r.slug;
  END IF;

  -- Only add course if none exists
  IF NOT EXISTS (SELECT 1 FROM public.courses WHERE language_id = lang_id AND type = 'core') THEN
    INSERT INTO public.courses (language_id,title,description,level_min,level_max,type,order_index,is_published)
    VALUES (
      lang_id,
      r.name || ' Foundations',
      'Build essential skills in ' || r.name || ' through vocabulary, reading, writing, and conversation practice.',
      'A1','B1','core',1,true
    ) RETURNING id INTO course_id;

    -- Lesson 1: Vocabulary
    INSERT INTO public.lessons (course_id,title,kind,level,estimated_minutes,order_index,is_published)
    VALUES (course_id,'Greetings & Essential Vocabulary','vocab','A1',10,1,true)
    RETURNING id INTO lesson_id;
    INSERT INTO public.lesson_contents (lesson_id,content_type,body,metadata)
    VALUES (lesson_id,'vocab_list','',jsonb_build_object(
      'vocab', jsonb_build_array(
        jsonb_build_object('word','Hello / Hi','meaning','Basic greeting'),
        jsonb_build_object('word','Good morning','meaning','Morning greeting'),
        jsonb_build_object('word','Good evening','meaning','Evening greeting'),
        jsonb_build_object('word','My name is...','meaning','Self-introduction'),
        jsonb_build_object('word','Nice to meet you','meaning','First meeting'),
        jsonb_build_object('word','How are you?','meaning','Asking about wellbeing'),
        jsonb_build_object('word','Thank you','meaning','Expressing gratitude'),
        jsonb_build_object('word','Goodbye','meaning','Farewell')
      ),
      'note', 'Practice these phrases with your AI tutor after completing this lesson.'
    ));

    -- Lesson 2: Reading
    INSERT INTO public.lessons (course_id,title,kind,level,estimated_minutes,order_index,is_published)
    VALUES (course_id,'Reading: Countries & Capitals','reading','A1',15,2,true)
    RETURNING id INTO lesson_id;
    INSERT INTO public.lesson_contents (lesson_id,content_type,body,license_info)
    VALUES (lesson_id,'text',
      'In this lesson, you will read a short passage about the country where ' || r.name || ' is primarily spoken. '
      'Use the Translate button to look up any words you do not know. '
      'After reading, try to answer: What is the capital city? What do people eat? What is famous about this place? '
      'Then practice with your AI tutor to discuss what you read.',
      'Original content');

    -- Lesson 3: Writing
    INSERT INTO public.lessons (course_id,title,kind,level,estimated_minutes,order_index,is_published)
    VALUES (course_id,'Writing: Introduce Yourself','writing','A1',20,3,true)
    RETURNING id INTO lesson_id;
    INSERT INTO public.lesson_contents (lesson_id,content_type,body,metadata)
    VALUES (lesson_id,'exercise',
      'Write 4-6 sentences introducing yourself in ' || r.name || '. Include your name, where you are from, and one hobby.',
      jsonb_build_object(
        'type','writing',
        'prompt','Write a short self-introduction in ' || r.name || '. Include: your name, where you are from, your age (optional), and one thing you enjoy doing.'
      )
    );

    -- Lesson 4: Reading 2
    INSERT INTO public.lessons (course_id,title,kind,level,estimated_minutes,order_index,is_published)
    VALUES (course_id,'Reading: Daily Life','reading','A2',15,4,true)
    RETURNING id INTO lesson_id;
    INSERT INTO public.lesson_contents (lesson_id,content_type,body,license_info)
    VALUES (lesson_id,'text',
      'This lesson focuses on reading about everyday life in a ' || r.name || '-speaking country. '
      'Topics include food, transportation, shopping, and social customs. '
      'As you read, pay attention to common verbs and adjectives used in daily situations. '
      'Use the AI tutor to ask questions about anything unclear.',
      'Original content');

    -- Lesson 5: Conversation
    INSERT INTO public.lessons (course_id,title,kind,level,estimated_minutes,order_index,is_published)
    VALUES (course_id,'Conversation: At a Cafe','conversation','A2',20,5,true)
    RETURNING id INTO lesson_id;
    INSERT INTO public.lesson_contents (lesson_id,content_type,body,metadata)
    VALUES (lesson_id,'text',
      'Practice a cafe conversation in ' || r.name || '. Your AI tutor will play the role of a local barista. '
      'Try to order a drink, ask about the menu, pay the bill, and make small talk.',
      jsonb_build_object(
        'scenario','cafe',
        'key_phrases', jsonb_build_array(
          'How much does it cost?',
          'I would like a coffee please',
          'The bill please',
          'It was delicious, thank you'
        )
      )
    );
  END IF;
END LOOP;
END $$;
