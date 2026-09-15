import { unitTilesCacheKey } from './useUnitProgressTiles';

/**
 * The hook's module pulls in supabase-queries (and through it the Supabase
 * client), which needs a native AsyncStorage. Only the pure key builder is
 * under test, so the query module is stubbed out.
 */
jest.mock('../lib/supabase-queries', () => ({ fetchUnitProgressTiles: jest.fn() }));
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true,
  default: {
    setItem: jest.fn(async () => undefined),
    getItem: jest.fn(async () => null),
    removeItem: jest.fn(async () => undefined),
    multiRemove: jest.fn(async () => undefined),
    getAllKeys: jest.fn(async () => []),
    clear: jest.fn(async () => undefined),
  },
}));


describe('unitTilesCacheKey', () => {
  it('keys on the course, so a pill switch is a new entry rather than a stale one', () => {
    const a1 = unitTilesCacheKey('user-1', 'course-a1', 4);
    const b1 = unitTilesCacheKey('user-1', 'course-b1', 4);
    expect(a1).not.toBe(b1);
    expect(a1).toContain('course-a1');
  });

  it('keeps user, course and limit as separate segments', () => {
    const key = unitTilesCacheKey('user-1', 'course-a1', 8);
    expect(key).toContain('user-1');
    expect(key).toContain('course-a1');
    expect(key).toContain('8');
    // A 4-tile entry must not be served for an 8-tile request.
    expect(key).not.toBe(unitTilesCacheKey('user-1', 'course-a1', 4));
    // Defaults to the Home grid size.
    expect(unitTilesCacheKey('user-1', 'course-a1')).toBe(unitTilesCacheKey('user-1', 'course-a1', 4));
  });
});
