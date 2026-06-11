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
    ],
  },
]);
