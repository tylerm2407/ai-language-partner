'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PRODUCTION_SUPABASE_URL,
  validateBuildEnvironment,
} = require('./validate-build-environment.cjs');

const BASE = {
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_test',
  EXPO_PUBLIC_REVENUECAT_IOS_KEY: 'appl_test',
  EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_test',
};

test('production accepts only the approved production database', () => {
  assert.deepEqual(validateBuildEnvironment({
    ...BASE,
    EAS_BUILD_PROFILE: 'production',
    EAS_BUILD_PLATFORM: 'ios',
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
  }), []);
});

test('preview and development reject the production database', () => {
  for (const profile of ['preview', 'development']) {
    const errors = validateBuildEnvironment({
      ...BASE,
      EAS_BUILD_PROFILE: profile,
      EXPO_PUBLIC_APP_ENV: profile,
      EXPO_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
    });
    assert.ok(errors.some((error) => error.includes('isolated Supabase project')));
  }
});

test('preview accepts a separately configured project', () => {
  assert.deepEqual(validateBuildEnvironment({
    ...BASE,
    EAS_BUILD_PROFILE: 'preview',
    EXPO_PUBLIC_APP_ENV: 'preview',
    EXPO_PUBLIC_SUPABASE_URL: 'https://fluenci-staging.supabase.co',
  }), []);
});

test('missing credentials and mismatched profile labels fail closed', () => {
  const errors = validateBuildEnvironment({
    EAS_BUILD_PROFILE: 'development',
    EXPO_PUBLIC_APP_ENV: 'preview',
  });
  assert.ok(errors.some((error) => error.includes('requires EXPO_PUBLIC_APP_ENV=development')));
  assert.ok(errors.some((error) => error.includes('SUPABASE_URL is required')));
  assert.ok(errors.some((error) => error.includes('ANON_KEY is required')));
});

test('store builds require platform-correct RevenueCat keys', () => {
  const errors = validateBuildEnvironment({
    ...BASE,
    EAS_BUILD_PROFILE: 'production',
    EAS_BUILD_PLATFORM: 'android',
    EXPO_PUBLIC_APP_ENV: 'production',
    EXPO_PUBLIC_SUPABASE_URL: PRODUCTION_SUPABASE_URL,
    EXPO_PUBLIC_REVENUECAT_ANDROID_KEY: 'goog_REPLACE_WITH_KEY',
  });
  // Prefix alone is not enough; the runtime validator rejects placeholders,
  // and build validation must be at least as strict.
  assert.ok(errors.some((error) => error.includes('RevenueCat')));
});
