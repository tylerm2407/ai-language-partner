/** Frontend unit tests only — edge functions are Deno and run via `npm run test:functions`. */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  // '/.claude/' excludes agent worktrees: they are full checkouts of this same
  // repo, so without it every suite is counted twice and the totals lie.
  testPathIgnorePatterns: ['/node_modules/', '/supabase/', '/android/', '/dist/', '/.expo/', '/.claude/'],
  // react-native-webrtc's entry point THROWS at import time when
  // NativeModules.WebRTCModule is null, which it is in every jest run. Mapped
  // rather than jest.mock()'d because the throw happens at import, before any
  // test body could register a mock.
  moduleNameMapper: {
    '^react-native-webrtc$': '<rootDir>/__mocks__/react-native-webrtc.ts',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|nativewind|react-native-css-interop|react-native-worklets|zustand))',
  ],
};
