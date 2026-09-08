'use strict';

const PRODUCTION_SUPABASE_URL = 'https://ngqpsuixmumdnqbqxjxv.supabase.co';
const EXPECTED_ENVIRONMENT = {
  development: 'development',
  preview: 'preview',
  production: 'production',
};

function validateBuildEnvironment(env) {
  const errors = [];
  const profile = env.EAS_BUILD_PROFILE;
  const appEnvironment = env.EXPO_PUBLIC_APP_ENV;
  const supabaseUrl = env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseKey = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

  if (!profile || !EXPECTED_ENVIRONMENT[profile]) {
    errors.push(`unsupported or missing EAS_BUILD_PROFILE: ${profile || '<missing>'}`);
    return errors;
  }
  if (appEnvironment !== EXPECTED_ENVIRONMENT[profile]) {
    errors.push(
      `profile ${profile} requires EXPO_PUBLIC_APP_ENV=${EXPECTED_ENVIRONMENT[profile]}`,
    );
  }
  if (!supabaseUrl) errors.push('EXPO_PUBLIC_SUPABASE_URL is required');
  if (!supabaseKey) errors.push('EXPO_PUBLIC_SUPABASE_ANON_KEY is required');

  if (profile === 'production') {
    if (supabaseUrl && supabaseUrl !== PRODUCTION_SUPABASE_URL) {
      errors.push('production profile does not target the approved production Supabase project');
    }
  } else if (supabaseUrl === PRODUCTION_SUPABASE_URL) {
    errors.push(
      `${profile} profile must use an isolated Supabase project, never the production project`,
    );
  }

  if (
    profile === 'production' &&
    env.EAS_BUILD_PLATFORM === 'android' &&
    (!env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.startsWith('goog_') ||
      env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY.includes('REPLACE_WITH'))
  ) {
    errors.push('production Android build requires a real goog_ RevenueCat public key');
  }
  if (
    profile === 'production' &&
    env.EAS_BUILD_PLATFORM === 'ios' &&
    (!env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.startsWith('appl_') ||
      env.EXPO_PUBLIC_REVENUECAT_IOS_KEY.includes('REPLACE_WITH'))
  ) {
    errors.push('production iOS build requires a real appl_ RevenueCat public key');
  }

  return errors;
}

if (require.main === module) {
  const errors = validateBuildEnvironment(process.env);
  if (errors.length > 0) {
    console.error('[build-environment] Refusing unsafe build:');
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log('[build-environment] profile isolation verified');
  }
}

module.exports = { PRODUCTION_SUPABASE_URL, validateBuildEnvironment };
