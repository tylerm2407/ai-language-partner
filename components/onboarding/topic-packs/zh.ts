/**
 * Mandarin topic packs (simplified characters). A1, five topics, each sentence
 * built from its words. Tiles are written out — Chinese has no word spacing.
 */
import type { LanguagePacks } from './spec';

export const ZH_PACKS: LanguagePacks = {
  travel: {
    words: [
      { target: '咖啡', gloss: 'coffee' },
      { target: '请', gloss: 'please' },
      { target: '买单', gloss: 'the bill' },
    ],
    sentence: { target: '请给我一杯咖啡。', gloss: 'A coffee, please.' },
    tiles: ['请', '给我', '一杯', '咖啡'],
    tileDistractors: ['买单', '水'],
    foil: { target: '车站', gloss: 'the station' },
    plan: [
      { title: 'Ordering a coffee', words: ['咖啡', '请', '谢谢'] },
      { title: 'Asking for the bill', words: ['买单', '多少钱', '刷卡'] },
      { title: 'Finding the station', words: ['车站', '地铁', '车票'] },
      { title: 'Checking into a hotel', words: ['酒店', '房间', '钥匙'] },
      { title: 'Asking the way', words: ['右边', '左边', '一直走'] },
      { title: 'Ordering a meal', words: ['菜单', '水', '一个人'] },
    ],
    solLine: 'Then we start where you will actually stand: at the counter, ordering.',
  },
  family: {
    words: [
      { target: '妈妈', gloss: 'mum' },
      { target: '哥哥', gloss: 'my older brother' },
      { target: '家', gloss: 'home' },
    ],
    sentence: { target: '妈妈在家。', gloss: 'Mum is at home.' },
    tiles: ['妈妈', '在', '家'],
    tileDistractors: ['哥哥', '学校'],
    foil: { target: '姐姐', gloss: 'my older sister' },
    plan: [
      { title: 'Naming your people', words: ['妈妈', '爸爸', '哥哥'] },
      { title: 'Saying where they are', words: ['在', '家', '这儿'] },
      { title: 'How old everyone is', words: ['多大', '岁', '今年'] },
      { title: 'At the family table', words: ['吃饭', '尝尝', '好吃'] },
      { title: 'Talking about your day', words: ['今天', '上班了', '休息了'] },
      { title: 'Making plans together', words: ['星期天', '一起', '去'] },
    ],
    solLine: 'Good — we will build the words you need at their table, not in a textbook.',
  },
  work: {
    words: [
      { target: '工作', gloss: 'work' },
      { target: '开会', gloss: 'to have a meeting' },
      { target: '明天', gloss: 'tomorrow' },
    ],
    sentence: { target: '明天我要开会。', gloss: 'Tomorrow I have a meeting.' },
    tiles: ['明天', '我', '要', '开会'],
    tileDistractors: ['工作', '今天'],
    foil: { target: '办公室', gloss: 'the office' },
    plan: [
      { title: 'Talking about your job', words: ['工作', '公司', '我是'] },
      { title: 'Arranging a meeting', words: ['开会', '明天', '十点'] },
      { title: 'In the office', words: ['办公室', '邮件', '报告'] },
      { title: 'Meeting a client', words: ['客户', '您好', '幸会'] },
      { title: 'Saying what you think', words: ['我觉得', '同意', '也许'] },
      { title: 'Wrapping up a call', words: ['回头见', '我发给您', '再联系'] },
    ],
    solLine: 'Right — we will aim at the meeting you have to sit through, not small talk.',
  },
  media_culture: {
    words: [
      { target: '电影', gloss: 'a film' },
      { target: '音乐', gloss: 'music' },
      { target: '喜欢', gloss: 'to like' },
    ],
    sentence: { target: '我喜欢这部电影。', gloss: 'I like this film.' },
    tiles: ['我', '喜欢', '这部', '电影'],
    tileDistractors: ['音乐', '很'],
    foil: { target: '书', gloss: 'a book' },
    plan: [
      { title: 'Saying what you like', words: ['喜欢', '很', '不喜欢'] },
      { title: 'Talking about films', words: ['电影', '演员', '结局'] },
      { title: 'Talking about music', words: ['音乐', '歌', '歌词'] },
      { title: 'What happened in it', words: ['一开始', '然后', '后来'] },
      { title: 'Recommending something', words: ['你要看', '你会喜欢', '太棒了'] },
      { title: 'Disagreeing politely', words: ['不一定', '对我来说', '我更喜欢'] },
    ],
    solLine: 'Then the subtitles come off sooner than you think. Start with one line.',
  },
  housing_admin: {
    words: [
      { target: '房子', gloss: 'a place to live' },
      { target: '房租', gloss: 'the rent' },
      { target: '市中心', gloss: 'the city centre' },
    ],
    sentence: { target: '我在市中心找房子。', gloss: 'I am looking for a place in the city centre.' },
    tiles: ['我', '在', '市中心', '找', '房子'],
    tileDistractors: ['房租', '学校'],
    foil: { target: '钥匙', gloss: 'the key' },
    plan: [
      { title: 'Looking for a place', words: ['房子', '找', '市中心'] },
      { title: 'Talking about rent', words: ['房租', '一个月', '押金'] },
      { title: 'Viewing the place', words: ['厨房', '卫生间', '亮'] },
      { title: 'At the local office', words: ['派出所', '预约', '材料'] },
      { title: 'Opening a bank account', words: ['银行', '卡', '签名'] },
      { title: 'Calling the doctor', words: ['医院', '不舒服', '挂号'] },
    ],
    solLine: 'Moving is mostly paperwork — so we will start with the words that open doors.',
  },
};
