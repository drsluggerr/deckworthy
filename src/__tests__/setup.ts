/**
 * Jest setup file - runs before each test suite
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.DATABASE_PATH = ':memory:'; // Use in-memory database for tests
process.env.STEAM_API_KEY = 'test-steam-key';
process.env.ITAD_API_KEY = 'test-itad-key';
process.env.PORT = '0'; // Random port for test server

// Increase timeout for integration tests
jest.setTimeout(10000);

// Silence console logs during tests (optional - uncomment to enable)
// global.console = {
//   ...console,
//   log: jest.fn(),
//   debug: jest.fn(),
//   info: jest.fn(),
//   warn: jest.fn(),
// };
