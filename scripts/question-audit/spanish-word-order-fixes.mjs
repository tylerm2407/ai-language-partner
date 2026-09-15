import { lessonRefs } from './lesson-refs.mjs';

/** Individually authored replacement tasks for confirmed answer-revealing
 * one-tile banks. Drafts require fresh bilingual/word-order review. */
export const spanishWordOrder = [
  // A2: everyday complete sentences and the precise local lesson objective.
  [566, 'Esposo', 'My husband has two sisters.', 'Mi esposo tiene dos hermanas.'],
  [578, 'Esposa', 'His wife is my best friend.', 'Su esposa es mi mejor amiga.'],
  [590, 'Novio', 'My boyfriend is twenty years old.', 'Mi novio tiene veinte años.'],
  [602, 'Novia', 'His girlfriend moved to Madrid last year.', 'Su novia se mudó a Madrid el año pasado.'],
  [614, 'Vecino', 'My neighbor always has dinner with his family on Sundays.', 'Mi vecino siempre cena con su familia los domingos.', ["Mi vecino cena siempre con su familia los domingos.","Mi vecino cena con su familia siempre los domingos."]],
  [626, 'Boda', 'The wedding will be in June.', 'La boda será en junio.'],
  [638, 'Enfermera', 'The nurse asks me if I have a fever.', 'La enfermera me pregunta si tengo fiebre.'],
  [650, 'Dentista', 'I have an appointment with the dentist tomorrow.', 'Tengo una cita con el dentista mañana.', ["Tengo con el dentista una cita mañana."]],
  [662, 'Estrés', 'At the pharmacy, I ask if stress can affect sleep.', 'En la farmacia, pregunto si el estrés puede afectar al sueño.', ["En la farmacia, pregunto si puede el estrés afectar al sueño.","En la farmacia, pregunto si puede afectar el estrés al sueño."]],
  [674, 'Cansado', 'I feel tired and I need to rest.', 'Me siento cansado y necesito descansar.'],
  [686, 'Descansar', 'I want to rest after my walk.', 'Quiero descansar después de mi paseo.'],
  [698, 'Dieta', 'My doctor recommends a varied diet.', 'Mi médico recomienda una dieta variada.'],
  [710, 'Lavar', 'The washing machine is in the kitchen for washing clothes.', 'La lavadora está en la cocina para lavar la ropa.'],
  [722, 'Barrer', 'I have to sweep the floor today.', 'Tengo que barrer el suelo hoy.'],
  [734, 'Cocinar', 'In my new apartment, I have more space for cooking.', 'En mi nuevo apartamento, tengo más espacio para cocinar.'],
  [746, 'Alquiler', 'My neighbor pays the rent at the beginning of the month.', 'Mi vecino paga el alquiler a principios de mes.'],
  [758, 'Mudarse', 'My sister wants to move because the apartment has no heating.', 'Mi hermana quiere mudarse porque el apartamento no tiene calefacción.'],
  [770, 'Apartamento', 'Our apartment has two bedrooms and a balcony.', 'Nuestro apartamento tiene dos dormitorios y un balcón.'],
  [782, 'Tímido', 'Although I am shy, I am happy with my friends.', 'Aunque soy tímido, estoy feliz con mis amigos.'],
  [794, 'Valiente', 'My brother is brave, but today he is afraid.', 'Mi hermano es valiente, pero hoy tiene miedo.'],
  [806, 'Amable', 'Our teacher is very kind to everyone.', 'Nuestra profesora es muy amable con todos.'],
  [818, 'Generoso', 'My friend is generous and always shares his food.', 'Mi amigo es generoso y siempre comparte su comida.', ["Mi amigo es generoso y comparte siempre su comida."]],
  [830, 'Perezoso', 'He gets angry when someone calls him lazy.', 'Se enfada cuando alguien lo llama perezoso.'],
  [842, 'Paciente', 'My mother is patient when she explains something to me.', 'Mi madre es paciente cuando me explica algo.'],
  [854, 'Compré', 'Yesterday I bought a book at the station.', 'Ayer compré un libro en la estación.'],
  [866, 'Viajé', 'Last weekend I traveled to Valencia by train.', 'El fin de semana pasado viajé a Valencia en tren.'],
  [878, 'Estudié', 'During my trip, I studied Spanish at a small school.', 'Durante mi viaje, estudié español en una escuela pequeña.'],
  [890, 'Jugué', 'On my tenth birthday, I played soccer with my cousins.', 'En mi décimo cumpleaños, jugué al fútbol con mis primos.'],
  [902, 'Trabajé', 'Yesterday I worked at the newspaper and wrote a news story.', 'Ayer trabajé en el periódico y escribí una noticia.'],
  [914, 'Hablé', 'Last night I spoke with my sister by phone.', 'Anoche hablé con mi hermana por teléfono.', ["Anoche con mi hermana hablé por teléfono."]],
  [926, 'Viajaré', 'Tomorrow I will travel to Rome by train.', 'Mañana viajaré a Roma en tren.'],
  [938, 'Trabajaré', 'I will work this summer to pay for my next vacation.', 'Trabajaré este verano para pagar mis próximas vacaciones.'],
  [950, 'Vacaciones', 'My goal is to learn French before the vacation.', 'Mi meta es aprender francés antes de las vacaciones.'],
  [962, 'Meta', 'My goal is to arrange an appointment for next Monday.', 'Mi meta es concertar una cita para el próximo lunes.'],
  [974, 'Sueño', 'I think my dream will come true next year.', 'Creo que mi sueño se cumplirá el año que viene.', ["Creo que se cumplirá mi sueño el año que viene."]],
  [986, 'Planear', 'We are going to plan the trip together tomorrow.', 'Vamos a planear el viaje juntos mañana.', ["Vamos a planear juntos el viaje mañana.","Vamos juntos a planear el viaje mañana."]],
  [1070, 'Regalo', 'On Three Kings Day, my grandmother gives me a gift.', 'El día de Reyes, mi abuela me da un regalo.', ["El día de Reyes, me da mi abuela un regalo."]],
  [1082, 'Fiesta', 'At our family party, we always eat the same cake.', 'En nuestra fiesta familiar, siempre comemos el mismo pastel.', ["En nuestra fiesta familiar, comemos siempre el mismo pastel."]],
  [1094, 'Celebrar', 'We want to celebrate with traditional music and dances.', 'Queremos celebrar con música y bailes tradicionales.', ["Queremos celebrar con bailes y música tradicionales."]],
  [1106, 'Música', 'There is live music in the square during the festival.', 'Hay música en directo en la plaza durante el festival.', ["Hay música en la plaza en directo durante el festival."]],
  [1118, 'Baile', 'I am going to give my sister dance classes as a gift.', 'Voy a regalarle clases de baile a mi hermana.'],
  [1130, 'Festival', 'Every year we go to the festival with our friends.', 'Cada año vamos al festival con nuestros amigos.', ["Cada año al festival vamos con nuestros amigos."]],
  // B1: reasons, experiences, connected narration and real/hypothetical plans.
  [1142, 'Sociedad', 'I believe that education can improve our society.', 'Creo que la educación puede mejorar nuestra sociedad.', ["Creo que puede la educación mejorar nuestra sociedad."]],
  [1156, 'Política', 'I respect your opinion, but I do not agree with that policy.', 'Respeto tu opinión, pero no estoy de acuerdo con esa política.'],
  [1170, 'Economía', 'The news explains how tourism affects the local economy.', 'La noticia explica cómo afecta el turismo a la economía local.', ["La noticia explica cómo el turismo afecta a la economía local."]],
  [1184, 'Argumentar', 'Before arguing in favor of a social change, we must listen to others.', 'Antes de argumentar a favor de un cambio social, debemos escuchar a los demás.'],
  [1198, 'Debate', 'I want to take part in the debate because the topic affects my neighborhood.', 'Quiero participar en el debate porque el tema afecta a mi barrio.', ["Quiero participar en el debate porque afecta el tema a mi barrio."]],
  [1212, 'Razón', 'The main reason is that many families cannot pay the rent.', 'La razón principal es que muchas familias no pueden pagar el alquiler.', ["La razón principal es que no pueden muchas familias pagar el alquiler.","La razón principal es que no pueden pagar muchas familias el alquiler."]],
  [1226, 'Contratar', 'During the interview, I asked when they were going to hire someone.', 'Durante la entrevista, pregunté cuándo iban a contratar a alguien.'],
  [1240, 'Despedir', 'The manager informed us that they were going to fire two employees.', 'La gerente nos informó de que iban a despedir a dos empleados.'],
  [1254, 'Colega', 'During the meeting, my colleague explained the objectives of the project.', 'Durante la reunión, mi colega explicó los objetivos del proyecto.', ["Durante la reunión, explicó mi colega los objetivos del proyecto."]],
  [1268, 'Gerente', 'I would like to become a manager in order to lead my own team.', 'Me gustaría ser gerente para dirigir mi propio equipo.'],
  [1296, 'Proyecto', 'The project was delayed because some data were still missing.', 'El proyecto se retrasó porque todavía faltaban algunos datos.', ["El proyecto se retrasó porque faltaban todavía algunos datos."]],
  [1310, 'Equipaje', 'Before booking the flight, check whether the ticket includes luggage.', 'Antes de reservar el vuelo, comprueba si el billete incluye equipaje.'],
  [1338, 'Retraso', 'When we arrived at the hotel, I explained that the train had been delayed.', 'Cuando llegamos al hotel, expliqué que el tren había sufrido un retraso.', ["Cuando llegamos al hotel, expliqué que había sufrido el tren un retraso."]],
  [1352, 'Cancelar', 'We had to cancel the excursion because it began to snow.', 'Tuvimos que cancelar la excursión porque empezó a nevar.'],
  [1366, 'Aventura', 'The adventure became complicated when we missed the last bus.', 'La aventura se complicó cuando perdimos el último autobús.'],
  [1380, 'Turista', 'The tourist asked us for help finding the way to the museum.', 'El turista nos pidió ayuda para encontrar el camino al museo.'],
  [1408, 'Conservación', 'The conservation of these forests is important because many species live here.', 'La conservación de estos bosques es importante porque muchas especies viven aquí.'],
  [1422, 'Energía', 'We can save energy if we turn off the lights when we leave.', 'Podemos ahorrar energía si apagamos las luces al salir.'],
  [1436, 'Solar', 'Solar energy allows us to generate electricity without burning fossil fuels.', 'La energía solar permite generar electricidad sin quemar combustibles fósiles.'],
  [1450, 'Carbono', 'To reduce our carbon footprint, we use the car less.', 'Para reducir nuestra huella de carbono, usamos menos el coche.'],
  [1478, 'Subir', 'Before uploading a photo, ask permission from the people who appear in it.', 'Antes de subir una foto, pide permiso a las personas que aparecen en ella.'],
  [1492, 'Pantalla', 'I have reduced the brightness of the screen because the battery is low.', 'He reducido el brillo de la pantalla porque queda poca batería.'],
  [1506, 'Teclado', 'I prefer to write long messages with a keyboard because it is more comfortable.', 'Prefiero escribir mensajes largos con un teclado porque es más cómodo.', ["Prefiero escribir con un teclado mensajes largos porque es más cómodo.","Prefiero escribir largos mensajes con un teclado porque es más cómodo.","Prefiero escribir con un teclado largos mensajes porque es más cómodo."]],
  [1548, 'Robot', 'This robot can answer questions, but it does not always understand the context.', 'Este robot puede responder preguntas, pero no siempre entiende el contexto.', ["Este robot puede responder preguntas, pero no entiende siempre el contexto."]],
  [1562, 'Luego', 'First we found the map and then we began to look for the house.', 'Primero encontramos el mapa y luego empezamos a buscar la casa.', ["Primero encontramos el mapa y empezamos luego a buscar la casa.","Primero encontramos el mapa y empezamos a buscar luego la casa."]],
  [1576, 'Finalmente', 'We walked for hours and finally reached the village before nightfall.', 'Caminamos durante horas y finalmente llegamos al pueblo antes del anochecer.', ["Caminamos durante horas y llegamos finalmente al pueblo antes del anochecer.","Caminamos durante horas y llegamos al pueblo finalmente antes del anochecer."]],
  [1604, 'Personaje', 'The character was walking through the forest when he heard a strange noise.', 'El personaje estaba caminando por el bosque cuando oyó un ruido extraño.', ["El personaje estaba por el bosque caminando cuando oyó un ruido extraño.","El personaje por el bosque estaba caminando cuando oyó un ruido extraño."]],
  [1618, 'Trama', 'The plot begins in a small town where everyone knows one another.', 'La trama empieza en un pueblo pequeño donde todos se conocen.', ["La trama empieza en un pequeño pueblo donde todos se conocen."]],
  [1632, 'Comienzo', 'At the beginning of the story, the protagonist did not know who had sent the letter.', 'Al comienzo de la historia, el protagonista no sabía quién había enviado la carta.', ["Al comienzo de la historia, no sabía el protagonista quién había enviado la carta."]],
  [1646, 'Quizás', 'If it rains tomorrow, perhaps we will stay at home.', 'Si llueve mañana, quizás nos quedemos en casa.'],
  [1660, 'Imagina', 'Imagine what you would do if you had a whole year to travel.', 'Imagina qué harías si tuvieras un año entero para viajar.'],
  [1674, 'Supongamos', 'Suppose you lose your passport; it would be a good idea to contact the consulate.', 'Supongamos que pierdes el pasaporte; sería buena idea contactar con el consulado.'],
  [1716, 'Arrepentimiento', 'I feel regret because I did not accept the opportunity to study abroad.', 'Siento arrepentimiento porque no acepté la oportunidad de estudiar en el extranjero.'],
  [1730, 'Genial', 'In a formal request, I would write “I would appreciate your reply” instead of “great”.', 'En una petición formal, escribiría «agradecería su respuesta» en lugar de «genial».'],
  [1744, 'Increíble', 'Your concert was incredible and I am really glad I went!', '¡Tu concierto fue increíble y me alegro mucho de haber ido!', ["¡Tu concierto fue increíble y mucho me alegro de haber ido!"]],
  [1786, 'Tío', 'In Spain, you can call a friend dude, but avoid it in a formal interview.', 'En España, puedes llamar tío a un amigo, pero evítalo en una entrevista formal.'],
  [1800, 'Formal', 'I use a more formal tone when I write to someone I do not know.', 'Uso un tono más formal cuando escribo a alguien que no conozco.'],
  // B2: concession, qualification, evaluation and professional/literary purpose.
  [1817, 'Verdad', 'Although we seek the truth, our experiences influence how we interpret it.', 'Aunque busquemos la verdad, nuestras experiencias influyen en cómo la interpretamos.', ["Aunque busquemos la verdad, influyen nuestras experiencias en cómo la interpretamos."]],
  [1831, 'Sabiduría', 'Wisdom does not consist in having all the answers, but in recognizing our limits.', 'La sabiduría no consiste en tener todas las respuestas, sino en reconocer nuestros límites.'],
  [1845, 'Creencia', 'A deeply rooted belief can persist even when the evidence contradicts it.', 'Una creencia muy arraigada puede persistir incluso cuando las pruebas la contradicen.'],
  [1859, 'Duda', 'The reasonable doubt raised by these data forces us to review the initial conclusion.', 'La duda razonable que plantean estos datos nos obliga a revisar la conclusión inicial.', ["La duda razonable que estos datos plantean nos obliga a revisar la conclusión inicial."]],
  [1873, 'Libertad', 'Individual freedom must be considered together with the responsibility we have toward others.', 'La libertad individual debe considerarse junto con la responsabilidad que tenemos hacia los demás.'],
  [1887, 'Justicia', 'For there to be justice, it is not enough for a rule to apply equally to everyone.', 'Para que haya justicia, no basta con que una norma se aplique por igual a todos.', ["Para que haya justicia, no basta con que se aplique una norma por igual a todos.","Para que haya justicia, no basta con que se aplique por igual una norma a todos.","Para que haya justicia, no basta con que una norma por igual se aplique a todos."]],
  [1901, 'Afirmación', 'This claim is only convincing if it is supported by evidence that can be checked.', 'Esta afirmación solo resulta convincente si se apoya en pruebas que puedan comprobarse.', ["Esta afirmación resulta convincente solo si se apoya en pruebas que puedan comprobarse."]],
  [1915, 'Falacia', 'Attacking the person rather than examining their reasons is a fallacy, not a valid counterargument.', 'Atacar a la persona en vez de examinar sus razones es una falacia, no un contraargumento válido.'],
  [1929, 'Retórica', 'Although the rhetoric of the speech is persuasive, its central proposal still needs evidence.', 'Aunque la retórica del discurso es persuasiva, su propuesta central todavía necesita pruebas.', ["Aunque la retórica del discurso es persuasiva, todavía su propuesta central necesita pruebas."]],
  [1943, 'Sesgo', 'Confirmation bias leads us to favor evidence that supports our beliefs and to ignore the rest.', 'El sesgo de confirmación nos lleva a favorecer las pruebas que apoyan nuestras creencias y a ignorar las demás.'],
  [1957, 'Argumento', 'Before rejecting your argument, I would like to clarify which of its premises you consider essential.', 'Antes de rechazar su argumento, quisiera aclarar cuáles de sus premisas considera esenciales.'],
  [1971, 'Persuadir', 'To persuade an undecided audience, it is advisable to anticipate their objections and respond with verifiable reasons.', 'Para persuadir a un público indeciso, conviene anticipar sus objeciones y responder con razones verificables.'],
  [1985, 'Acta', 'I am attaching the minutes of the meeting so that you can review the agreements before signing.', 'Adjunto el acta de la reunión para que pueda revisar los acuerdos antes de firmar.'],
  [1999, 'Delegar', 'In this presentation, I will explain why delegating tasks does not mean giving up responsibility for the result.', 'En esta presentación, explicaré por qué delegar tareas no significa renunciar a la responsabilidad por el resultado.'],
  [2013, 'Eficiencia', 'We would accept the proposed deadline provided that the new process improved efficiency without reducing quality.', 'Aceptaríamos el plazo propuesto siempre que el nuevo proceso mejorara la eficiencia sin reducir la calidad.', ["Aceptaríamos el plazo propuesto siempre que el proceso nuevo mejorara la eficiencia sin reducir la calidad.","Aceptaríamos el plazo propuesto siempre que mejorara el nuevo proceso la eficiencia sin reducir la calidad.","Aceptaríamos el plazo propuesto siempre que mejorara el proceso nuevo la eficiencia sin reducir la calidad."]],
  [2027, 'Plazo', 'I propose extending the deadline so that we can evaluate the results before making a final decision.', 'Propongo ampliar el plazo para que podamos evaluar los resultados antes de tomar una decisión definitiva.'],
  [2041, 'Negociación', 'After meeting you at the conference, I would like to continue our negotiation about a possible collaboration.', 'Después de conocerle en el congreso, me gustaría continuar nuestra negociación sobre una posible colaboración.'],
  [2055, 'Propuesta', 'Although your proposal seems viable to us, we need to clarify the costs before approving it.', 'Aunque su propuesta nos parece viable, necesitamos aclarar los costes antes de aprobarla.'],
  [2083, 'Reseña', 'In my review, I emphasize that the unreliable narrator makes the reader question each version of events.', 'En mi reseña, destaco que el narrador poco fiable hace que el lector cuestione cada versión de los hechos.', ["En mi reseña, destaco que el narrador poco fiable hace que cuestione el lector cada versión de los hechos.","En mi reseña, destaco que el poco fiable narrador hace que el lector cuestione cada versión de los hechos.","En mi reseña, destaco que el poco fiable narrador hace que cuestione el lector cada versión de los hechos."]],
  [2111, 'Inspiración', 'The composer found inspiration in traditional melodies, although she transformed them through unexpected harmonies.', 'La compositora encontró inspiración en melodías tradicionales, aunque las transformó mediante armonías inesperadas.'],
  [2125, 'Novela', 'If I wrote a novel, I would alternate the voices of two characters whose memories contradict one another.', 'Si escribiera una novela, alternaría las voces de dos personajes cuyos recuerdos se contradicen.'],
  [2139, 'Poema', 'This poem suggests a feeling of loss without naming it directly, which reinforces its ambiguity.', 'Este poema sugiere una sensación de pérdida sin nombrarla directamente, lo que refuerza su ambigüedad.'],
];

export function spanishWordOrderFixes(set) {
  const get = lessonRefs(set.snapshot, 'es');
  const seen = new Set();
  for (const [number, oldKey, english, answer, alternatives = []] of spanishWordOrder) {
    const { exercise, lesson, unit, course, ref } = get(number);
    if (seen.has(number)) throw new Error(`Duplicate replacement ${ref}`);
    seen.add(number);
    const oldTiles = exercise.metadata?.tiles ?? exercise.correct_answer.split(' ');
    const oldDistractors = exercise.metadata?.distractors ?? [];
    if (exercise.type !== 'sentence_construction' || exercise.correct_answer !== oldKey || oldTiles.length !== 1 || oldDistractors.length) throw new Error(`Not an audited sole-answer tile: ${ref}`);
    const tiles = answer.split(/\s+/);
    if (tiles.length < 4) throw new Error(`Replacement has no meaningful sentence order: ${ref}`);
    // A fixed opening and ending constrain marked but grammatical re-orderings.
    // The middle still has to be constructed; every supplied word is required.
    const anchorLength = tiles.length >= 8 ? 2 : 1;
    const start = tiles.slice(0, anchorLength).join(' ');
    const end = tiles.slice(-anchorLength).join(' ');
    set.update('exercises', exercise.id, {
      prompt: `Arrange every word to translate: “${english}” Start with “${start}” and end with “${end}”.`,
      correct_answer: answer,
      accepted_answers: alternatives,
      metadata: { ...exercise.metadata, tiles, distractors: [] },
    }, `${ref}: Replace a single answer tile with an authored ${course.cefr_level} sentence-order task for ${unit.title} / ${lesson.title}. Preserve the exercise ID and construction format. Use everyday clauses at A2 and progressively more developed reasoning/narration later; this replacement requires independent review.`);
  }
}
