import { shouldArmSmokeTest, smokeTestLabel } from './sentry-smoke';

describe('shouldArmSmokeTest', () => {
  it('is inert in the production build, so a forgotten trigger cannot crash learners', () => {
    expect(shouldArmSmokeTest('production')).toBe(false);
  });

  it('arms in preview, the release-configuration build used to prove Sentry end to end', () => {
    expect(shouldArmSmokeTest('preview')).toBe(true);
  });

  it('arms when the env is unset, because such a build is by definition not production', () => {
    expect(shouldArmSmokeTest(undefined)).toBe(true);
    expect(shouldArmSmokeTest('development')).toBe(true);
  });
});

describe('smokeTestLabel', () => {
  it('shows version and build when both are known', () => {
    expect(smokeTestLabel('1.0.0', '3')).toBe('Fluenci v1.0.0 (3)');
  });

  it('drops the build suffix when the native build number is unavailable', () => {
    expect(smokeTestLabel('1.0.0', null)).toBe('Fluenci v1.0.0');
    expect(smokeTestLabel('1.0.0', '')).toBe('Fluenci v1.0.0');
  });

  it('never renders an empty version', () => {
    expect(smokeTestLabel(undefined, '3')).toBe('Fluenci vunknown (3)');
  });
});
