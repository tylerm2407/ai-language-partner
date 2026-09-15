import { resolvePostHogEnvironment } from './analytics-environment';

describe('resolvePostHogEnvironment', () => {
  it('uses only the production key for an explicit production build', () => {
    expect(resolvePostHogEnvironment({
      appEnvironment: 'production',
      productionKey: 'prod-key',
      nonProductionKey: 'dev-key',
    })).toEqual({
      appEnvironment: 'production',
      key: 'prod-key',
      host: 'https://us.i.posthog.com',
    });
  });

  it('never leaks the production key into development or preview builds', () => {
    for (const appEnvironment of [undefined, 'development', 'preview', 'test']) {
      expect(resolvePostHogEnvironment({
        appEnvironment,
        productionKey: 'prod-key',
      })).toBeNull();
    }
  });

  it('uses an independently configured non-production project', () => {
    expect(resolvePostHogEnvironment({
      appEnvironment: 'preview',
      productionKey: 'prod-key',
      nonProductionKey: 'dev-key',
      nonProductionHost: 'https://eu.i.posthog.com',
    })).toEqual({
      appEnvironment: 'non-production',
      key: 'dev-key',
      host: 'https://eu.i.posthog.com',
    });
  });
});
