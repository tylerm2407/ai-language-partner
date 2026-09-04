// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    rules: {
      // Straight apostrophes/quotes in UI copy are fine in React Native text.
      'react/no-unescaped-entities': 'off',
    },
  },
  {
    ignores: [
      'dist/**',
      'android/**',
      '.expo/**',
      'node_modules/**',
      // Deno code — different runtime/globals; linted by `deno lint` if desired
      'supabase/functions/**',
      'scripts/**',
      // Agent worktrees are full checkouts of this same repo, so linting them
      // double-counts every real file AND pulls in supabase/functions/** past
      // the ignore above, since that pattern is relative to the config root.
      // Left unignored this reported 171 errors in otherwise-clean source and
      // made `npm run lint` useless as a gate. jest.config.js already skips
      // this path for the same reason.
      '.claude/**',
    ],
  },
]);
