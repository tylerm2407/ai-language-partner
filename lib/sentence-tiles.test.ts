import { sentenceTileJoiner, restoreUnspacedTiles } from './sentence-tiles';
import { restorePlacedTiles } from './exercise-restore';

test('only an explicitly authored empty joiner changes the existing spacing contract', () => {
  expect(sentenceTileJoiner()).toBe(' ');
  expect(sentenceTileJoiner({})).toBe(' ');
  expect(sentenceTileJoiner({ tile_joiner: '' })).toBe('');
  expect(sentenceTileJoiner({ tile_joiner: '-' })).toBe(' ');
  expect(sentenceTileJoiner({ tile_joiner: null })).toBe(' ');
});

test('Chinese phrase tiles restore and reassemble without inserted word spaces', () => {
  const tiles = ['学习', '。', '我', '中文'];
  const placed = restorePlacedTiles(tiles, '我学习中文。', '');
  expect(placed).toEqual([2, 0, 3, 1]);
  expect(placed.map(i => tiles[i]).join('')).toBe('我学习中文。');
});

test('Japanese particles and repeated tiles are consumed once per actual tile', () => {
  const tiles = ['の', '友達', '私', '本', 'の', 'です。'];
  const placed = restoreUnspacedTiles(tiles, '私の友達の本です。');
  expect(placed).toEqual([2, 0, 1, 4, 3, 5]);
  expect(new Set(placed).size).toBe(placed.length);
});

test('overlapping chunks backtrack instead of losing a valid saved answer', () => {
  const tiles = ['a', 'ab', 'bc'];
  expect(restoreUnspacedTiles(tiles, 'abc')).toEqual([0, 2]);
});

test('missing or extra text never restores a misleading partial answer', () => {
  expect(restoreUnspacedTiles(['我', '学习'], '我学习中文')).toEqual([]);
  expect(restoreUnspacedTiles(['我', '学习'], '我我学习')).toEqual([]);
  expect(restoreUnspacedTiles(['', '我'], '你')).toEqual([]);
  expect(restoreUnspacedTiles(['我'], '')).toEqual([]);
  expect(restorePlacedTiles(['我'], null, '')).toEqual([]);
});
