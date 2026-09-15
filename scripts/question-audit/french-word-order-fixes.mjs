import { lessonRefs } from './lesson-refs.mjs';

// Individually authored replacements of confirmed sole-answer/no-distractor banks.
// Draft wording requires independent review. No production or build integration.
export const frenchWordOrder = [
  // A2: complete everyday sentences matched to the exact local lesson.
  [566, 'Mari', 'My aunt’s husband is my uncle.', 'Le mari de ma tante est mon oncle.'],
  [578, 'Femme', 'Paul’s wife is a friend of my sister.', 'La femme de Paul est une amie de ma sœur.'],
  [614, 'Voisin', 'On Sundays, my neighbor has lunch at his grandparents’ house.', 'Le dimanche, mon voisin déjeune chez ses grands-parents.'],
  [626, 'Mariage', 'My cousin’s wedding will take place in June.', 'Le mariage de ma cousine aura lieu en juin.'],
  [638, 'Infirmière', 'The nurse asks me if I have a fever.', 'L’infirmière me demande si j’ai de la fièvre.'],
  [650, 'Dentiste', 'I have an appointment with the dentist tomorrow morning.', 'J’ai un rendez-vous chez le dentiste demain matin.'],
  [662, 'Stress', 'The pharmacist gives advice on reducing stress.', 'Le pharmacien donne des conseils pour réduire le stress.'],
  [674, 'Fatigué', 'I feel tired after a difficult day.', 'Je me sens fatigué après une journée difficile.'],
  [698, 'Régime', 'My doctor recommends a balanced diet.', 'Mon médecin recommande un régime alimentaire équilibré.'],
  [710, 'Laver', 'The washing machine is next to the fridge.', 'La machine à laver est à côté du réfrigérateur.'],
  [722, 'Balayer', 'I have to sweep the kitchen floor.', 'Je dois balayer le sol de la cuisine.'],
  [734, 'Cuisiner', 'In our new apartment, we have space for cooking.', 'Dans notre nouvel appartement, nous avons de la place pour cuisiner.'],
  [746, 'Loyer', 'Our neighbor pays the same rent as us.', 'Notre voisin paie le même loyer que nous.'],
  [758, 'Déménager', 'My sister wants to move because her apartment is too noisy.', 'Ma sœur veut déménager parce que son appartement est trop bruyant.'],
  [770, 'Appartement', 'This apartment has two bedrooms and a small balcony.', 'Cet appartement a deux chambres et un petit balcon.'],
  [782, 'Timide', 'My brother is shy, but he is happy with his friends.', 'Mon frère est timide, mais il est heureux avec ses amis.'],
  [794, 'Courageux', 'My father is brave, but he is afraid of snakes.', 'Mon père est courageux, mais il a peur des serpents.'],
  [806, 'Gentil', 'My cousin is kind to all the children.', 'Mon cousin est gentil avec tous les enfants.'],
  [818, 'Généreux', 'Paul is generous and shares his lunch with his friends.', 'Paul est généreux et partage son déjeuner avec ses amis.'],
  [830, 'Paresseux', 'He gets angry when people call him lazy.', 'Il se fâche quand on le traite de paresseux.'],
  [842, 'Patient', 'My brother remains patient when I make a mistake.', 'Mon frère reste patient quand je fais une erreur.'],
  [950, 'Vacances', 'My goal is to learn to swim before the vacation.', 'Mon objectif est d’apprendre à nager avant les vacances.'],
  [962, 'Objectif', 'My goal is to make an appointment for next Monday.', 'Mon objectif est de prendre rendez-vous pour lundi prochain.'],
  [974, 'Rêve', 'I think that my dream will come true one day.', 'Je pense que mon rêve se réalisera un jour.'],
  [986, 'Planifier', 'We are going to plan our next trip together.', 'Nous allons planifier notre prochain voyage ensemble.'],
  [1070, 'Cadeau', 'In my family, we give a gift to each child at Christmas.', 'Dans ma famille, nous offrons un cadeau à chaque enfant à Noël.'],
  [1082, 'Fête', 'For this family party, we prepare a traditional cake.', 'Pour cette fête de famille, nous préparons un gâteau traditionnel.'],
  [1094, 'Célébrer', 'We want to celebrate this day with music and dancing.', 'Nous voulons célébrer cette journée avec de la musique et des danses.'],
  [1106, 'Musique', 'There is music in the square during the festival.', 'Il y a de la musique sur la place pendant le festival.'],
  [1118, 'Danse', 'I am going to give my sister dance lessons as a gift.', 'Je vais offrir des cours de danse à ma sœur.'],
  [1130, 'Festival', 'Every year, our family goes to the village festival.', 'Chaque année, notre famille va au festival du village.'],
  // B1: linked ideas, reasons, narrative timing and explicitly selected register.
  [1142, 'Société', 'I think that education can make our society fairer.', 'Je pense que l’éducation peut rendre notre société plus juste.'],
  [1156, 'Politique', 'I respect your opinion, but I disagree with this policy.', 'Je respecte ton opinion, mais je ne suis pas d’accord avec cette politique.'],
  [1170, 'Économie', 'This article explains how tourism affects the local economy.', 'Cet article explique comment le tourisme influence l’économie locale.'],
  [1184, 'Argumenter', 'To argue in favor of this reform, we must explain its effects on families.', 'Pour argumenter en faveur de cette réforme, nous devons expliquer ses effets sur les familles.'],
  [1198, 'Débat', 'I want to take part in the debate because this decision affects my neighborhood.', 'Je veux participer au débat parce que cette décision concerne mon quartier.'],
  [1212, 'Raison', 'The main reason is that many families cannot afford this rent.', 'La raison principale est que beaucoup de familles ne peuvent pas payer ce loyer.'],
  [1226, 'Embaucher', 'During the interview, I asked when the company planned to hire a new employee.', 'Pendant l’entretien, j’ai demandé quand l’entreprise comptait embaucher un nouvel employé.'],
  [1240, 'Licencier', 'The manager informed us that the company would have to lay off two employees.', 'La directrice nous a informés que l’entreprise devrait licencier deux employés.'],
  [1254, 'Collègue', 'During the meeting, my colleague explained why the project had been delayed.', 'Pendant la réunion, mon collègue a expliqué pourquoi le projet avait pris du retard.'],
  [1268, 'Directeur', 'I would like to become a director in order to lead my own team.', 'Je voudrais devenir directeur pour diriger ma propre équipe.'],
  [1296, 'Projet', 'We postponed the project because some information was missing.', 'Nous avons reporté le projet parce que certaines informations manquaient.'],
  [1310, 'Bagages', 'Before booking the flight, I check whether the price includes luggage.', 'Avant de réserver le vol, je vérifie si le prix comprend les bagages.'],
  [1338, 'Retard', 'When I arrived at the hotel, I explained that my train had been delayed.', 'En arrivant à l’hôtel, j’ai expliqué que mon train avait eu du retard.'],
  [1352, 'Annuler', 'We had to cancel the excursion because the road was closed.', 'Nous avons dû annuler l’excursion parce que la route était fermée.'],
  [1366, 'Aventure', 'The adventure became complicated when we missed the last bus.', 'L’aventure s’est compliquée quand nous avons raté le dernier bus.'],
  [1380, 'Touriste', 'The tourist asked me how to get to the museum without taking a taxi.', 'Le touriste m’a demandé comment aller au musée sans prendre de taxi.'],
  [1408, 'Conservation', 'Forest conservation is important because many animals live there.', 'La conservation des forêts est importante parce que beaucoup d’animaux y vivent.'],
  [1422, 'Énergie', 'We can save energy by turning off the lights when we leave.', 'Nous pouvons économiser de l’énergie en éteignant les lumières quand nous partons.'],
  [1436, 'Solaire', 'Solar energy produces electricity without burning coal.', 'L’énergie solaire produit de l’électricité sans brûler de charbon.'],
  [1450, 'Carbone', 'To reduce my carbon footprint, I take the train instead of the plane.', 'Pour réduire mon empreinte carbone, je prends le train au lieu de l’avion.'],
  [1478, 'Téléverser', 'Before uploading a photo, I ask permission from the people who appear in it.', 'Avant de téléverser une photo, je demande l’autorisation aux personnes qui y apparaissent.'],
  [1492, 'Écran', 'I reduced the screen brightness because the battery was almost empty.', 'J’ai réduit la luminosité de l’écran parce que la batterie était presque vide.'],
  [1506, 'Clavier', 'I prefer writing long messages with a keyboard because it is more comfortable.', 'Je préfère écrire de longs messages avec un clavier parce que c’est plus confortable.'],
  [1548, 'Robot', 'This robot can answer questions, but it does not always understand the context.', 'Ce robot peut répondre aux questions, mais il ne comprend pas toujours le contexte.'],
  [1562, 'Ensuite', 'We found the map, and then we began to look for the house.', 'Nous avons trouvé la carte, et ensuite nous avons commencé à chercher la maison.', ['Nous avons trouvé la carte, et nous avons ensuite commencé à chercher la maison.', 'Nous avons trouvé la carte, et nous avons commencé ensuite à chercher la maison.', 'Nous avons trouvé la carte, et nous avons commencé à chercher ensuite la maison.']],
  [1576, 'Enfin', 'After several hours of walking, we finally reached the village.', 'Après plusieurs heures de marche, nous avons enfin atteint le village.', ['Après plusieurs heures de marche, enfin nous avons atteint le village.', 'Après plusieurs heures de marche, nous avons atteint enfin le village.']],
  [1604, 'Personnage', 'The character was walking through the forest when he heard a strange noise.', 'Le personnage marchait dans la forêt quand il a entendu un bruit étrange.'],
  [1618, 'Intrigue', 'The plot takes place in a small village where everyone knows one another.', 'L’intrigue se déroule dans un petit village où tout le monde se connaît.'],
  [1632, 'Début', 'At the beginning of the story, nobody knew who had written the letter.', 'Au début de l’histoire, personne ne savait qui avait écrit la lettre.'],
  [1646, 'Peut-être', 'If it rains tomorrow, we will perhaps stay at home.', 'S’il pleut demain, nous resterons peut-être à la maison.'],
  [1660, 'Imagine', 'Imagine what you would do if you could live in another country.', 'Imagine ce que tu ferais si tu pouvais vivre dans un autre pays.'],
  [1674, 'Supposons', 'Suppose you lose your passport: you should contact the consulate.', 'Supposons que tu perdes ton passeport : tu devrais contacter le consulat.'],
  [1702, 'Autrement', 'I left too late; otherwise, I would not have missed the train.', 'Je suis parti trop tard ; autrement, je n’aurais pas raté le train.'],
  [1716, 'Regret', 'My only regret is not having accepted this invitation.', 'Mon seul regret est de ne pas avoir accepté cette invitation.'],
  [1730, 'Génial', 'In a formal request, I prefer to write “I thank you” rather than “great”.', 'Dans une demande formelle, je préfère écrire «je vous remercie» plutôt que «génial».'],
  [1744, 'Super', 'It was awesome to see you again, but I have to get home before midnight.', 'C’était super de te revoir, mais je dois rentrer avant minuit.'],
  [1786, 'Mec', 'In a professional interview, I avoid calling the other person “dude”.', 'Dans un entretien professionnel, j’évite d’appeler mon interlocuteur «mec».'],
  [1800, 'Formel', 'I use a more formal tone when I write to someone I do not know.', 'J’utilise un ton plus formel quand j’écris à quelqu’un que je ne connais pas.'],
  // B2: qualified claims, counterarguments, professional conditions and interpretation.
  [1817, 'Vérité', 'The search for truth requires us to distinguish facts from our interpretations.', 'La recherche de la vérité exige que nous distinguions les faits de nos interprétations.'],
  [1831, 'Sagesse', 'Wisdom consists not only in knowing, but also in recognizing the limits of one’s knowledge.', 'La sagesse ne consiste pas seulement à savoir, mais aussi à reconnaître les limites de ses connaissances.'],
  [1845, 'Croyance', 'A belief can give meaning to life without constituting proof of what it asserts.', 'Une croyance peut donner un sens à la vie sans constituer une preuve de ce qu’elle affirme.'],
  [1859, 'Doute', 'Doubt becomes useful when it drives us to examine the evidence rather than reject every new idea.', 'Le doute devient utile lorsqu’il nous pousse à examiner les preuves plutôt qu’à rejeter toute idée nouvelle.'],
  [1873, 'Liberté', 'Individual freedom cannot justify acts that threaten the safety of others.', 'La liberté individuelle ne saurait justifier des actes qui menacent la sécurité des autres.'],
  [1887, 'Justice', 'A society committed to justice must ensure that everyone can assert their rights.', 'Une société attachée à la justice doit veiller à ce que chacun puisse faire valoir ses droits.'],
  [1901, 'Affirmation', 'This assertion remains questionable as long as it is not based on verifiable data.', 'Cette affirmation reste contestable tant qu’elle ne s’appuie pas sur des données vérifiables.'],
  [1915, 'Sophisme', 'This fallacy presents two possibilities as the only options, whereas other solutions exist.', 'Ce sophisme présente deux possibilités comme les seules options, alors que d’autres solutions existent.'],
  [1929, 'Rhétorique', 'Convincing rhetoric does not relieve the speaker of the need to provide evidence in support of their thesis.', 'Une rhétorique convaincante ne dispense pas l’orateur de fournir des preuves à l’appui de sa thèse.'],
  [1943, 'Préjugé', 'This reasoning is based on a prejudice, since it attributes the same behavior to all members of a group.', 'Ce raisonnement repose sur un préjugé, puisqu’il attribue le même comportement à tous les membres d’un groupe.'],
  [1957, 'Argument', 'To evaluate this argument, one should examine whether the conclusion really follows from the premises.', 'Pour évaluer cet argument, il convient d’examiner si la conclusion découle réellement des prémisses.', ['Pour évaluer cet argument, il convient d’examiner si réellement la conclusion découle des prémisses.']],
  [1971, 'Persuader', 'To persuade a skeptical audience, one must address its objections instead of ignoring them.', 'Pour persuader un public sceptique, il faut répondre à ses objections au lieu de les ignorer.'],
  [1999, 'Déléguer', 'Before presenting the schedule, I will specify which tasks we can delegate to an external team.', 'Avant de présenter le calendrier, je préciserai quelles tâches nous pourrons déléguer à une équipe externe.'],
  [2013, 'Efficacité', 'We could accept this compromise provided that the effectiveness of the service is not compromised.', 'Nous pourrions accepter ce compromis à condition que l’efficacité du service ne soit pas compromise.'],
  [2027, 'Échéance', 'The report recommends postponing the deadline so that each team can check the results.', 'Le rapport recommande de repousser l’échéance afin que chaque équipe puisse vérifier les résultats.'],
  [2041, 'Négociation', 'During this professional gathering, I proposed continuing the negotiation after consulting my partners.', 'Lors de cette rencontre professionnelle, j’ai proposé de poursuivre la négociation après avoir consulté mes partenaires.'],
  [2055, 'Proposition', 'This proposal offers a realistic solution, provided that the additional costs are covered.', 'Cette proposition offre une solution réaliste, sous réserve que les coûts supplémentaires soient pris en charge.'],
  [2069, 'Rebondissement', 'In this film, the final plot twist forces the viewer to reinterpret the images of the opening scene.', 'Dans ce film, le dernier rebondissement oblige le spectateur à réinterpréter les images de la scène d’ouverture.'],
  [2083, 'Critique', 'This review highlights the richness of the style while regretting that the characters lack depth.', 'Cette critique souligne la richesse du style tout en regrettant que les personnages manquent de profondeur.'],
  [2097, "Chef-d'œuvre", 'Although the staging divides the audience, some consider this film a masterpiece.', 'Bien que la mise en scène divise le public, certains considèrent ce film comme un chef-d’œuvre.'],
  [2111, 'Inspiration', 'The composer draws inspiration from traditional melodies, transforming their rhythms to create an original work.', 'Le compositeur puise son inspiration dans les mélodies traditionnelles, dont il transforme les rythmes pour créer une œuvre originale.'],
  [2125, 'Roman', 'In my novel, I would like to alternate points of view so that the reader gradually discovers the characters’ motivations.', 'Dans mon roman, je voudrais alterner les points de vue afin que le lecteur découvre progressivement les motivations des personnages.', ['Dans mon roman, je voudrais alterner les points de vue afin que progressivement le lecteur découvre les motivations des personnages.']],
  [2139, 'Poème', 'This poem evokes solitude through contrasting images, without ever directly naming the feeling it expresses.', 'Ce poème évoque la solitude au moyen d’images contrastées, sans jamais nommer directement le sentiment qu’il exprime.', ['Ce poème évoque la solitude au moyen d’images contrastées, sans jamais directement nommer le sentiment qu’il exprime.']],
];

export function frenchWordOrderFixes(set) {
  const get=lessonRefs(set.snapshot,'fr'),seen=new Set();
  for(const [n,oldKey,english,answer,alternatives=[]] of frenchWordOrder){
    const {exercise:e,lesson,unit,course,ref}=get(n);
    const oldTiles=e.metadata?.tiles??e.correct_answer.split(/\s+/);
    if(seen.has(n)||e.type!=='sentence_construction'||e.correct_answer!==oldKey||oldTiles.length!==1||(e.metadata?.distractors??[]).length)throw new Error(`Not a unique audited sole bank: ${ref}`);
    seen.add(n);
    const tiles=answer.split(/\s+/),anchorLength=tiles.length>=7?2:1;
    if(tiles.length-2*anchorLength<3)throw new Error(`Fewer than three unanchored tiles: ${ref}`);
    const start=tiles.slice(0,anchorLength).join(' '),end=tiles.slice(-anchorLength).join(' ');
    set.update('exercises',e.id,{
      prompt:`Arrange every word to translate: “${english}” Use ordinary subject-before-verb order in declarative clauses. Start with “${start}” and end with “${end}”.`,
      correct_answer:answer,
      accepted_answers:alternatives,
      metadata:{...e.metadata,tiles,distractors:[]},
    },`${ref}: Replace a sole answer tile with an authored ${course.cefr_level} sentence for ${unit.title} / ${lesson.title}. Every tile is required; opening and ending constrain marked reorderings while leaving at least three unanchored tiles. New wording requires independent review.`);
  }
}
