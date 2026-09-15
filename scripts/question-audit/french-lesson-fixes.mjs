import { lessonRefs } from './lesson-refs.mjs';

// Draft narrow remediation, authored after two independent full lesson passes.
// Independent approval of these NEW values is still required. No DB operation.
// Sole-tile redesign, open-production grading and curriculum gaps are separate.
export function frenchLessonFixes(set) {
  const { row, update, replaceText } = set;
  const get = lessonRefs(set.snapshot, 'fr');
  const edit = (n, fields, reason, sources = []) => update('exercises', get(n).exercise.id, fields, `${get(n).ref}: ${reason}`, sources);
  const text = (n, field, before, after, reason, sources = []) => replaceText('exercises', get(n).exercise.id, field, [[before, after]], `${get(n).ref}: ${reason}`, sources);
  const choice = (n, before, after, reason, sources = []) => {
    const e = get(n).exercise;
    if (!Array.isArray(e.options) || e.options.filter(x => x === before).length !== 1 || e.options.includes(after) || e.correct_answer === before) throw new Error(`Unexpected fr-E${n} options`);
    edit(n, { options:e.options.map(x => x === before ? after : x), ...(e.distractors.includes(before) ? {distractors:e.distractors.map(x => x === before ? after : x)} : {}) }, reason, sources);
  };
  const keyedChoice = (n, before, after, reason) => {
    const e = get(n).exercise;
    if (e.correct_answer !== before || e.options.filter(x => x === before).length !== 1 || e.options.includes(after)) throw new Error(`Unexpected fr-E${n} key`);
    edit(n, {correct_answer:after, options:e.options.map(x => x === before ? after : x)}, reason);
  };

  // Every listed prompt was read in both passes; guarded one-occurrence repair.
  for (const n of [17,61,855,867,879,885,891,897,903,909,915,945,969,1151,1165,1202,1216,1613,2084,2154,2173,2224]) {
    text(n, 'prompt', "''", "'", 'Remove an erroneous doubled apostrophe in the displayed French elision.');
  }
  text(2157, 'hint_text', 'someones', "someone's", 'Restore the possessive apostrophe in the English idiom cue.');

  choice(10, 'Goodbye', 'Thank you', 'Salut is both a greeting and a farewell, so Goodbye competes with Hello.', ['https://dictionary.cambridge.org/dictionary/french-english/salut']);
  choice(53, 'Sorry', 'Good night', 'The unsituated Excusez-moi permits both an apology and attention-getting; Larousse explicitly gives Sorry as an equivalent.', ['https://www.larousse.fr/dictionnaires/anglais-francais/sorry/613414']);
  for (const n of [433,442]) choice(n, 'Bedroom', 'Window', 'Chambre can be a room or bedroom in this housing context; the two original options were both correct.', ['https://dictionary.cambridge.org/us/dictionary/french-english/chambre']);
  for (const n of [1071,1076]) choice(n, 'Festival', 'Calendar', 'Fête can be a party or festival in this cultural unit; no private-party situation selects only Party.', ['https://dictionary.cambridge.org/dictionary/french-english/fete']);
  choice(1540, 'To upload', 'To delete', 'Télécharger has both transfer-direction translations in general French; the isolated audio supplies no direction. Preserve the download key and remove the competing upload option.', ['https://dictionary.cambridge.org/dictionary/french-english/telecharger']);
  for (const n of [1571,1622]) choice(n, 'Next', 'Before', 'Puis has the same then/next sequencing sense here, so both original options were valid.', ['https://www.larousse.fr/dictionnaires/francais-anglais/puis/64282']);
  choice(1795, 'Awesome', 'Boring', 'Génial expresses an enthusiastic positive evaluation, making both Cool and Awesome correct in this informal register.', ['https://www.larousse.fr/dictionnaires/francais-anglais/g%C3%A9nial/36521']);
  choice(1949, 'Nevertheless', 'Therefore', 'Cependant permits the offered Nevertheless as well as However; the additive/cause distinction is not relevant to either correct adversative.', ['https://www.larousse.fr/dictionnaires/anglais-francais/nevertheless/597424']);
  choice(1963, 'However', 'Therefore', 'Néanmoins and However can express the same concessive relation in this isolated connective question.', ['https://dictionary.cambridge.org/dictionary/french-english/neanmoins','https://dictionary.cambridge.org/dictionary/english/nevertheless']);

  edit(1642, {prompt:'Translate to French: Would do / would make (use the il/elle/on form of the present conditional; give only the verb).', target_grammar:'conditionnel_present'}, 'Ferait is a conjugated form of faire, not the free-standing auxiliary would. Select the person visibly and use existing strict grammar grading for this exact form task.');
  for (const n of [1655,1666,1706]) keyedChoice(n, 'Would', 'Would do / would make', 'Restore the lexical meaning of faire instead of teaching ferait as the isolated English auxiliary would.');
  edit(1665, {hint_text:'Would do / would make (il/elle/on form)'}, 'Align the translation cue with the actual conditional form; preserve the correct listening transcript.');
  text(1719, 'prompt', '(Would)', '(would do / would make; il/elle/on form)', 'Correct only the lexical cue. The open-production mechanism remains a separately tracked runtime matter.');
  update('cards', 'aabbccdd-2222-3007-c002-b10000000000', {native_text:'Would do / would make (il/elle/on form)'}, 'Dependent Ferait card: restore faire meaning and specify the third-person singular form.');
  for (const n of [1649,1688,1701,1714]) text(n, 'prompt', 'Instead', 'Instead of', 'Au lieu de is the prepositional expression instead of, not the stand-alone adverb instead.');
  edit(1681, {hint_text:'Instead of'}, 'Match the prepositional expression au lieu de; keep the correct transcript.');
  keyedChoice(1682, 'Instead', 'Instead of', 'Preserve the preposition in the English gloss for au lieu de.');
  update('cards', 'aabbccdd-2222-3007-c009-b10000000000', {native_text:'Instead of'}, 'Dependent Au lieu de card: restore the English preposition.');

  const reportSources = ['https://www.academie-francaise.fr/il-disait-quil-viendra'];
  const presentSources = ['https://vitrinelinguistique.oqlf.gouv.qc.ca/24200/la-grammaire/le-verbe/temps-grammaticaux/present/valeurs-particulieres-du-present-de-lindicatif'];
  const opinionSources = ['https://www.larousse.fr/dictionnaires/francais/penser/59268','https://www.larousse.fr/dictionnaires/francais/croire/20610'];
  edit(2233, {
    prompt:"Express doubt using the present subjunctive of savoir: Je ne pense pas qu'elle ___ la vérité.",
    hint_text:'Use the present subjunctive of savoir for elle.',
    explanation:"This exercise selects the subjunctive to present the statement as doubtful: sache. After a negative opinion verb, mood depends on the speaker's stance; indicative or conditional forms can occur in other contexts."
  }, 'Make the intended doubtful subjunctive reading explicit instead of claiming every negative opinion requires it.', opinionSources);
  edit(2236, {prompt:'Rewrite using « Il faut que », keeping vous and the agreement patients: Vous devez être patients.', accepted_answers:[]}, 'The original plural masculine/mixed-group agreement is given, not unspecified. Remove variants that change the addressee number or gender rather than performing the requested transformation.');
  edit(2248, {explanation:'The requested conditionnel présent is pourrais: pourr- + -ais. The conditional softens a request. Present peux and future pourras can also make requests in suitable contexts, but this exercise explicitly asks for the conditional.'}, 'Keep the correct form; remove the false claim that future pouvoir cannot make a request.', ['https://vitrinelinguistique.oqlf.gouv.qc.ca/24148/la-grammaire/le-verbe/temps-grammaticaux/conditionnel/valeur-modale-du-conditionnel']);
  edit(2257, {
    prompt:"Apply tense backshift (present to imparfait) from a past-time viewpoint: Elle a dit : « Je suis fatiguée. » → Elle a dit qu'elle ___ fatiguée.",
    explanation:'For the requested past-time backshift, suis becomes était. After a passé composé reporting verb, French can also retain the original tense when the report keeps its current relevance; backshift is not universally obligatory.'
  }, 'Show the selecting backshift instruction; est is not inherently incorrect in every French report.', reportSources);
  edit(2259, {
    prompt:'You are outside the group that spoke. Apply tense backshift (passé composé to plus-que-parfait): Ils ont annoncé : « Nous avons fini le projet. » Which report fits?',
    explanation:'The requested backshift changes avons fini to avaient fini. Because the reporter is outside the original group, nous becomes ils here. Keeping the original tense can be possible in a report with current relevance, but it is not the transformation requested.'
  }, 'Select the viewpoint and tense operation explicitly; reporting does not automatically exclude the reporter from nous.', reportSources);
  edit(2262, {
    prompt:'Paul said to you: « Je peux t’aider. » Report his words as yourself, beginning « Paul a dit », and backshift peux to the imparfait.',
    hint_text:'Paul is il; you are the person offered help, so t’aider becomes m’aider. Use pouvait.',
    explanation:'Paul becomes il, and his original addressee is now the reporter, so t’aider becomes m’aider. The requested present-to-imparfait backshift gives pouvait. These pronoun and tense choices follow the stated reporting situation, not an automatic shift of every deictic word.'
  }, 'The old prompt never identified the addressee, so it could not uniquely require me; supply the missing viewpoint while preserving the valid key.', reportSources);
  edit(2263, {
    metadata:{...get(2263).exercise.metadata, correction_instruction:'Rewrite from a past-time viewpoint, using the imparfait for her illness. Keep the reporting clause and the rest of the wording unchanged.'},
    hint_text:'Use était for the illness viewed at the time of her statement.',
    explanation:"The requested past-time viewpoint gives Elle a dit qu'elle était malade. The original present est can be grammatical if the report presents the illness as still current; this is a contextual tense rewrite, not a universal error."
  }, 'Requires the opt-in neutral correction_instruction renderer: an otherwise valid present-tense report must not be labelled categorically erroneous.', reportSources);
  edit(2274, {
    prompt:'Use a future passive form (futur simple or futur proche): Le nouveau pont ___ inauguré par la maire la semaine prochaine.',
    explanation:'The futur simple passive is sera inauguré; the futur proche is va être inauguré. The prompt specifically requests one of these future forms. A present tense can refer to a scheduled future event in French, so la semaine prochaine alone does not ban every present form.'
  }, 'Move the future-form selector into the visible question and remove the false universal exclusion of futurate present.', presentSources);
  edit(2300, {
    prompt:"You are outside the group that spoke. Apply passé composé-to-plus-que-parfait backshift: Ils ont dit : « Nous avons gagné. » → Ils ont dit qu'ils ___ gagné.",
    explanation:'For this requested past-time backshift, avons gagné becomes avaient gagné. Nous becomes ils because the reporter is outside the original group. Other reporting contexts can retain the original tense.'
  }, 'Keep the key while visibly selecting the specific reporting operation and viewpoint.', reportSources);
  edit(2304, {
    metadata:{...get(2304).exercise.metadata, correction_instruction:'Express doubt by rewriting pouvoir in the present subjunctive after Je ne crois pas que. Keep the rest of the sentence unchanged.'},
    hint_text:'For the requested doubtful subjunctive reading, use puisse.',
    explanation:'The requested subjunctive expresses doubt: Je ne crois pas qu’il puisse résoudre ce problème seul. Negative croire can also take an indicative or conditional in other contexts; the indicative is not limited to affirmative croire.'
  }, 'The source can be grammatical under another stance; select the intended subjunctive using the learner-visible neutral instruction.', opinionSources);
  edit(2290, {explanation:'Où introduces the place where the speaker grew up. Dans lequel is also grammatical with masculine singular quartier. A bare que does not express the required location relation here.'}, 'Align the teaching explanation with the independently checked dans lequel alternative.');

  const reported = row('grammar_rules', '529a821c-d5f9-4a5a-b048-56aeaec72238');
  if (reported.common_errors[0]?.error !== "Elle a dit qu'elle est fatiguée.") throw new Error('Unexpected reported-speech reference');
  update('grammar_rules', reported.id, {
    explanation:'When reporting from a past-time viewpoint, common backshifts are présent → imparfait, passé composé → plus-que-parfait, and futur → conditionnel. With a passé composé reporting verb, the original tense can sometimes remain when still relevant. Report yes/no questions with si. Adjust pronouns, possessives and time words only as the reporting situation requires; for example, demain can become le lendemain.',
    common_errors:reported.common_errors.slice(1)
  }, 'Dependent reference repeats the false obligatory-backshift rule. Preserve its valid examples and genuine indirect-question error, but remove the unqualified valid-present error item.', reportSources);
  const future = row('grammar_rules', '9e9e14c0-59b0-4e3d-bd16-5b222947cba6');
  if (future.common_errors[0]?.error !== 'Quand tu arrives demain, on mangera.') throw new Error('Unexpected future reference');
  update('grammar_rules', future.id, {
    explanation:'The futur simple uses endings -ai, -as, -a, -ons, -ez, -ont with the future stem (parler-, ser-, aur-, ir-, fer-, viendr-). It expresses predictions and promises. French can use the future after quand for a future event: quand tu arriveras. The present can also refer to a scheduled or confidently envisaged future event, so it is not universally wrong in that context.',
    common_errors:future.common_errors.slice(1)
  }, 'Dependent future reference wrongly labels a possible futurate-present sentence erroneous. Preserve the correct future example and the separate irregular aller error.', presentSources);

  for (const [n, answers, reason] of frenchAlternativeAdditions) {
    const e = get(n).exercise;
    if (!['translate_to_target','translate_to_native','fill_blank','cloze_deletion','sentence_transformation'].includes(e.type)) throw new Error(`Unexpected alternative target fr-E${n}/${e.type}`);
    edit(n, {accepted_answers:[...e.accepted_answers, ...answers]}, `${reason} Each exact addition was rejected by the actual grader before this patch and accepted when explicitly included.`);
  }
}

// Static authored additions follow. Their inclusion is not inferred at build time.
export const frenchAlternativeAdditions = [
  [2,["Salut"],"Unrestricted Goodbye includes the common informal farewell Salut."],
  [6,["S'il te plaît"],"No formal/plural addressee is specified for Please."],
  [7,["Thanks"],"Merci directly permits Thanks as well as Thank you."],
  [8,["olée"],"The Dés___ completion permits a feminine speaker; no gender is supplied."],
  [30,["Pardon","Je suis désolé","Je suis désolée"],"Sorry has no speaker-gender or full-clause restriction; these are common apologies."],
  [31,["Sorry"],"Larousse explicitly translates the standalone apology Sorry with excusez-moi; no attention-getting situation is supplied in this prompt."],
  [42,["Pardon"],"Excuse me has no addressee/register restriction."],
  [50,["S'il te plaît"],"No formal/plural addressee is specified for Please."],
  [51,["Thanks"],"Merci directly permits Thanks as well as Thank you."],
  [52,["olée"],"The Dés___ completion permits a feminine speaker; no gender is supplied."],
  [67,["Goodbye","Bye","Hi"],"Salut is a common greeting and farewell, with no selecting situation in the question."],
  [102,["cieuse"],"Délicieux/délicieuse are the two ordinary gender forms of Delicious."],
  [136,["Carte","La carte"],"Restaurant Menu permits the à-la-carte list carte; no set-menu meaning is specified."],
  [146,["Ticket"],"The isolated transport Ticket has no rail/air-document qualifier in the actual prompt; ticket is an ordinary French transport word."],
  [147,["Train station","Railway station"],"Both are ordinary explicit translations of gare in transportation context."],
  [158,["Station"],"Station includes a metro station within the actual transportation/review context; no train-specific constraint is shown."],
  [166,["Autobus"],"Autobus and bus denote the same means of transport."],
  [183,["Chemist's","Drugstore"],"These are common British/American equivalents of pharmacie as a shop."],
  [191,["Train station","Railway station"],"Both are ordinary explicit translations of gare in transportation context."],
  [202,["Station"],"Station includes a metro station within the actual transportation/review context; no train-specific constraint is shown."],
  [212,["Coûteux","Coûteuse"],"Expensive does not specify the noun's gender or require cher rather than the ordinary synonym coûteux."],
  [213,["Inexpensive"],"Bon marché means inexpensive as well as cheap."],
  [224,["Pas cher","Peu cher"],"Cheap is unqualified; ordinary low-price expressions preserve the meaning."],
  [226,["eue"],"Bl___ Blue has no masculine noun; bleue is a valid feminine completion."],
  [241,["Hour"],"Heure denotes hour in the same time/schedule domain, without a sentence selecting time."],
  [252,["Temps"],"Time can denote duration in this time/schedule unit; the prompt does not specify clock time."],
  [278,["ère"],"Ch___ Expensive permits chère when the noun is feminine; none is supplied."],
  [282,["Docteur","Docteure"],"Both are established doctor profession forms; no person-gender restriction is supplied."],
  [283,["Desk"],"Bureau denotes a desk or office in the same work domain, with no sentence selecting the room."],
  [286,["Foot"],"Foot is the ordinary French shortened name for soccer; no formal register is required."],
  [287,["Warm"],"Chaud has no degree-setting context distinguishing warm from hot."],
  [288,["oide"],"Fr___ Cold has no masculine-gender selector."],
  [318,["Faire la cuisine"],"Faire la cuisine is an ordinary equivalent of To cook in the hobbies domain."],
  [319,["Football"],"The French sport football is football in British English; no US-only instruction is given."],
  [320,["aude"],"Ch___ Hot has no masculine-gender selector."],
  [324,["mie"],"A___ Friend permits amie; the friend's gender is unspecified."],
  [330,["Foot"],"Foot is the ordinary French shortened name for soccer; no formal register is required."],
  [331,["Warm"],"Chaud has no degree-setting context distinguishing warm from hot."],
  [332,["oide"],"Fr___ Cold has no masculine-gender selector."],
  [346,["Amie","Copain","Copine"],"The friend translation is not restricted by gender or formal register; copain/copine has an ordinary non-romantic friend sense."],
  [347,["Professor"],"Professeur includes university professor within the same work/profession domain; no school-only context is supplied."],
  [357,["Grandma"],"Grandma preserves the same grandmother relation; no formal-register requirement is given."],
  [369,["Grandpa"],"Grandpa preserves the same grandfather relation; no formal-register requirement is given."],
  [377,["Girl"],"Fille is isolated in Ages and Birthdays, not a possessive family relation selecting daughter."],
  [382,["ienne"],"Ch___ Dog permits chienne with no sex constraint."],
  [394,["atte"],"Ch___ Cat permits chatte with no sex constraint."],
  [401,["Grandma"],"Grandma preserves the same grandmother relation; no formal-register requirement is given."],
  [404,["Chienne"],"Dog has no male-only qualifier."],
  [413,["Grandpa"],"Grandpa preserves the same grandfather relation; no formal-register requirement is given."],
  [416,["Chatte"],"Cat has no male-only qualifier."],
  [417,["Mom","Mum"],"Both English regional forms preserve the mother relation without a formal-register restriction."],
  [422,["Pièce"],"The room in Parts of the House need not specifically be a bedroom; pièce is the general room term."],
  [458,["Chambre"],"Chambre by itself is a bedroom in the same housing domain; à coucher is not obligatory."],
  [487,["Home"],"Maison denotes home in the describing-home domain, not only the physical house."],
  [496,["Sain","Saine","Bien portant","Bien portante"],"Healthy in health/review context is not restricted to a single paraphrase or person's gender."],
  [497,["Medication","Drug"],"Both name a medicinal substance in the actual health context."],
  [517,["Ill"],"Ill and sick are ordinary equivalents of malade."],
  [520,["Mal"],"Mal is an ordinary French pain expression, with no type of pain specified."],
  [529,["In good health"],"This directly preserves en bonne santé without needing a one-word adjective."],
  [540,["Sain","Saine","Bien portant","Bien portante"],"Healthy in health/review context is not restricted to a single paraphrase or person's gender."],
  [541,["Medication","Drug"],"Both name a medicinal substance in the actual health context."],
  [568,["Copain"],"Copain has the common boyfriend sense in the actual family/relationships context; no formal-register restriction is shown."],
  [577,["Époux"],"Époux denotes the same husband relation as mari, without changing the task."],
  [580,["Copine"],"Copine has the common girlfriend sense in the actual relationships context; no formal-register restriction is shown."],
  [589,["Épouse"],"Épouse denotes the same wife relation as femme, without changing the task."],
  [601,["Copain"],"Copain has the common boyfriend sense in the actual family/relationships context; no formal-register restriction is shown."],
  [610,["Époux"],"Époux denotes the same husband relation as mari, without changing the task."],
  [613,["Copine"],"Copine has the common girlfriend sense in the actual relationships context; no formal-register restriction is shown."],
  [622,["Épouse"],"Épouse denotes the same wife relation as femme, without changing the task."],
  [625,["Voisine"],"Neighbor has no gender selector."],
  [649,["Infirmier"],"Nurse is not female-specific; the masculine profession form preserves the meaning."],
  [676,["Alimentation"],"The unqualified diet in Health & Wellness can be habitual food intake, alimentation, not only a restricted régime."],
  [685,["Fatiguée"],"Tired has no gender selector."],
  [688,["Exercice physique","Activité physique"],"The Healthy Lifestyle context explicitly supports physical exercise expressions."],
  [706,["Tablette"],"Tablette is an ordinary shelf in the actual rooms/furniture context."],
  [712,["Faire la cuisine"],"To cook permits this common equivalent in both housing lessons."],
  [719,["Rug"],"Tapis denotes a rug as well as a carpet in Household Chores."],
  [730,["Moquette"],"The unqualified carpet in Moving & Housing can be fitted carpeting, moquette."],
  [745,["Faire la cuisine"],"To cook permits this common equivalent in both housing lessons."],
  [772,["Sofa"],"Sofa is also the French word for the same furniture."],
  [781,["Excité","Excitée"],"Excited is not restricted to a single emotion nuance or gender; excité is also explicitly taught in the same emotions unit."],
  [784,["Gentille"],"Kind has no gender selector in the personality domain."],
  [790,["Fâché","Fâchée"],"Angry can be fâché(e) in Negative Emotions; no degree or gender is fixed."],
  [791,["Anxious","Concerned"],"These preserve the worried emotional sense of inquiet."],
  [792,["itée"],"Exc___ Excited permits excitée for a feminine person."],
  [803,["Enthusiastic"],"Enthusiastic is the direct equivalent of enthousiaste in Personality Traits."],
  [805,["Courageuse"],"Brave has no masculine-only instruction."],
  [814,["Excité","Excitée"],"Excited is not restricted to a single emotion nuance or gender; excité is also explicitly taught in the same emotions unit."],
  [815,["Timid"],"Timid is an ordinary personality equivalent of timide."],
  [816,["ageuse"],"Cour___ Brave permits courageuse."],
  [817,["Gentille"],"Kind has no gender selector in the personality domain."],
  [827,["Courageous"],"Courageous is the direct English equivalent of courageux."],
  [828,["tille"],"Gen___ Kind permits gentille."],
  [829,["Généreuse"],"Generous has no masculine-only instruction."],
  [839,["Nice"],"Gentil has the ordinary nice/kind personality sense, without finer selecting context."],
  [840,["reuse"],"Géné___ Generous permits généreuse."],
  [841,["Paresseuse"],"Lazy has no masculine-only instruction."],
  [844,["Content","Contente"],"Happy has no gender restriction; content/content(e) expresses ordinary happiness in this emotions review."],
  [899,["I have traveled","I have travelled","I've traveled","I've travelled"],"Recent News supplies no closed past-time expression in the prompt; French passé composé supports the English present perfect."],
  [911,["I have studied","I've studied"],"The isolated passé composé in the review has no specified finished time; the present-perfect reading is valid."],
  [940,["But"],"But and objectif both denote a goal in the future-plans domain."],
  [964,["Prévoir"],"Prévoir is a common plan verb in Making Appointments, without a systematic planning distinction."],
  [973,["But"],"But and objectif both denote a goal in the future-plans domain."],
  [983,["Holiday","Holidays"],"These are standard British English equivalents of vacances."],
  [997,["Moins chère"],"Cheaper has no gender selector."],
  [1000,["Plus court","Plus courte"],"Shorter lacks a referent selecting height rather than length and lacks a gender selector; these comparisons preserve the prompt."],
  [1006,["Mieux"],"Better has no adjective/adverb or gender constraint in its isolated prompt."],
  [1009,["Plus chère"],"More expensive has no gender selector."],
  [1012,["Plus vite"],"Faster can be the ordinary adverbial comparison; no noun selects an adjective."],
  [1018,["Plus mauvais","Plus mauvaise"],"Worse permits the ordinary comparative of mauvais without a specific construction excluding it."],
  [1019,["Less expensive"],"This directly preserves moins cher."],
  [1021,["Plus grande"],"Taller has no gender selector."],
  [1024,["Plus lentement"],"Slower has no gender or adjective/adverb selector."],
  [1033,["Plus court","Plus courte","Plus petite"],"Shorter lacks a referent selecting height rather than length and lacks a gender selector; these comparisons preserve the prompt."],
  [1044,["court","courte"],"The supplied Plus prefix supports length or height and either gender; no noun constrains the completion."],
  [1045,["Plus vite"],"Faster can be the ordinary adverbial comparison; no noun selects an adjective."],
  [1056,["vite"],"Plus ___ Faster permits the ordinary adverb plus vite."],
  [1057,["Plus lente","Plus lentement"],"Slower has no gender or adjective/adverb selector."],
  [1072,["Fêter"],"Fêter is the common celebrate verb for national holidays and festivals."],
  [1079,["Anniversary"],"Anniversaire includes anniversary in this cultural celebration context, with no birth-specific phrase."],
  [1093,["Soirée"],"Soirée can denote a social party in the music/dance/cultural context; no daytime event is specified."],
  [1103,["Present"],"Present is the ordinary gift equivalent of cadeau."],
  [1105,["Fêter"],"Fêter is the common celebrate verb for national holidays and festivals."],
  [1108,["Fête"],"Fête denotes a festival in the explicit Festivals lesson."],
  [1115,["Celebration","Festival"],"Fête denotes these festive events in the cultural unit; the prompt does not select a private party."],
  [1120,["Costume"],"Costume is a French word for theatrical/festive clothing as well as a suit, fitting the cultural context."],
  [1126,["Soirée"],"Soirée can denote a social party in the music/dance/cultural context; no daytime event is specified."],
  [1139,["I do not agree","I don't agree"],"Both are direct full-clause translations preserving the negative agreement meaning."],
  [1141,["Actualités","Informations"],"Current Events and Social Issues select the news domain; both are ordinary equivalents, not unrelated dictionary senses."],
  [1166,["Je crois que"],"I think that can express an opinion with croire in Current Events; no cognitive-activity contrast is supplied."],
  [1180,["Actualités","Informations"],"Current Events and Social Issues select the news domain; both are ordinary equivalents, not unrelated dictionary senses."],
  [1195,["Policy"],"The isolated politique is compatible with policy and political in the same current-events/giving-reasons domain; no article or sentence fixes noun type."],
  [1209,["Economics"],"Economics is a same-domain discipline reading of économie without a sentence selecting the national economy."],
  [1222,["Curriculum vitae"],"This expands the keyed CV without changing the résumé document."],
  [1239,["Recruter","Engager"],"Both are ordinary hiring verbs in the explicit work domain."],
  [1250,["Exposé"],"Exposé is a presentation in Meetings, not an unrelated exhibition sense."],
  [1251,["Wage","Wages","Pay"],"These are ordinary remuneration equivalents of salaire in the work domain."],
  [1253,["Renvoyer"],"Renvoyer denotes firing someone in the work context; no legal employment category is selected."],
  [1265,["To employ"],"To employ is an ordinary equivalent of embaucher in Career Goals."],
  [1278,["Recruter","Engager"],"Both are ordinary hiring verbs in the explicit work domain."],
  [1279,["To dismiss","To lay off"],"Licencier covers dismissal and redundancy without a cause being specified in Work Problems."],
  [1281,["Directrice","Responsable","Gérant","Gérante","Manager"],"The unrestricted job title has no gender or hierarchical-level selector; these common manager titles fit Work Problems."],
  [1292,["Renvoyer"],"Renvoyer denotes firing someone in the work context; no legal employment category is selected."],
  [1293,["Coworker","Co-worker"],"These preserve the work-colleague relation."],
  [1294,["ctrice"],"Dire___ permits directrice; no male person is specified."],
  [1295,["Échéance"],"Échéance is an ordinary work deadline."],
  [1321,["Booking"],"Booking and reservation denote the same travel arrangement."],
  [1377,["Lateness"],"Retard can denote lateness in travel without a specified delayed service."],
  [1407,["Menacé","Menacée"],"Menacé(e) expresses endangered status in Wildlife/Sustainable Living; no gender is fixed."],
  [1421,["Préservation"],"Préservation expresses environmental conservation in these environmental lessons."],
  [1433,["In danger"],"This directly translates en danger in the environmental context."],
  [1446,["Menacé","Menacée"],"Menacé(e) expresses endangered status in Wildlife/Sustainable Living; no gender is fixed."],
  [1447,["Preservation"],"Preservation is the same environmental-conservation concept in Sustainable Living."],
  [1460,["Préservation"],"Préservation expresses environmental conservation in these environmental lessons."],
  [1474,["Site internet"],"Site internet and site web denote the same website in this internet unit."],
  [1475,["Application"],"The full English software term is not invalid just because the key uses app."],
  [1488,["Appli"],"Appli is the ordinary French abbreviation for application in Smartphones & Apps."],
  [1491,["Télécharger"],"Cambridge records télécharger for uploading as well as downloading; the generic course specifies no Quebec-only terminology rule."],
  [1503,["To upload"],"The isolated télécharger in Digital Communication has no direction cue, and Cambridge records both transfer-direction senses."],
  [1530,["Télécharger"],"Cambridge records télécharger for uploading as well as downloading; the generic course specifies no Quebec-only terminology rule."],
  [1533,["Médias sociaux"],"Médias sociaux is the ordinary literal social-media term."],
  [1558,["Ensuite"],"The storytelling sequence meaning of then is shared by ensuite and puis."],
  [1561,["Premièrement"],"First has the event-sequencing function here; premièrement preserves it."],
  [1572,["Tout à coup"],"Tout à coup is the ordinary sudden-event expression in sequencing."],
  [1575,["Puis"],"Puis means next in event sequencing; no different next-sense is selected."],
  [1586,["Alors que"],"Alors que permits the same simultaneous while relation in Past Continuous."],
  [1587,["First of all"],"This preserves the ordering expression d'abord."],
  [1589,["Finalement"],"Finally in event sequencing permits finalement; no contrasting at-last nuance is supplied."],
  [1600,["Premièrement"],"First has the event-sequencing function here; premièrement preserves it."],
  [1601,["Then","Afterwards"],"Ensuite has these ordinary sequencing translations in Interruptions."],
  [1603,["Entre-temps"],"Entre-temps has a meanwhile sense between narrated events; no simultaneous-only scenario is supplied."],
  [1614,["Puis"],"Puis means next in event sequencing; no different next-sense is selected."],
  [1615,["At last"],"Enfin has the ordinary at-last sense in a storytelling sentence without narrowing context."],
  [1628,["Finalement"],"Finally in event sequencing permits finalement; no contrasting at-last nuance is supplied."],
  [1629,["In the meantime"],"This directly preserves pendant ce temps."],
  [1644,["riez","rions","raient"],"Dev___ Should leaves the grammatical person unspecified; these are present-conditional forms of devoir."],
  [1645,["Je souhaite"],"I wish does not explicitly request the conditional; the ordinary present souhaiter form preserves the stated meaning."],
  [1656,["Pourriez","Pourrions"],"Could is in a hypothetical unit but has no person selector; these are the corresponding conditional forms."],
  [1657,["Ought to"],"Ought to preserves the advice/obligation meaning of devrait in this hypothetical unit."],
  [1658,["aite"],"Je souh___ I wish permits the ordinary present je souhaite; the prompt does not request a tense."],
  [1670,["Devriez","Devrions"],"Should has no person selector; all are present-conditional devoir forms."],
  [1671,["I would like","I would wish"],"The conditional souhaiterais explicitly supports these full English conditional expressions."],
  [1673,["Imaginez","Imaginons"],"The imperative Imagine has no informal-singular-only addressee instruction."],
  [1684,["Je souhaite"],"I wish does not explicitly request the conditional; the ordinary present souhaiter form preserves the stated meaning."],
  [1685,["Maybe"],"Maybe and perhaps are direct equivalents of peut-être."],
  [1686,["ginons"],"Ima___ Imagine allows the other imperative persons when no addressee is specified."],
  [1687,["Suppose","Supposez"],"Suppose has no first-person-plural imperative constraint."],
  [1700,["ose","osez"],"Supp___ Suppose has no first-person-plural imperative constraint."],
  [1712,["Imaginons"],"The imperative Imagine has no informal-singular-only addressee instruction."],
  [1713,["Let's suppose","Let us suppose"],"Both preserve the first-person plural imperative of supposons."],
  [1715,["Sinon"],"Sinon is the ordinary conditional otherwise meaning in Hypothetical Situations."],
  [1741,["Kind regards","Best regards","Cordially"],"The correspondence closing cordialement permits these ordinary English renderings."],
  [1743,["Cool","Super"],"The informal positive evaluation has common French cool/super equivalents in this register unit."],
  [1755,["In a way","So to speak"],"Both preserve the qualifying sense of en quelque sorte in the writing/register domain."],
  [1756,["iale"],"Gén___ Cool permits the feminine adjective géniale with no noun selecting gender."],
  [1757,["Génial"],"Génial shares the same informal awesome evaluation as super."],
  [1769,["Awesome","Great","Brilliant"],"These preserve the positive evaluation of génial; no temperature sense is involved."],
  [1782,["Cool","Super"],"The informal positive evaluation has common French cool/super equivalents in this register unit."],
  [1783,["Great"],"Great is an ordinary positive equivalent of super."],
  [1785,["Pas de soucis","Aucun souci"],"These are ordinary no-worries expressions in the register-adaptation context."],
  [1796,["Génial"],"Génial shares the same informal awesome evaluation as super."],
  [1797,["It doesn't matter","It does not matter"],"These preserve the clause meaning of peu importe, not just the compressed whatever key."],
  [1811,["Goal","Aim"],"But denotes a purpose/goal/aim within the actual philosophy-of-life domain."],
  [1824,["Objectif","Finalité"],"Purpose has the goal/end meaning in Beliefs & Values, without a finer philosophical restriction."],
  [1825,["Awareness","Conscience"],"Both are core abstract senses of conscience, especially in Beliefs & Values; no sentence narrows consciousness."],
  [1840,["le"],"Mora___ Morality can be morale, the system of moral principles."],
  [1858,["Conviction"],"Conviction is an ordinary strongly held belief in Critical Thinking; no religious-only sense is specified."],
  [1894,["Convaincre"],"Convaincre is an ordinary persuade equivalent in Building Arguments without a specified opposition of emotional persuasion and intellectual convincing."],
  [1895,["Proof"],"Proof is a direct same-domain equivalent of preuve in arguments."],
  [1914,["Assertion"],"Assertion denotes a claim in argumentation."],
  [1923,["Nevertheless"],"The adversative connective cependant permits nevertheless in the same debate function."],
  [1936,["Toutefois","Néanmoins"],"The isolated adversative however permits these ordinary equivalent connectives."],
  [1937,["Nonetheless","However"],"These preserve the concessive/adversative meaning of néanmoins without a sentence narrowing it."],
  [1950,["Cependant","Pourtant"],"The concessive nevertheless permits these equivalent connectives in formal debate."],
  [1951,["Moreover","In addition"],"These are ordinary additive equivalents of de plus in formal debate."],
  [1956,["Biais","Partialité"],"Both denote bias within argumentation rather than an unrelated sense."],
  [1964,["En outre"],"En outre is the ordinary additive furthermore equivalent."],
  [1980,["en place"],"Mettre en place is an ordinary implementation expression; the object/process is unspecified."],
  [1998,["Procès-verbal"],"Professional minutes can be a procès-verbal; no informal-summary-only constraint is given."],
  [2006,["Mettre en place"],"Mettre en place is a common implement expression in Negotiations."],
  [2026,["Efficience"],"Efficience is a direct efficiency term in professional reports; do not replace the valid efficacy key wholesale."],
  [2040,["Date limite"],"Date limite is an ordinary equivalent for deadline."],
  [2068,["Personnage principal"],"This directly denotes a literary protagonist."],
  [2076,["Tableau"],"Painting can denote the artwork tableau in the arts domain; it is not limited to the activity."],
  [2082,["Coup de théâtre"],"This names an unexpected dramatic plot turn, fitting the book-review context."],
  [2096,["Compte rendu"],"A film/theatre review can be a compte rendu; no critical-negative-only meaning is specified."],
  [2133,["Main character"],"This directly defines protagonist in literature."],
  [2146,["Taper dans le mille"],"This is an idiomatic equivalent for being exactly right, the nail-on-the-head sense."],
  [2147,["It's a piece of cake","It is a piece of cake"],"These retain the explicit c'est clause of the French idiom."],
  [2160,["Du gâteau"],"The French nominal idiom can match the nominal English a piece of cake without adding c'est."],
  [2174,["Coûter un bras"],"This is the ordinary idiomatic very-expensive equivalent of cost an arm and a leg."],
  [2189,["To be over the moon"],"This expresses the same extreme happiness as être aux anges."],
  [2194,["La balle est dans votre camp"],"Your has no singular informal addressee restriction; votre camp preserves the idiom."],
  [2202,["Être au septième ciel"],"This idiom expresses the same extreme happiness as cloud nine."],
  [2217,["Very rarely"],"This preserves the extreme-infrequency meaning of tous les trente-six du mois."],
  [2290,["dans lequel"],"Le quartier dans lequel j'ai grandi is a grammatical same-meaning relative construction; the main prompt does not require the single pronoun où."],
  [2292,["Ce film dont je te parlais passe au cinéma."],"Preserves the given Ce film, the required dont and both original predicates; le is not required by the prompt."],
  [2294,["Voilà exactement ce dont j'ai besoin.","Voilà exactement ce qu'il me faut."],"Voilà preserves the demonstrative that's meaning; both need constructions already fit the original translation and its existing alternative."],
];
