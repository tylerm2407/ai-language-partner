import {lessonRefs} from './lesson-refs.mjs';

const mc=(prompt,key,options,explanation)=>({prompt,correct_answer:key,options,explanation,
  accepted_answers:[],skill_type:'mixed',target_grammar:null,target_word:null,hint_text:null,distractors:[]});
const task=(language,n,lesson,oldKey,fields)=>({language,n,lesson,oldKey,level:n<561?'A1':n<1137?'A2':'B1',fields});

// Individually authored contextual MC tasks. Keep the other lesson questions,
// all audio, and every approved bank; this is not a full-genre replacement.
export const residualNamedSkillRepairs=[
 task('es',141,'Asking Directions','Left',mc(
  'Read the directions. Visitor: «¿Dónde está la estación?» Local: «Sigue recto y gira a la izquierda». What should the visitor do after going straight?',
  'Turn left.',['Turn right.','Turn left.','Take a bus.','Wait at the bank.'],
  'Sigue recto means go straight; gira a la izquierda gives the next step, turn left. The question asks about the second action, not just the meaning of estación.')),
 task('es',177,'Buying Tickets','Bus',mc(
  'At the ticket office, a customer says: «Quiero dos billetes para Madrid, por favor». What does the customer request?',
  'Two tickets to Madrid.',['One ticket to Madrid.','Two tickets to Barcelona.','Two tickets to Madrid.','One ticket to Barcelona.'],
  'Dos billetes gives the quantity, two tickets; para Madrid gives the destination. Both details must match the request.')),
 task('es',211,'Daily Routine','Breakfast',mc(
  'Read Ana’s routine: «Todos los días desayuno a las siete y voy al trabajo a las ocho». What does Ana do at seven?',
  'She eats breakfast.',['She goes to work.','She eats lunch.','She goes to bed.','She eats breakfast.'],
  'Desayuno a las siete places breakfast at seven. Going to work happens at eight; the question requires matching the action with its time.')),
 task('es',247,'Time & Schedule','Red',mc(
  'Read the timetable: «La clase de español empieza a las nueve y termina a las diez. La clase de música empieza a las once». When does the Spanish class start?',
  'At nine.',['At nine.','At ten.','At eleven.','At twelve.'],
  'Empieza a las nueve gives the Spanish class’s start time. Ten is its end time, and eleven is the music class’s start time.')),
 task('es',293,'Making Plans','Doctor',mc(
  'Read the plan. Ana: «¿Jugamos al fútbol mañana?» Luis: «Sí, a las cinco». What do they agree to do?',
  'Play soccer tomorrow at five.',['Play soccer today at five.','Play soccer tomorrow at five.','Play soccer tomorrow at eight.','Cook tomorrow at five.'],
  'Ana proposes playing soccer tomorrow; Luis agrees and adds a las cinco, at five. The agreed activity, day and time must all match.')),
 task('es',329,'Weekend Activities','To cook',mc(
  'Read Luis’s weekend routine: «Los sábados cocino. Los domingos leo un libro». What does Luis do on Sundays?',
  'He reads a book.',['He cooks.','He plays soccer.','He reads a book.','He goes to the office.'],
  'Los domingos identifies Sundays, when Luis says leo un libro, I read a book. Cooking belongs to Saturday.')),
 task('es',363,'Describing People','Father',mc(
  'Read the description: «Mi hermana es alta y tiene el pelo corto». Which description matches the sister?',
  'Tall, with short hair.',['Short, with long hair.','Tall, with long hair.','Short, with short hair.','Tall, with short hair.'],
  'Alta describes her height, tall. Tiene el pelo corto says she has short hair; both features matter.')),
 task('es',399,'Family Activities','Daughter',mc(
  'Read about a family: «Los domingos, mi familia come junta en casa». What does the family do on Sundays?',
  'They eat together at home.',['They eat together at home.','They work at the office.','They play soccer in the park.','They study at school.'],
  'Come junta means eats together, and en casa locates the activity at home. This is a family activity, not merely a family-member label.')),
 task('es',469,'Describing Your Home','Bedroom',mc(
  'Read the home description: «Mi casa tiene dos dormitorios. El jardín es pequeño». Which detail is stated about the garden?',
  'It is small.',['It is behind the house.','It is small.','It is large.','It is on the roof.'],
  'El jardín es pequeño explicitly describes the garden as small. Dos dormitorios is a separate detail about the house.')),
 task('es',539,'Healthy Habits','Sick',mc(
  'Read about a daily habit: «Mi hermano da un paseo todos los días». Which routine does this describe?',
  'He takes a walk every day.',['He takes a walk once a month.','He swims every day.','He takes a walk every day.','He only walks on Sundays.'],
  'Da un paseo describes taking a walk, and todos los días means every day. The task checks the stated habit, not a medical recommendation.')),
 task('es',1041,'Preferences','Cheaper',mc(
  'Read the preference: «Me gustan los dos trenes, pero prefiero el más lento porque quiero ver el paisaje». Which choice and reason match the speaker?',
  'The slower train, to see the scenery.',['The faster train, to arrive earlier.','The slower train, because it is cheaper.','The faster train, because it is cheaper.','The slower train, to see the scenery.'],
  'Prefiero el más lento states the preference for the slower train. Porque quiero ver el paisaje supplies the reason: the speaker wants to see the scenery, not necessarily pay less.')),
 task('es',1515,'Tech Problems','Password',mc(
  'Read the support message: «No puedo entrar en mi cuenta porque he olvidado la contraseña. ¿Cómo puedo cambiarla?» What help does this person request?',
  'Instructions for changing the password.',['Instructions for changing the password.','Instructions for downloading a photo.','Help replacing a broken keyboard.','Help uploading a video.'],
  'The person cannot access the account after forgetting the password. Cambiarla refers back to la contraseña; the request is about changing that password, not downloading or replacing hardware.')),

 task('ja',141,'Asking Directions','Left',mc(
  'Read the directions. Visitor:「駅はどこですか。」 Local:「まっすぐ行って、左に曲がってください。」 What should the visitor do after going straight?',
  'Turn left.',['Turn left.','Turn right.','Take a bus.','Wait at the bank.'],
  'まっすぐ行って gives the first step, go straight. 左に曲がってください then asks the visitor to turn left.')),
 task('ja',177,'Buying Tickets','Bus',mc(
  'At the ticket office, a customer says:「東京までの切符を二枚ください。」 What does the customer request?',
  'Two tickets to Tokyo.',['One ticket to Tokyo.','Two tickets to Tokyo.','Two tickets to Osaka.','One ticket to Osaka.'],
  '東京まで gives the destination, Tokyo. 切符を二枚ください requests two tickets; 枚 is the counter used here for tickets.')),
 task('ja',211,'Daily Routine','Breakfast',mc(
  'Read Ana’s routine:「毎日、七時に朝ご飯を食べます。八時に仕事に行きます。」 What does Ana do at seven?',
  'She eats breakfast.',['She goes to work.','She eats lunch.','She eats breakfast.','She goes to bed.'],
  '七時に朝ご飯を食べます places eating breakfast at seven. 八時に仕事に行きます places going to work at eight.')),
 task('ja',247,'Time & Schedule','Red',mc(
  'Read the timetable:「日本語の授業は九時に始まって、十時に終わります。音楽の授業は十一時に始まります。」 When does the Japanese class start?',
  'At nine.',['At ten.','At eleven.','At twelve.','At nine.'],
  '日本語の授業は九時に始まって says the Japanese class starts at nine. Ten is its end time; eleven starts the music class.')),
 task('ja',293,'Making Plans','Doctor',mc(
  'Read the plan. Ana:「明日、五時にサッカーをしましょう。」 Luis:「いいですね。」 What plan does Luis accept?',
  'Play soccer tomorrow at five.',['Play soccer tomorrow at five.','Play soccer today at five.','Play soccer tomorrow at eight.','Cook tomorrow at five.'],
  '明日 gives tomorrow, 五時に gives at five, and サッカーをしましょう proposes playing soccer together. いいですね accepts the proposed plan here.')),
 task('ja',329,'Weekend Activities','To cook',mc(
  'Read Luis’s weekend routine:「土曜日は料理をします。日曜日は本を読みます。」 What does Luis do on Sundays?',
  'He reads a book.',['He cooks.','He reads a book.','He plays soccer.','He goes to the office.'],
  '日曜日は本を読みます says Luis reads a book on Sunday. 土曜日 places cooking on Saturday.')),
 task('ja',363,'Describing People','Father',mc(
  'Read the description:「私の姉は背が高くて、髪が短いです。」 Which description matches the sister?',
  'Tall, with short hair.',['Short, with long hair.','Tall, with long hair.','Tall, with short hair.','Short, with short hair.'],
  '背が高い describes being tall, while 髪が短い describes short hair. 姉 identifies the speaker’s older sister.')),
 task('ja',399,'Family Activities','Daughter',mc(
  'Read about a family:「日曜日は、家族と一緒に家でご飯を食べます。」 What does the family do on Sundays?',
  'They eat together at home.',['They work at the office.','They play soccer in the park.','They study at school.','They eat together at home.'],
  '家族と一緒に indicates doing the activity with the family; 家で gives the location, at home. ご飯を食べます means eat a meal.')),
 task('ja',469,'Describing Your Home','Bedroom',mc(
  'Read the home description:「うちには寝室が二つあります。庭は小さいです。」 Which detail is stated about the garden?',
  'It is small.',['It is small.','It is behind the house.','It is large.','It is on the roof.'],
  '庭は小さいです says the garden is small. 寝室が二つあります is a separate statement that the home has two bedrooms.')),
 task('ja',539,'Healthy Habits','Sick',mc(
  'Read about a daily habit:「弟は毎日散歩します。」 Which routine does this describe?',
  'He takes a walk every day.',['He takes a walk once a month.','He takes a walk every day.','He swims every day.','He only walks on Sundays.'],
  '散歩します means takes a walk, and 毎日 means every day. 弟 identifies the speaker’s younger brother; no medical advice is being assessed.')),

 task('ko',141,'Asking Directions','Left',mc(
  'Read the directions. Visitor: “역이 어디에 있어요?” Local: “똑바로 가서 왼쪽으로 도세요.” What should the visitor do after going straight?',
  'Turn left.',['Take a bus.','Turn right.','Turn left.','Wait at the bank.'],
  '똑바로 가서 gives the first action, go straight. 왼쪽으로 도세요 gives the next direction, turn left.')),
 task('ko',177,'Buying Tickets','Bus',mc(
  'At the ticket office, a customer says: “부산행 표 두 장 주세요.” What does the customer request?',
  'Two tickets to Busan.',['One ticket to Busan.','Two tickets to Seoul.','One ticket to Seoul.','Two tickets to Busan.'],
  '부산행 identifies the destination, Busan. 표 두 장 주세요 asks for two tickets; 장 is the counter used here for tickets.')),
 task('ko',211,'Daily Routine','Breakfast',mc(
  'Read Ana’s routine: “매일 일곱 시에 아침을 먹어요. 여덟 시에 일하러 가요.” What does Ana do at seven?',
  'She eats breakfast.',['She eats breakfast.','She goes to work.','She eats lunch.','She goes to bed.'],
  '일곱 시에 아침을 먹어요 places breakfast at seven. 여덟 시에 일하러 가요 places going to work at eight.')),
 task('ko',247,'Time & Schedule','Red',mc(
  'Read the timetable: “한국어 수업은 아홉 시에 시작해서 열 시에 끝나요. 음악 수업은 열한 시에 시작해요.” When does the Korean class start?',
  'At nine.',['At ten.','At nine.','At eleven.','At twelve.'],
  '한국어 수업은 아홉 시에 시작해서 gives nine as the Korean class’s start time. Ten is its end time; eleven starts the music class.')),
 task('ko',293,'Making Plans','Doctor',mc(
  'Read the plan. Ana: “내일 다섯 시에 축구할까요?” Luis: “네, 좋아요.” What plan does Luis accept?',
  'Play soccer tomorrow at five.',['Play soccer today at five.','Play soccer tomorrow at eight.','Play soccer tomorrow at five.','Cook tomorrow at five.'],
  '내일 다섯 시에 supplies tomorrow at five, and 축구할까요? proposes playing soccer. 네, 좋아요 accepts that proposal.')),
 task('ko',329,'Weekend Activities','To cook',mc(
  'Read Luis’s weekend routine: “토요일에는 요리해요. 일요일에는 책을 읽어요.” What does Luis do on Sundays?',
  'He reads a book.',['He cooks.','He plays soccer.','He goes to the office.','He reads a book.'],
  '일요일에는 책을 읽어요 says he reads a book on Sundays. The cooking activity is assigned to 토요일, Saturday.')),
 task('ko',363,'Describing People','Father',mc(
  'Read the description: “제 여동생은 키가 크고 머리가 짧아요.” Which description matches the sister?',
  'Tall, with short hair.',['Tall, with short hair.','Short, with long hair.','Tall, with long hair.','Short, with short hair.'],
  '키가 크다 describes being tall, and 머리가 짧다 describes short hair in this appearance context. 여동생 identifies the speaker’s younger sister.')),
 task('ko',399,'Family Activities','Daughter',mc(
  'Read about a family: “일요일에는 가족이 집에서 함께 밥을 먹어요.” What does the family do on Sundays?',
  'They eat together at home.',['They work at the office.','They eat together at home.','They play soccer in the park.','They study at school.'],
  '가족이 identifies the family, 집에서 gives at home, and 함께 밥을 먹어요 says they eat together.')),
 task('ko',469,'Describing Your Home','Bedroom',mc(
  'Read the home description: “우리 집에는 침실이 두 개 있어요. 정원은 작아요.” Which detail is stated about the garden?',
  'It is small.',['It is behind the house.','It is large.','It is small.','It is on the roof.'],
  '정원은 작아요 says the garden is small. 침실이 두 개 있어요 is a separate detail: the home has two bedrooms.')),
 task('ko',539,'Healthy Habits','Sick',mc(
  'Read about a daily habit: “남동생은 매일 산책해요.” Which routine does this describe?',
  'He takes a walk every day.',['He takes a walk once a month.','He swims every day.','He only walks on Sundays.','He takes a walk every day.'],
  '산책해요 means takes a walk, and 매일 means every day. 남동생 identifies a younger brother; the question does not ask for medical advice.')),
 task('ko',1041,'Preferences','Cheaper',mc(
  'Read the preference: “두 기차가 다 좋지만 저는 경치를 보고 싶어서 더 느린 기차를 골라요.” Which choice and reason match the speaker?',
  'The slower train, to see the scenery.',['The faster train, to arrive earlier.','The slower train, to see the scenery.','The slower train, because it is cheaper.','The faster train, because it is cheaper.'],
  '더 느린 기차를 골라요 states the choice of the slower train. 경치를 보고 싶어서 explains that the speaker wants to see the scenery. No price reason is given.')),
];

export function residualNamedSkillFixes(set) {
 const seen=new Set();
 // Fail before emitting anything if any of these previously untouched rows
 // acquires a draft patch. New overlaps require explicit independent review.
 for(const p of residualNamedSkillRepairs) {
  const c=lessonRefs(set.snapshot,p.language)(p.n),e=c.exercise;
  if(e.type!=='multiple_choice'||e.correct_answer!==p.oldKey||c.lesson.title!==p.lesson||c.course.cefr_level!==p.level||
     e.prompt_audio_url!==null||e.card_id!==null||Object.keys(e.metadata).length||seen.has(e.id))throw Error(`${c.ref}: changed residual named-skill source`);
  if(set.patches().some(x=>x.table==='exercises'&&x.id===e.id))throw Error(`${c.ref}: new overlap needs independent review`);
  seen.add(e.id);
 }
 if(seen.size!==33)throw Error('Expected exactly thirty-three individually selected tasks');
 for(const p of residualNamedSkillRepairs){const c=lessonRefs(set.snapshot,p.language)(p.n);set.update('exercises',c.exercise.id,p.fields,
  `${c.ref}: Add the missing named function in one short contextual choice task; preserve the remaining useful review, audio and approved banks.`);}
}
