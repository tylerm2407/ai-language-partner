/**
 * Japanese topic packs. A1, five topics, each sentence built from its words.
 *
 * Tiles are written out rather than split on spaces — Japanese has none. They
 * are cut at particle boundaries, which is where a beginner is being taught to
 * see the seams anyway.
 */
import type { LanguagePacks } from './spec';

export const JA_PACKS: LanguagePacks = {
  travel: {
    words: [
      { target: 'コーヒー', gloss: 'coffee' },
      { target: 'ください', gloss: 'please give me' },
      { target: 'お会計', gloss: 'the bill' },
    ],
    sentence: { target: 'コーヒーをください。', gloss: 'A coffee, please.' },
    tiles: ['コーヒー', 'を', 'ください'],
    tileDistractors: ['お会計', 'は'],
    foil: { target: '駅', gloss: 'the station' },
    plan: [
      { title: 'Ordering a coffee', words: ['コーヒー', 'ください', 'ありがとう'] },
      { title: 'Asking for the bill', words: ['お会計', 'いくら', 'カードで'] },
      { title: 'Finding the station', words: ['駅', '電車', 'きっぷ'] },
      { title: 'Checking into a hotel', words: ['ホテル', '部屋', 'かぎ'] },
      { title: 'Asking the way', words: ['右', '左', 'まっすぐ'] },
      { title: 'Ordering a meal', words: ['メニュー', 'お水', 'ひとり'] },
    ],
    solLine: 'Then we start where you will actually stand: at the counter, ordering.',
  },
  family: {
    words: [
      { target: '母', gloss: 'my mother' },
      { target: '兄', gloss: 'my older brother' },
      { target: '家', gloss: 'home' },
    ],
    sentence: { target: '母は家にいます。', gloss: 'My mother is at home.' },
    tiles: ['母', 'は', '家', 'に', 'います'],
    tileDistractors: ['兄', 'です'],
    foil: { target: '姉', gloss: 'my older sister' },
    plan: [
      { title: 'Naming your people', words: ['母', '父', '兄'] },
      { title: 'Saying where they are', words: ['家', 'います', 'ここ'] },
      { title: 'How old everyone is', words: ['何歳', '歳', 'です'] },
      { title: 'At the family table', words: ['ごはん', 'いただきます', 'おいしい'] },
      { title: 'Talking about your day', words: ['今日', '働きました', '休みました'] },
      { title: 'Making plans together', words: ['日曜日', '行きましょう', 'いっしょに'] },
    ],
    solLine: 'Good — we will build the words you need at their table, not in a textbook.',
  },
  work: {
    words: [
      { target: '仕事', gloss: 'work' },
      { target: '会議', gloss: 'a meeting' },
      { target: '明日', gloss: 'tomorrow' },
    ],
    sentence: { target: '明日は会議があります。', gloss: 'Tomorrow there is a meeting.' },
    tiles: ['明日', 'は', '会議', 'が', 'あります'],
    tileDistractors: ['仕事', '今日'],
    foil: { target: '会社', gloss: 'the company' },
    plan: [
      { title: 'Talking about your job', words: ['仕事', '会社', 'です'] },
      { title: 'Arranging a meeting', words: ['会議', '明日', '十時'] },
      { title: 'In the office', words: ['オフィス', 'メール', '資料'] },
      { title: 'Meeting a client', words: ['お客さま', 'はじめまして', 'よろしく'] },
      { title: 'Saying what you think', words: ['思います', 'そうですね', 'たぶん'] },
      { title: 'Wrapping up a call', words: ['失礼します', '送ります', 'また'] },
    ],
    solLine: 'Right — we will aim at the meeting you have to sit through, not small talk.',
  },
  media_culture: {
    words: [
      { target: '映画', gloss: 'a film' },
      { target: '音楽', gloss: 'music' },
      { target: '好きです', gloss: 'I like' },
    ],
    sentence: { target: 'この映画が好きです。', gloss: 'I like this film.' },
    tiles: ['この', '映画', 'が', '好きです'],
    tileDistractors: ['音楽', 'を'],
    foil: { target: '本', gloss: 'a book' },
    plan: [
      { title: 'Saying what you like', words: ['好きです', 'とても', '好きじゃない'] },
      { title: 'Talking about films', words: ['映画', '俳優', '最後'] },
      { title: 'Talking about music', words: ['音楽', '歌', '歌詞'] },
      { title: 'What happened in it', words: ['はじめ', 'それから', 'なりました'] },
      { title: 'Recommending something', words: ['見てください', 'おすすめ', 'すごい'] },
      { title: 'Disagreeing politely', words: ['ちょっと', 'わたしは', 'のほうが'] },
    ],
    solLine: 'Then the subtitles come off sooner than you think. Start with one line.',
  },
  housing_admin: {
    words: [
      { target: 'アパート', gloss: 'an apartment' },
      { target: '家賃', gloss: 'the rent' },
      { target: '駅の近く', gloss: 'near the station' },
    ],
    sentence: { target: '駅の近くのアパートを探しています。', gloss: 'I am looking for an apartment near the station.' },
    tiles: ['駅の近く', 'の', 'アパート', 'を', '探しています'],
    tileDistractors: ['家賃', 'は'],
    foil: { target: 'かぎ', gloss: 'the key' },
    plan: [
      { title: 'Looking for a flat', words: ['アパート', '探しています', '駅の近く'] },
      { title: 'Talking about rent', words: ['家賃', '毎月', '敷金'] },
      { title: 'Viewing the place', words: ['台所', 'おふろ', '明るい'] },
      { title: 'At the city office', words: ['市役所', '予約', '書類'] },
      { title: 'Opening a bank account', words: ['銀行', 'カード', '名前'] },
      { title: 'Calling the doctor', words: ['病院', 'いたいです', '予約'] },
    ],
    solLine: 'Moving is mostly paperwork — so we will start with the words that open doors.',
  },
};
