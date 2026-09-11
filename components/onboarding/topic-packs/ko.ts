/**
 * Korean topic packs. A1, five topics, each sentence built from its words.
 *
 * Tiles are eojeol — the spacing unit Korean actually uses, particle attached
 * to the word it marks. Splitting the particle off would teach a spacing rule
 * that does not exist.
 */
import type { LanguagePacks } from './spec';

export const KO_PACKS: LanguagePacks = {
  travel: {
    words: [
      { target: '커피', gloss: 'coffee' },
      { target: '주세요', gloss: 'please give me' },
      { target: '계산서', gloss: 'the bill' },
    ],
    sentence: { target: '커피 한 잔 주세요.', gloss: 'One coffee, please.' },
    tiles: ['커피', '한', '잔', '주세요'],
    tileDistractors: ['계산서', '물'],
    foil: { target: '역', gloss: 'the station' },
    plan: [
      { title: 'Ordering a coffee', words: ['커피', '주세요', '감사합니다'] },
      { title: 'Asking for the bill', words: ['계산서', '얼마예요', '카드로'] },
      { title: 'Finding the station', words: ['역', '지하철', '표'] },
      { title: 'Checking into a hotel', words: ['호텔', '방', '열쇠'] },
      { title: 'Asking the way', words: ['오른쪽', '왼쪽', '쭉'] },
      { title: 'Ordering a meal', words: ['메뉴', '물', '한 명'] },
    ],
    solLine: 'Then we start where you will actually stand: at the counter, ordering.',
  },
  family: {
    words: [
      { target: '어머니', gloss: 'my mother' },
      { target: '동생', gloss: 'my younger sibling' },
      { target: '집', gloss: 'home' },
    ],
    sentence: { target: '어머니는 집에 있어요.', gloss: 'My mother is at home.' },
    tiles: ['어머니는', '집에', '있어요'],
    tileDistractors: ['동생은', '학교에'],
    foil: { target: '아버지', gloss: 'my father' },
    plan: [
      { title: 'Naming your people', words: ['어머니', '아버지', '동생'] },
      { title: 'Saying where they are', words: ['집에', '있어요', '여기'] },
      { title: 'How old everyone is', words: ['몇 살', '살이에요', '나이'] },
      { title: 'At the family table', words: ['밥', '많이 드세요', '맛있어요'] },
      { title: 'Talking about your day', words: ['오늘', '일했어요', '쉬었어요'] },
      { title: 'Making plans together', words: ['일요일', '같이', '가요'] },
    ],
    solLine: 'Good — we will build the words you need at their table, not in a textbook.',
  },
  work: {
    words: [
      { target: '일', gloss: 'work' },
      { target: '회의', gloss: 'a meeting' },
      { target: '내일', gloss: 'tomorrow' },
    ],
    sentence: { target: '내일 회의가 있어요.', gloss: 'I have a meeting tomorrow.' },
    tiles: ['내일', '회의가', '있어요'],
    tileDistractors: ['일이', '오늘'],
    foil: { target: '사무실', gloss: 'the office' },
    plan: [
      { title: 'Talking about your job', words: ['일', '회사', '다녀요'] },
      { title: 'Arranging a meeting', words: ['회의', '내일', '열 시'] },
      { title: 'In the office', words: ['사무실', '이메일', '자료'] },
      { title: 'Meeting a client', words: ['고객님', '처음 뵙겠습니다', '잘 부탁드립니다'] },
      { title: 'Saying what you think', words: ['생각해요', '맞아요', '아마'] },
      { title: 'Wrapping up a call', words: ['들어가세요', '보낼게요', '또 연락'] },
    ],
    solLine: 'Right — we will aim at the meeting you have to sit through, not small talk.',
  },
  media_culture: {
    words: [
      { target: '영화', gloss: 'a film' },
      { target: '음악', gloss: 'music' },
      { target: '좋아해요', gloss: 'I like' },
    ],
    sentence: { target: '이 영화를 좋아해요.', gloss: 'I like this film.' },
    tiles: ['이', '영화를', '좋아해요'],
    tileDistractors: ['음악을', '정말'],
    foil: { target: '책', gloss: 'a book' },
    plan: [
      { title: 'Saying what you like', words: ['좋아해요', '정말', '별로예요'] },
      { title: 'Talking about films', words: ['영화', '배우', '끝'] },
      { title: 'Talking about music', words: ['음악', '노래', '가사'] },
      { title: 'What happened in it', words: ['처음에', '그다음에', '됐어요'] },
      { title: 'Recommending something', words: ['보세요', '추천해요', '대박'] },
      { title: 'Disagreeing politely', words: ['글쎄요', '저는', '더 좋아해요'] },
    ],
    solLine: 'Then the subtitles come off sooner than you think. Start with one line.',
  },
  housing_admin: {
    words: [
      { target: '아파트', gloss: 'an apartment' },
      { target: '월세', gloss: 'the monthly rent' },
      { target: '시내', gloss: 'downtown' },
    ],
    sentence: { target: '시내에서 아파트를 찾고 있어요.', gloss: 'I am looking for an apartment downtown.' },
    tiles: ['시내에서', '아파트를', '찾고', '있어요'],
    tileDistractors: ['월세가', '학교에서'],
    foil: { target: '열쇠', gloss: 'the key' },
    plan: [
      { title: 'Looking for a flat', words: ['아파트', '찾고 있어요', '시내'] },
      { title: 'Talking about rent', words: ['월세', '보증금', '한 달에'] },
      { title: 'Viewing the place', words: ['부엌', '화장실', '밝아요'] },
      { title: 'At the district office', words: ['구청', '예약', '서류'] },
      { title: 'Opening a bank account', words: ['은행', '통장', '이름'] },
      { title: 'Calling the doctor', words: ['병원', '아파요', '예약'] },
    ],
    solLine: 'Moving is mostly paperwork — so we will start with the words that open doors.',
  },
};
