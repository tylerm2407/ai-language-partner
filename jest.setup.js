// Monitoring SDKs own background timers and native integrations. Unit tests
// assert our calls into Sentry, not Sentry's implementation, so keep the SDK
// behind a deterministic boundary for every Jest worker.
const { jest: jestRuntime } = require('@jest/globals');

jestRuntime.mock('@sentry/react-native', () => ({
  captureException: jestRuntime.fn(),
  captureMessage: jestRuntime.fn(),
  init: jestRuntime.fn(),
  nativeCrash: jestRuntime.fn(),
  setUser: jestRuntime.fn(),
  wrap: (component) => component,
}));
