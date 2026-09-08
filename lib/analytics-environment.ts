export interface PostHogEnvironmentInput {
  appEnvironment?: string;
  productionKey?: string;
  nonProductionKey?: string;
  productionHost?: string;
  nonProductionHost?: string;
}

export interface PostHogEnvironmentConfig {
  appEnvironment: 'production' | 'non-production';
  key: string;
  host: string;
}

/**
 * Select an analytics project without ever falling back across environments.
 * A production token in a development build is data corruption, not a useful
 * fallback: if the dedicated key is absent, analytics stays disabled.
 */
export function resolvePostHogEnvironment(
  input: PostHogEnvironmentInput,
): PostHogEnvironmentConfig | null {
  const isProduction = input.appEnvironment?.trim().toLowerCase() === 'production';
  const key = (isProduction ? input.productionKey : input.nonProductionKey)?.trim();
  if (!key) return null;

  return {
    appEnvironment: isProduction ? 'production' : 'non-production',
    key,
    host: (
      isProduction ? input.productionHost : input.nonProductionHost
    )?.trim() || 'https://us.i.posthog.com',
  };
}
