import { lessonRefs } from './lesson-refs.mjs';

// Individually authored from each Portuguese frozen row and exact lesson context.
// New wording is a draft for independent review, not an integrated content update.
export const portugueseWordOrder = [
  // A2: everyday relationships, health, housing, feelings, plans and customs.
  [566, 'Marido', 'My aunt’s husband is my uncle.', 'O marido da minha tia é meu tio.'],
  [578, 'Esposa', 'Pedro’s wife is a friend of my sister.', 'A esposa do Pedro é amiga da minha irmã.'],
  [590, 'Namorado', 'My sister’s boyfriend is twenty years old.', 'O namorado da minha irmã tem vinte anos.'],
  [602, 'Namorada', 'My girlfriend will finish college this year.', 'Minha namorada vai terminar a faculdade este ano.'],
  [614, 'Vizinho', 'My neighbor has lunch with his family every Sunday.', 'Meu vizinho almoça com a família todos os domingos.'],
  [626, 'Casamento', 'My cousin’s wedding will be in December.', 'O casamento da minha prima vai ser em dezembro.'],
  [638, 'Enfermeira', 'The nurse asks whether I have a headache.', 'A enfermeira pergunta se tenho dor de cabeça.'],
  [650, 'Dentista', 'My appointment with the dentist is tomorrow morning.', 'Minha consulta com o dentista é amanhã de manhã.'],
  [662, 'Estresse', 'At the pharmacy, I asked for advice on reducing stress.', 'Na farmácia, pedi conselhos para diminuir o estresse.'],
  [674, 'Cansado', 'I get tired when I am very worried.', 'Eu fico cansado quando estou muito preocupado.'],
  [686, 'Descansar', 'I need to rest a little after work.', 'Eu preciso descansar um pouco depois do trabalho.'],
  [698, 'Dieta', 'My diet includes fruit, vegetables and plenty of water.', 'Minha dieta inclui frutas, legumes e muita água.'],
  [710, 'Lavar', 'The washing machine is beside the kitchen door.', 'A máquina de lavar fica ao lado da porta da cozinha.'],
  [722, 'Varrer', 'I am going to sweep the floor before the visitors arrive.', 'Vou varrer o chão antes da chegada das visitas.'],
  [734, 'Cozinhar', 'In the new house, we will have more space for cooking.', 'Na casa nova, vamos ter mais espaço para cozinhar.'],
  [746, 'Aluguel', 'My neighbor pays the same rent as me.', 'Meu vizinho paga o mesmo aluguel que eu.'],
  [758, 'Mudar-se', 'My sister wants to move because the house is very cold.', 'Minha irmã quer mudar-se porque a casa é muito fria.'],
  [770, 'Apartamento', 'The apartment has two bedrooms and a large kitchen.', 'O apartamento tem dois quartos e uma cozinha grande.'],
  [782, 'Tímido', 'My brother is shy, but he is happy with his friends.', 'Meu irmão é tímido, mas fica feliz com os amigos.'],
  [794, 'Corajoso', 'My father is brave, but he is afraid of heights.', 'Meu pai é corajoso, mas tem medo de altura.'],
  [806, 'Gentil', 'My cousin is kind to the new neighbors.', 'Meu primo é gentil com os vizinhos novos.'],
  [818, 'Generoso', 'Paulo is generous and shares his food with his friends.', 'Paulo é generoso e divide sua comida com os amigos.'],
  [830, 'Preguiçoso', 'He gets upset when people call him lazy.', 'Ele fica chateado quando o chamam de preguiçoso.'],
  [842, 'Paciente', 'My brother is patient when I ask too many questions.', 'Meu irmão é paciente quando faço perguntas demais.'],
  [950, 'Férias', 'I want to learn to drive before the vacation.', 'Eu quero aprender a dirigir antes das férias.'],
  [962, 'Meta', 'My goal is to make an appointment for tomorrow.', 'Minha meta é marcar uma consulta para amanhã.'],
  [974, 'Sonho', 'I think that my dream will come true one day.', 'Acho que meu sonho vai virar realidade um dia.'],
  [986, 'Planejar', 'We are going to plan the trip after dinner.', 'Nós vamos planejar a viagem depois do jantar.'],
  [1070, 'Presente', 'At Christmas, my family gives a gift to each child.', 'No Natal, minha família dá um presente a cada criança.'],
  [1082, 'Festa', 'For this party, my grandmother prepares a traditional dish.', 'Para esta festa, minha avó prepara um prato tradicional.'],
  [1094, 'Celebrar', 'We are going to celebrate this date with music and dancing.', 'Nós vamos celebrar esta data com música e dança.'],
  [1106, 'Música', 'The music starts when the festival opens its doors.', 'A música começa quando o festival abre as portas.'],
  [1118, 'Dança', 'My sister received a dance course as a gift.', 'Minha irmã ganhou um curso de dança de presente.'],
  [1130, 'Festival', 'Our family goes to the city festival every year.', 'Nossa família vai ao festival da cidade todos os anos.'],
  // B1: linked opinions, narrative events, reasons and register in local contexts.
  [1142, 'Sociedade', 'In my opinion, society needs to invest more in education.', 'Na minha opinião, a sociedade precisa investir mais em educação.'],
  [1156, 'Política', 'I agree with you, but I disagree with this transport policy.', 'Eu concordo com você, mas discordo dessa política de transporte.'],
  [1170, 'Economia', 'The report shows how the drought affected the region’s economy.', 'A reportagem mostra como a seca afetou a economia da região.'],
  [1184, 'Argumentar', 'To argue against closing the school, we need to present the problems this would cause.', 'Para argumentar contra o fechamento da escola, precisamos apresentar os problemas que isso causaria.'],
  [1198, 'Debate', 'I want to participate in the debate because the outcome will affect our neighborhood.', 'Quero participar do debate porque o resultado vai afetar nosso bairro.'],
  [1212, 'Razão', 'The main reason is that many families cannot afford the electricity bill.', 'A principal razão é que muitas famílias não conseguem pagar a conta de luz.'],
  [1226, 'Contratar', 'In the interview, I asked when the company intended to hire new employees.', 'Na entrevista, perguntei quando a empresa pretendia contratar novos funcionários.'],
  [1240, 'Demitir', 'The manager warned that the company would have to dismiss part of the team.', 'A gerente avisou que a empresa teria de demitir parte da equipe.'],
  [1254, 'Colega', 'During the meeting, my colleague explained why the delivery had been delayed.', 'Durante a reunião, meu colega explicou por que a entrega tinha atrasado.'],
  [1268, 'Gerente', 'I want to work as a manager to learn to lead a team.', 'Quero trabalhar como gerente para aprender a liderar uma equipe.'],
  [1282, 'Prazo', 'We missed the deadline because the computer stopped working during the presentation.', 'Perdemos o prazo porque o computador parou de funcionar durante a apresentação.'],
  [1296, 'Projeto', 'We postponed the project because the information was incomplete.', 'Adiamos o projeto porque as informações estavam incompletas.'],
  [1310, 'Bagagem', 'Before buying the ticket, I check whether the price includes luggage.', 'Antes de comprar a passagem, verifico se o preço inclui a bagagem.'],
  [1338, 'Atraso', 'At the hotel reception, I explained that the delay had been caused by traffic.', 'Na recepção do hotel, expliquei que o atraso tinha sido causado pelo trânsito.'],
  [1352, 'Cancelar', 'We had to cancel the outing because it began to rain heavily.', 'Tivemos de cancelar o passeio porque começou a chover muito.'],
  [1366, 'Aventura', 'The adventure became more difficult when we lost the map of the region.', 'A aventura ficou mais difícil quando perdemos o mapa da região.'],
  [1380, 'Turista', 'The tourist asked where he could rent a bicycle to explore the city.', 'O turista perguntou onde poderia alugar uma bicicleta para conhecer a cidade.'],
  [1408, 'Conservação', 'Forest conservation is essential for protecting the animals that live there.', 'A conservação das florestas é essencial para proteger os animais que vivem nelas.'],
  [1422, 'Energia', 'We can save energy by turning off the lights when we leave home.', 'Podemos economizar energia apagando as luzes quando saímos de casa.'],
  [1436, 'Solar', 'Solar energy makes it possible to generate electricity without burning coal.', 'A energia solar permite gerar eletricidade sem queimar carvão.'],
  [1450, 'Carbono', 'To reduce my carbon footprint, I prefer to travel by train when possible.', 'Para reduzir minha pegada de carbono, prefiro viajar de trem quando é possível.'],
  [1478, 'Carregar', 'Before uploading photos to the social network, I ask permission from the people who appear in them.', 'Antes de carregar fotos na rede social, peço autorização às pessoas que aparecem nelas.'],
  [1492, 'Tela', 'I reduced the screen brightness because the battery was almost empty.', 'Eu diminuí o brilho da tela porque a bateria estava quase vazia.'],
  [1506, 'Teclado', 'I prefer to use a keyboard to write long messages, because I find it more comfortable.', 'Prefiro usar um teclado para escrever mensagens longas, pois acho mais confortável.'],
  [1548, 'Robô', 'This robot answers the questions, but does not always understand what we mean.', 'Este robô responde às perguntas, mas nem sempre entende o que queremos dizer.'],
  [1562, 'Depois', 'We found the key and then entered the house that was empty.', 'Encontramos a chave e depois entramos na casa que estava vazia.', ['Encontramos a chave e entramos depois na casa que estava vazia.']],
  [1576, 'Finalmente', 'After a long journey, we finally arrived at our destination.', 'Depois de uma longa viagem, finalmente chegamos ao nosso destino.', ['Depois de uma longa viagem, chegamos finalmente ao nosso destino.']],
  [1604, 'Personagem', 'The character was crossing the street when he heard someone call his name.', 'O personagem atravessava a rua quando ouviu alguém chamar seu nome.'],
  [1618, 'Enredo', 'The plot takes place in a village where everyone knows the protagonist’s family.', 'O enredo se passa numa vila onde todos conhecem a família do protagonista.'],
  [1632, 'Começo', 'At the beginning of the story, nobody knew why the door was open.', 'No começo da história, ninguém sabia por que a porta estava aberta.'],
  [1646, 'Talvez', 'Perhaps we will stay home and watch a film if it rains tomorrow.', 'Talvez fiquemos em casa e vejamos um filme se chover amanhã.'],
  [1660, 'Imagine', 'Imagine what your life would be like if you lived in another country.', 'Imagine como seria sua vida se você morasse em outro país.'],
  [1674, 'Suponha', 'Suppose you lose your passport: it would be better to contact the consulate.', 'Suponha que você perca o passaporte: seria melhor procurar o consulado.'],
  [1716, 'Arrependimento', 'My greatest regret is not having asked for help when I needed it.', 'Meu maior arrependimento é não ter pedido ajuda quando precisei.'],
  [1730, 'Legal', 'In a formal request, I prefer to thank people for their attention instead of writing “cool”.', 'Num pedido formal, prefiro agradecer pela atenção em vez de escrever “legal”.'],
  [1744, 'Incrível', 'It was awesome to see you again, but I need to leave now.', 'Foi incrível ver você de novo, mas preciso ir embora agora.'],
  [1786, 'Cara', 'In a job interview, I do not call the interviewer “dude”.', 'Numa entrevista de emprego, não chamo o entrevistador de “cara”.'],
  [1800, 'Formal', 'I use more formal language when I write to someone I do not know.', 'Uso uma linguagem mais formal quando escrevo para alguém que não conheço.'],
  // B2: qualified judgments, argument evaluation and extended professional/artistic ideas.
  [1817, 'Verdade', 'The search for truth requires a willingness to revise our conclusions when new evidence emerges.', 'A busca pela verdade exige disposição para rever nossas conclusões quando novas evidências surgem.'],
  [1831, 'Sabedoria', 'For me, wisdom includes recognizing that our convictions may be mistaken.', 'Para mim, a sabedoria inclui reconhecer que nossas convicções podem estar equivocadas.'],
  [1845, 'Crença', 'A belief can guide our choices without us having sufficient evidence to justify it.', 'Uma crença pode orientar nossas escolhas sem que tenhamos provas suficientes para justificá-la.', ['Uma crença pode orientar nossas escolhas sem que tenhamos suficientes provas para justificá-la.']],
  [1859, 'Dúvida', 'Doubt is productive when it leads us to investigate the reasons that support an assertion.', 'A dúvida é produtiva quando nos leva a investigar as razões que sustentam uma afirmação.'],
  [1873, 'Liberdade', 'Freedom of expression allows disagreement, but does not eliminate responsibility for what we say.', 'A liberdade de expressão permite o desacordo, mas não elimina a responsabilidade pelo que dizemos.'],
  [1887, 'Justiça', 'A decision can be legal without corresponding to what everyone considers a form of justice.', 'Uma decisão pode ser legal sem corresponder ao que todos consideram uma forma de justiça.'],
  [1901, 'Afirmação', 'This claim will only be convincing if there is reliable data to support the conclusion presented.', 'Essa afirmação só será convincente se houver dados confiáveis que sustentem a conclusão apresentada.', ['Essa afirmação será convincente só se houver dados confiáveis que sustentem a conclusão apresentada.']],
  [1915, 'Falácia', 'The fallacy in this argument consists in attacking the person without responding to the ideas they presented.', 'A falácia desse argumento consiste em atacar a pessoa sem responder às ideias que ela apresentou.'],
  [1929, 'Retórica', 'Rhetoric can make a message attractive, although it does not guarantee that its content is true.', 'A retórica pode tornar uma mensagem atraente, embora não garanta que seu conteúdo seja verdadeiro.'],
  [1943, 'Viés', 'To avoid confirmation bias, we also need to consider the evidence that contradicts our hypothesis.', 'Para evitar o viés de confirmação, precisamos considerar também as evidências que contradizem nossa hipótese.', ['Para evitar o viés de confirmação, também precisamos considerar as evidências que contradizem nossa hipótese.', 'Para evitar o viés de confirmação, precisamos também considerar as evidências que contradizem nossa hipótese.']],
  [1957, 'Argumento', 'Before accepting this argument, it is necessary to verify whether the conclusion follows from the premises presented.', 'Antes de aceitar esse argumento, é necessário verificar se a conclusão decorre das premissas apresentadas.'],
  [1971, 'Persuadir', 'To persuade a distrustful audience, we should explain why the proposal deserves to be taken seriously.', 'Para persuadir um público desconfiado, devemos explicar por que a proposta merece ser levada a sério.'],
  [1985, 'Ata', 'I am forwarding the meeting minutes so that everyone can check the decisions before approving the document.', 'Encaminho a ata da reunião para que todos possam conferir as decisões antes de aprová-la.'],
  [1999, 'Delegar', 'During the presentation, I will explain which tasks it will be possible to delegate without compromising the quality of the work.', 'Durante a apresentação, explicarei quais tarefas será possível delegar sem comprometer a qualidade do trabalho.'],
  [2013, 'Eficiência', 'We can review the terms of the agreement, provided that the efficiency of the service is preserved.', 'Podemos rever as condições do acordo, desde que a eficiência do serviço seja preservada.'],
  [2027, 'Prazo', 'The report recommends extending the deadline so that those responsible can analyze the results carefully.', 'O relatório recomenda ampliar o prazo para que os responsáveis possam analisar os resultados com cuidado.'],
  [2041, 'Negociação', 'After the meeting with potential partners, we will resume the negotiation based on the priorities we identified.', 'Após o encontro com possíveis parceiros, retomaremos a negociação com base nas prioridades que identificamos.'],
  [2055, 'Proposta', 'The proposal provides for a gradual reduction in costs, provided that the initial investment is approved.', 'A proposta prevê uma redução gradual dos custos, contanto que o investimento inicial seja aprovado.', ['A proposta prevê uma gradual redução dos custos, contanto que o investimento inicial seja aprovado.']],
  [2069, 'Reviravolta', 'The film’s final plot twist changes the meaning of the images that seemed merely decorative at the beginning.', 'A reviravolta final do filme altera o significado das imagens que pareciam apenas decorativas no início.'],
  [2083, 'Resenha', 'The review praises the construction of the characters, but questions whether the ending meets the expectations created.', 'A resenha elogia a construção dos personagens, mas questiona se o desfecho corresponde às expectativas criadas.'],
  [2097, 'Obra-prima', 'Although the production is controversial, many critics consider the play a masterpiece of contemporary theater.', 'Embora a montagem seja controversa, muitos críticos consideram a peça uma obra-prima do teatro contemporâneo.'],
  [2111, 'Inspiração', 'The musician found inspiration in local rhythms, which he reinterpreted to create his own sound.', 'O músico encontrou inspiração nos ritmos locais, que reinterpretou para criar uma sonoridade própria.'],
  [2125, 'Romance', 'In my novel, I intend to alternate narrators so that the reader notices the contradictions between their accounts.', 'No meu romance, pretendo alternar os narradores para que o leitor perceba as contradições entre suas versões.'],
  [2139, 'Poema', 'The poem explores memory through fragmented images, leaving the reader the task of reconstructing the past.', 'O poema explora a memória por meio de imagens fragmentadas, deixando ao leitor a tarefa de reconstruir o passado.'],
];

export function portugueseWordOrderFixes(set) {
  const get = lessonRefs(set.snapshot, 'pt'), seen = new Set();
  for (const [n, oldKey, english, answer, alternatives = []] of portugueseWordOrder) {
    const { exercise: e, lesson, unit, course, ref } = get(n);
    const oldTiles = e.metadata?.tiles ?? e.correct_answer.split(/\s+/);
    if (seen.has(n) || e.type !== 'sentence_construction' || e.correct_answer !== oldKey || oldTiles.length !== 1 || (e.metadata?.distractors ?? []).length) throw new Error(`Not a unique audited sole bank: ${ref}`);
    seen.add(n);
    const tiles = answer.split(/\s+/), anchorLength = tiles.length >= 7 ? 2 : 1;
    if (tiles.slice(anchorLength, -anchorLength).filter(t => /\p{L}/u.test(t)).length < 3) throw new Error(`Fewer than three unanchored words: ${ref}`);
    const start = tiles.slice(0, anchorLength).join(' '), end = tiles.slice(-anchorLength).join(' ');
    set.update('exercises', e.id, {
      prompt: `Arrange every word to translate: “${english}” Use ordinary subject-before-verb order in declarative clauses when a noun or pronoun subject is supplied. Start with “${start}” and end with “${end}”.`,
      correct_answer: answer,
      accepted_answers: alternatives,
      metadata: { ...e.metadata, tiles, distractors: [] },
    }, `${ref}: Replace a sole answer tile with an authored ${course.cefr_level} sentence for ${unit.title} / ${lesson.title}. Every tile is required; anchors retain at least three unanchored words. Portuguese subject omission and supplied clitic forms are preserved. New wording requires independent review.`);
  }
}
