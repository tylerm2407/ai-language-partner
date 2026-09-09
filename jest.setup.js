// Monitoring SDKs own background timers and native integrations. Unit tests
// assert our calls into Sentry, not Sentry's implementation, so keep the SDK
// behind a deterministic boundary for every Jest worker.
jest.mock('@sentry/react-native', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  init: jest.fn(),
  nativeCrash: jest.fn(),
  setUser: jest.fn(),
  wrap: (component) => component,
}));
