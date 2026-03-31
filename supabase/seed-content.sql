-- Seed Content: Reading Passages & Writing Prompts for Spanish A1, A2, B2
-- B1 content already exists in seed.sql
-- Run after seed.sql: npx supabase db push

-- ============================================================
-- SPANISH A1 — Reading Passages (simple sentences, 20-50 words)
-- ============================================================

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a1-001', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Mi familia', 'Hola. Me llamo Carlos. Tengo una familia pequeña. Mi mamá se llama Ana. Mi papá se llama Pedro. Tengo un hermano. Se llama Luis. Vivimos en una casa grande. Tenemos un perro.', 'Hello. My name is Carlos. I have a small family. My mom is named Ana. My dad is named Pedro. I have a brother. His name is Luis. We live in a big house. We have a dog.', 40, true);

INSERT INTO reading_annotations (id, passage_id, word_or_phrase, translation, start_index, end_index, part_of_speech) VALUES
('seed-ann-a1-001-1', 'seed-read-a1-001', 'familia', 'family', 38, 45, 'noun'),
('seed-ann-a1-001-2', 'seed-read-a1-001', 'pequeña', 'small', 46, 53, 'adjective'),
('seed-ann-a1-001-3', 'seed-read-a1-001', 'hermano', 'brother', 114, 121, 'noun'),
('seed-ann-a1-001-4', 'seed-read-a1-001', 'casa', 'house', 148, 152, 'noun'),
('seed-ann-a1-001-5', 'seed-read-a1-001', 'perro', 'dog', 168, 173, 'noun');

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a1-001-1', 'seed-read-a1-001', 0, 'What is the boy''s name?', 'multiple_choice', 'Carlos', '{}', '{"Carlos","Luis","Pedro","Ana"}'),
('seed-rq-a1-001-2', 'seed-read-a1-001', 1, 'Does Carlos have a dog?', 'true_false', 'True', '{}', '{"True","False"}');

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a1-002', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'En la tienda', 'Voy a la tienda. Necesito leche, pan y fruta. La leche cuesta dos euros. El pan cuesta un euro. Las manzanas cuestan tres euros. Pago con dinero. La señora dice: Gracias.', 'I go to the store. I need milk, bread and fruit. The milk costs two euros. The bread costs one euro. The apples cost three euros. I pay with money. The lady says: Thank you.', 35, true);

INSERT INTO reading_annotations (id, passage_id, word_or_phrase, translation, start_index, end_index, part_of_speech) VALUES
('seed-ann-a1-002-1', 'seed-read-a1-002', 'tienda', 'store', 10, 16, 'noun'),
('seed-ann-a1-002-2', 'seed-read-a1-002', 'leche', 'milk', 27, 32, 'noun'),
('seed-ann-a1-002-3', 'seed-read-a1-002', 'pan', 'bread', 34, 37, 'noun'),
('seed-ann-a1-002-4', 'seed-read-a1-002', 'cuesta', 'costs', 52, 58, 'verb'),
('seed-ann-a1-002-5', 'seed-read-a1-002', 'dinero', 'money', 132, 138, 'noun');

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a1-002-1', 'seed-read-a1-002', 0, 'How much does the milk cost?', 'multiple_choice', 'Two euros', '{}', '{"One euro","Two euros","Three euros","Five euros"}'),
('seed-rq-a1-002-2', 'seed-read-a1-002', 1, 'What fruit does the person buy?', 'short_answer', 'Apples', '{"Manzanas"}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a1-003', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Los colores', 'El cielo es azul. El sol es amarillo. Las hojas son verdes. Las flores son rojas. La nieve es blanca. La noche es negra. Me gusta el color azul. ¿Cuál es tu color favorito?', 'The sky is blue. The sun is yellow. The leaves are green. The flowers are red. The snow is white. The night is black. I like the color blue. What is your favorite color?', 38, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a1-003-1', 'seed-read-a1-003', 0, 'What color is the sky?', 'multiple_choice', 'Blue', '{}', '{"Red","Blue","Green","Yellow"}');

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a1-004', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Mi día', 'Me despierto a las siete. Desayuno leche y pan. Voy a la escuela a las ocho. Estudio español y matemáticas. Como a las doce. Regreso a casa a las tres. Ceno con mi familia. Me acuesto a las diez.', 'I wake up at seven. I have milk and bread for breakfast. I go to school at eight. I study Spanish and math. I eat at twelve. I return home at three. I have dinner with my family. I go to bed at ten.', 42, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a1-004-1', 'seed-read-a1-004', 0, 'What time does the person wake up?', 'multiple_choice', 'Seven', '{}', '{"Six","Seven","Eight","Nine"}'),
('seed-rq-a1-004-2', 'seed-read-a1-004', 1, 'What does the person study?', 'short_answer', 'Spanish and math', '{"español y matemáticas"}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a1-005', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'El parque', 'Hoy voy al parque. El parque es grande y bonito. Hay árboles y flores. Los niños juegan con una pelota. Un perro corre por el pasto. Me siento en un banco y leo un libro.', 'Today I go to the park. The park is big and pretty. There are trees and flowers. The children play with a ball. A dog runs on the grass. I sit on a bench and read a book.', 38, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a1-005-1', 'seed-read-a1-005', 0, 'Is the park big?', 'true_false', 'True', '{}', '{"True","False"}');

-- ============================================================
-- SPANISH A1 — Writing Prompts (sentences, 10-50 words)
-- ============================================================

INSERT INTO writing_prompts (id, course_id, cefr_level, prompt_text, prompt_type, min_words, max_words) VALUES
('seed-wp-a1-001', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Write 3 sentences about yourself. Include your name, age, and where you live. Write in Spanish.', 'guided', 10, 50),
('seed-wp-a1-002', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Describe your family in Spanish. How many people are in your family? What are their names?', 'guided', 10, 50),
('seed-wp-a1-003', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Write what you eat for breakfast, lunch, and dinner. Use simple sentences in Spanish.', 'guided', 10, 50),
('seed-wp-a1-004', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Describe your house or apartment. How many rooms does it have? What color is it?', 'guided', 10, 50),
('seed-wp-a1-005', 'aabbccdd-1111-0000-0000-000000000000', 'A1', 'Write about your favorite animal. What is it? What color is it? Where does it live?', 'guided', 10, 50);

-- ============================================================
-- SPANISH A2 — Reading Passages (paragraphs, 50-150 words)
-- ============================================================

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a2-001', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Un fin de semana perfecto', 'El sábado pasado tuve un fin de semana perfecto. Me desperté tarde, a las diez de la mañana. Desayuné huevos con tostadas y jugo de naranja. Después, fui al centro comercial con mis amigos. Compramos ropa nueva y comimos pizza en un restaurante italiano. Por la noche, vimos una película de comedia en el cine. El domingo descansé en casa y leí un libro interesante. Fue un fin de semana muy divertido.', 'Last Saturday I had a perfect weekend. I woke up late, at ten in the morning. I had eggs with toast and orange juice for breakfast. Then I went to the mall with my friends. We bought new clothes and ate pizza at an Italian restaurant. In the evening, we watched a comedy movie at the cinema. On Sunday I rested at home and read an interesting book. It was a very fun weekend.', 80, true);

INSERT INTO reading_annotations (id, passage_id, word_or_phrase, translation, start_index, end_index, part_of_speech) VALUES
('seed-ann-a2-001-1', 'seed-read-a2-001', 'fin de semana', 'weekend', 30, 43, 'noun'),
('seed-ann-a2-001-2', 'seed-read-a2-001', 'desperté', 'woke up', 58, 66, 'verb'),
('seed-ann-a2-001-3', 'seed-read-a2-001', 'centro comercial', 'mall', 158, 174, 'noun'),
('seed-ann-a2-001-4', 'seed-read-a2-001', 'película', 'movie', 290, 298, 'noun'),
('seed-ann-a2-001-5', 'seed-read-a2-001', 'divertido', 'fun', 397, 406, 'adjective');

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a2-001-1', 'seed-read-a2-001', 0, 'What time did the person wake up on Saturday?', 'multiple_choice', 'Ten in the morning', '{}', '{"Seven","Eight","Ten in the morning","Noon"}'),
('seed-rq-a2-001-2', 'seed-read-a2-001', 1, 'What kind of movie did they watch?', 'short_answer', 'Comedy', '{"comedia"}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a2-002', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Mi mascota', 'Tengo un gato que se llama Michi. Es de color naranja y blanco. Tiene tres años. Le gusta dormir mucho, especialmente en mi cama. Por las mañanas, siempre quiere comida. Juega con una pelota pequeña y a veces persigue su cola. Los fines de semana, le gusta sentarse en la ventana y mirar los pájaros. Es muy tranquilo y cariñoso. Lo quiero mucho.', 'I have a cat named Michi. He is orange and white. He is three years old. He likes to sleep a lot, especially on my bed. In the mornings, he always wants food. He plays with a small ball and sometimes chases his tail. On weekends, he likes to sit by the window and watch the birds. He is very calm and affectionate. I love him a lot.', 75, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a2-002-1', 'seed-read-a2-002', 0, 'What color is Michi?', 'multiple_choice', 'Orange and white', '{}', '{"Black","Orange and white","Gray","Brown"}'),
('seed-rq-a2-002-2', 'seed-read-a2-002', 1, 'What does Michi like to do on weekends?', 'short_answer', 'Sit by the window and watch birds', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a2-003', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'El restaurante', 'Ayer fui a un restaurante con mi familia. El restaurante se llama "La Casa del Sabor". Pedimos paella, ensalada y sopa. La comida estaba deliciosa. Mi hermana pidió un postre de chocolate. El camarero fue muy amable. Pagamos la cuenta y dejamos una propina. Queremos volver el próximo sábado.', 'Yesterday I went to a restaurant with my family. The restaurant is called "La Casa del Sabor". We ordered paella, salad and soup. The food was delicious. My sister ordered a chocolate dessert. The waiter was very nice. We paid the bill and left a tip. We want to come back next Saturday.', 60, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a2-003-1', 'seed-read-a2-003', 0, 'What is the restaurant called?', 'short_answer', 'La Casa del Sabor', '{}', NULL),
('seed-rq-a2-003-2', 'seed-read-a2-003', 1, 'Was the food good?', 'true_false', 'True', '{}', '{"True","False"}');

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a2-004', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Mi ciudad', 'Vivo en una ciudad mediana. Tiene un parque grande en el centro con muchos árboles y una fuente. Hay tiendas, restaurantes y un cine. Mi lugar favorito es la biblioteca porque me gusta leer. Los autobuses son el transporte más común. En verano hace calor y mucha gente va a la piscina pública. Me gusta vivir aquí porque es tranquilo y seguro.', 'I live in a medium-sized city. It has a large park in the center with many trees and a fountain. There are shops, restaurants and a cinema. My favorite place is the library because I like to read. Buses are the most common transportation. In summer it is hot and many people go to the public pool. I like living here because it is quiet and safe.', 70, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a2-004-1', 'seed-read-a2-004', 0, 'What is the person''s favorite place?', 'multiple_choice', 'The library', '{}', '{"The park","The library","The cinema","The pool"}'),
('seed-rq-a2-004-2', 'seed-read-a2-004', 1, 'What do people do in summer?', 'short_answer', 'Go to the public pool', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-a2-005', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Las vacaciones', 'El verano pasado viajé a la playa con mi familia. Nos quedamos en un hotel pequeño cerca del mar. Todos los días nadábamos en el océano y construíamos castillos de arena. Por las noches, cenábamos en restaurantes locales y probábamos la comida típica. También visitamos un acuario donde vimos delfines y tiburones. Fue una semana increíble.', 'Last summer I traveled to the beach with my family. We stayed in a small hotel near the sea. Every day we swam in the ocean and built sandcastles. In the evenings, we ate at local restaurants and tried the typical food. We also visited an aquarium where we saw dolphins and sharks. It was an incredible week.', 65, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-a2-005-1', 'seed-read-a2-005', 0, 'Where did the family stay?', 'multiple_choice', 'A small hotel near the sea', '{}', '{"A big house","A small hotel near the sea","A campsite","An apartment"}'),
('seed-rq-a2-005-2', 'seed-read-a2-005', 1, 'What animals did they see at the aquarium?', 'short_answer', 'Dolphins and sharks', '{"delfines y tiburones"}', NULL);

-- ============================================================
-- SPANISH A2 — Writing Prompts (paragraphs, 50-150 words)
-- ============================================================

INSERT INTO writing_prompts (id, course_id, cefr_level, prompt_text, prompt_type, min_words, max_words) VALUES
('seed-wp-a2-001', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Write a paragraph about what you did last weekend. Use past tense verbs. Mention at least 3 activities.', 'guided', 50, 150),
('seed-wp-a2-002', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Describe your best friend. What do they look like? What do they like to do? Why are they your best friend?', 'guided', 50, 150),
('seed-wp-a2-003', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Write about your favorite holiday or celebration. What do you do? What food do you eat? Who do you celebrate with?', 'guided', 50, 150),
('seed-wp-a2-004', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Describe your school or workplace. What do you do there? What are the people like? Do you enjoy it?', 'guided', 50, 150),
('seed-wp-a2-005', 'aabbccdd-1111-0000-0000-a20000000000', 'A2', 'Write about a trip you want to take. Where would you go? How would you get there? What would you do?', 'guided', 50, 150);

-- ============================================================
-- SPANISH B2 — Reading Passages (essays/articles, 300-500+ words)
-- ============================================================

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-b2-001', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'La inteligencia artificial y el futuro del trabajo', 'La inteligencia artificial está transformando radicalmente el panorama laboral global. Mientras que algunos expertos predicen que millones de empleos serán automatizados en las próximas décadas, otros argumentan que surgirán nuevas profesiones que aún no podemos imaginar. La realidad, como suele ocurrir, probablemente se encuentre en algún punto intermedio.

Las industrias manufactureras ya han experimentado cambios significativos con la introducción de robots y sistemas automatizados. Sin embargo, los sectores que requieren creatividad, empatía y pensamiento crítico parecen más resistentes a la automatización. Los profesionales de la salud, los educadores y los artistas, por ejemplo, difícilmente serán reemplazados por máquinas en un futuro cercano.

Lo que resulta particularmente interesante es cómo la IA está creando nuevas oportunidades laborales. Especialistas en ética de la IA, ingenieros de datos y expertos en interacción humano-máquina son profesiones que apenas existían hace una década. Además, la IA está democratizando el acceso a herramientas que antes solo estaban disponibles para grandes corporaciones.

El desafío principal no es la tecnología en sí misma, sino nuestra capacidad de adaptación. Los sistemas educativos deben evolucionar para preparar a las futuras generaciones con habilidades que complementen, en lugar de competir, con las capacidades de la inteligencia artificial. El aprendizaje continuo y la flexibilidad serán las competencias más valiosas en este nuevo paradigma laboral.', NULL, 200, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-b2-001-1', 'seed-read-b2-001', 0, 'According to the text, which sectors are more resistant to automation?', 'multiple_choice', 'Those requiring creativity, empathy and critical thinking', '{}', '{"Manufacturing","Those requiring creativity, empathy and critical thinking","Technology","Finance"}'),
('seed-rq-b2-001-2', 'seed-read-b2-001', 1, 'What does the author identify as the main challenge?', 'short_answer', 'Our capacity to adapt', '{"la capacidad de adaptación"}', NULL),
('seed-rq-b2-001-3', 'seed-read-b2-001', 2, 'Name two new professions created by AI mentioned in the text.', 'short_answer', 'AI ethics specialists and data engineers', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-b2-002', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'El impacto psicológico de las redes sociales', 'En la última década, las redes sociales han revolucionado nuestra forma de comunicarnos, pero su impacto en la salud mental está generando un debate cada vez más intenso entre investigadores y profesionales de la salud. Estudios recientes señalan una correlación preocupante entre el uso excesivo de plataformas digitales y el aumento de trastornos de ansiedad y depresión, especialmente entre adolescentes.

El fenómeno de la comparación social se ha amplificado exponencialmente. Antes de las redes sociales, nuestro marco de referencia se limitaba a nuestro entorno inmediato. Ahora, nos comparamos constantemente con millones de personas que presentan versiones idealizadas de sus vidas. Esta exposición continua a imágenes de perfección inalcanzable puede erosionar la autoestima y generar sentimientos de inadecuación.

No obstante, sería injusto demonizar completamente estas plataformas. Las redes sociales también han permitido que personas con intereses específicos encuentren comunidades de apoyo, han facilitado movimientos sociales significativos y han democratizado el acceso a la información. Para muchas personas en situación de aislamiento geográfico o social, estas herramientas representan una conexión vital con el mundo exterior.

La clave parece residir en el uso consciente y moderado. Expertos recomiendan establecer límites de tiempo, ser críticos con el contenido que consumimos y recordar que lo que vemos en línea raramente refleja la complejidad de la vida real. La educación digital, tanto para jóvenes como para adultos, se ha convertido en una necesidad urgente de nuestra sociedad.', NULL, 220, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-b2-002-1', 'seed-read-b2-002', 0, 'What has social comparison been amplified by?', 'short_answer', 'Social media / digital platforms', '{}', NULL),
('seed-rq-b2-002-2', 'seed-read-b2-002', 1, 'The text argues that social media is entirely negative.', 'true_false', 'False', '{}', '{"True","False"}'),
('seed-rq-b2-002-3', 'seed-read-b2-002', 2, 'What do experts recommend regarding social media use?', 'short_answer', 'Conscious and moderate use, setting time limits', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-b2-003', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'La crisis de la vivienda en las grandes ciudades', 'El acceso a una vivienda digna se ha convertido en uno de los mayores desafíos sociales del siglo XXI en las grandes metrópolis. Los precios del alquiler y la compra de inmuebles han alcanzado niveles que resultan inalcanzables para una proporción creciente de la población, especialmente para los jóvenes que intentan independizarse por primera vez.

Las causas de esta crisis son múltiples y complejas. La especulación inmobiliaria, la gentrificación de barrios históricos, el turismo masivo que convierte viviendas en alojamientos temporales, y la insuficiente construcción de vivienda social han contribuido a crear una tormenta perfecta. En ciudades como Madrid, Barcelona, Ciudad de México y Buenos Aires, muchas familias destinan más del cincuenta por ciento de sus ingresos al pago del alquiler.

Diversas ciudades están implementando medidas para abordar esta problemática. Algunas han establecido límites al precio del alquiler, otras han regulado las plataformas de alquiler vacacional, y varias están invirtiendo en proyectos de vivienda pública. Sin embargo, los expertos coinciden en que se necesita un enfoque integral que combine regulación, inversión pública y colaboración entre el sector público y privado.

La cuestión de la vivienda no es meramente económica; tiene profundas implicaciones sociales, emocionales y políticas. La imposibilidad de acceder a un hogar propio afecta la planificación familiar, la estabilidad emocional y el sentido de pertenencia a una comunidad.', NULL, 210, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-b2-003-1', 'seed-read-b2-003', 0, 'What percentage of income do many families spend on rent?', 'multiple_choice', 'More than fifty percent', '{}', '{"Twenty percent","Thirty percent","More than fifty percent","Seventy percent"}'),
('seed-rq-b2-003-2', 'seed-read-b2-003', 1, 'Name two causes of the housing crisis mentioned.', 'short_answer', 'Real estate speculation, gentrification, mass tourism, or insufficient social housing', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-b2-004', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'La sostenibilidad en la industria de la moda', 'La industria de la moda es una de las más contaminantes del planeta. La producción textil genera aproximadamente el diez por ciento de las emisiones globales de carbono y es responsable del veinte por ciento de la contaminación del agua a nivel mundial. El modelo de "moda rápida" que predomina actualmente incentiva el consumo desmedido: se producen más de cien mil millones de prendas al año, y una proporción alarmante termina en vertederos.

Frente a esta realidad, ha surgido un movimiento creciente hacia la moda sostenible. Diseñadores y marcas están experimentando con materiales reciclados, tintes naturales y procesos de producción que minimizan el impacto ambiental. Conceptos como la economía circular, que propone diseñar productos pensando en su reutilización y reciclaje desde el inicio, están ganando terreno en la industria.

Los consumidores también juegan un papel fundamental. La tendencia del "armario cápsula", que consiste en poseer pocas prendas versátiles y de calidad, está creciendo entre quienes buscan reducir su huella ambiental. Asimismo, el mercado de segunda mano ha experimentado un auge sin precedentes gracias a plataformas digitales que facilitan la compraventa de ropa usada.

Sin embargo, la transición hacia una moda verdaderamente sostenible requiere cambios sistémicos que van más allá de las decisiones individuales de los consumidores. Se necesitan regulaciones más estrictas, transparencia en las cadenas de suministro y un compromiso real por parte de las grandes corporaciones textiles.', NULL, 225, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-b2-004-1', 'seed-read-b2-004', 0, 'What percentage of global carbon emissions does textile production generate?', 'multiple_choice', 'Approximately ten percent', '{}', '{"Five percent","Approximately ten percent","Twenty percent","Thirty percent"}'),
('seed-rq-b2-004-2', 'seed-read-b2-004', 1, 'What is a ''capsule wardrobe''?', 'short_answer', 'Owning few versatile, quality garments', '{}', NULL);

INSERT INTO reading_passages (id, course_id, cefr_level, title, content, content_translation, word_count, is_published) VALUES
('seed-read-b2-005', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'El bilingüismo y sus beneficios cognitivos', 'Durante décadas, los investigadores han estudiado los efectos del bilingüismo en el cerebro humano, y los resultados son fascinantes. Las personas que hablan dos o más idiomas de forma habitual no solo poseen una herramienta comunicativa adicional, sino que también experimentan beneficios cognitivos significativos que afectan diversas áreas de su funcionamiento mental.

Uno de los hallazgos más notables es que el cerebro bilingüe muestra mayor flexibilidad cognitiva. Al alternar constantemente entre dos sistemas lingüísticos, el cerebro desarrolla una capacidad superior para cambiar entre tareas, filtrar información irrelevante y resolver problemas de manera creativa. Esta "gimnasia mental" continua fortalece las funciones ejecutivas del cerebro.

Particularmente relevante es la investigación sobre el envejecimiento cerebral. Estudios longitudinales han demostrado que el bilingüismo puede retrasar la aparición de síntomas de deterioro cognitivo y demencia en un promedio de cuatro a cinco años. Este efecto protector se observa independientemente del nivel educativo o socioeconómico de los individuos.

Además, el bilingüismo desarrolla una mayor sensibilidad metalingüística, es decir, la capacidad de reflexionar sobre el lenguaje como sistema. Los niños bilingües suelen comprender antes conceptos abstractos relacionados con la comunicación y muestran mayor facilidad para aprender idiomas adicionales.

No obstante, es importante señalar que estos beneficios son más pronunciados cuando ambos idiomas se utilizan activamente y con regularidad. El simple conocimiento pasivo de un segundo idioma no produce los mismos efectos que su uso cotidiano en contextos variados.', NULL, 240, true);

INSERT INTO reading_questions (id, passage_id, order_index, question_text, question_type, correct_answer, accepted_answers, options) VALUES
('seed-rq-b2-005-1', 'seed-read-b2-005', 0, 'By how many years can bilingualism delay cognitive decline?', 'multiple_choice', 'Four to five years', '{}', '{"One to two years","Four to five years","Seven to eight years","Ten years"}'),
('seed-rq-b2-005-2', 'seed-read-b2-005', 1, 'What is metalinguistic sensitivity?', 'short_answer', 'The ability to reflect on language as a system', '{}', NULL),
('seed-rq-b2-005-3', 'seed-read-b2-005', 2, 'Are passive knowledge and active use equally beneficial?', 'true_false', 'False', '{}', '{"True","False"}');

-- ============================================================
-- SPANISH B2 — Writing Prompts (full essays, 300-500 words)
-- ============================================================

INSERT INTO writing_prompts (id, course_id, cefr_level, prompt_text, prompt_type, min_words, max_words) VALUES
('seed-wp-b2-001', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'Write an argumentative essay about whether artificial intelligence will create more jobs than it eliminates. Present arguments for both sides and conclude with your own well-reasoned opinion. Use formal register and appropriate connectors.', 'free', 300, 500),
('seed-wp-b2-002', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'Analyze the impact of globalization on local cultures. Is cultural homogenization inevitable, or can local traditions coexist with global influences? Support your arguments with specific examples.', 'free', 300, 500),
('seed-wp-b2-003', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'Write a formal letter to a newspaper editor expressing your opinion about the housing crisis in major cities. Propose at least three concrete solutions and explain why you believe they would be effective.', 'guided', 300, 500),
('seed-wp-b2-004', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'Compare and contrast the education systems of two different countries. Discuss their strengths and weaknesses, and propose improvements based on what each system does well. Use subjunctive mood where appropriate.', 'free', 300, 500),
('seed-wp-b2-005', 'aabbccdd-1111-0000-0000-b20000000000', 'B2', 'Write a critical review of a book, film, or TV series you have recently consumed. Analyze its themes, writing/directing quality, and cultural significance. Use literary/cinematic vocabulary and express nuanced opinions.', 'free', 300, 500);
