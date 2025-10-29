# Testing Guide

Comprehensive testing strategy for Deckworthy using Jest.

## Test Structure

```
src/__tests__/
├── setup.ts                    # Jest setup and environment config
├── helpers/
│   ├── test-db.ts             # Database utilities for tests
│   └── api-mocks.ts           # Mock API responses
├── unit/
│   ├── http.test.ts           # HTTP client and rate limiter tests
│   ├── database.test.ts       # Database operations tests
│   └── services-steam.test.ts # Steam service tests
└── integration/
    └── api-games.test.ts      # API endpoint integration tests
```

## Running Tests

### All Tests

```bash
npm test
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

### Specific Test Suites

```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Specific file
npm test -- http.test.ts

# Specific test
npm test -- -t "should rate limit requests"
```

## Test Categories

### Unit Tests

Test individual components in isolation with mocked dependencies.

**HTTP Utilities (`http.test.ts`)**
- Rate limiter functionality
- Request retry logic
- Exponential backoff
- Timeout handling
- Error handling

**Database Layer (`database.test.ts`)**
- Schema creation and validation
- CRUD operations
- Foreign key relationships
- Transactions and rollbacks
- Database views and indexes
- Data integrity constraints

**Services (`services-steam.test.ts`)**
- Steam API integration
- ProtonDB API integration
- IsThereAnyDeal API integration
- API response parsing
- Error handling and retries
- Rate limiting

### Integration Tests

Test complete workflows with actual database operations.

**API Endpoints (`api-games.test.ts`)**
- GET /api/games - List and filter games
- GET /api/games/:id - Get game details
- GET /api/games/:id/price-history - Price history
- Pagination
- Sorting
- Filtering (by price, discount, ProtonDB tier)
- Search functionality
- Error handling

## Writing Tests

### Basic Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';

describe('Component Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  afterEach(() => {
    // Cleanup after each test
  });

  it('should do something specific', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = functionUnderTest(input);

    // Assert
    expect(result).toBe('expected');
  });
});
```

### Using Test Database

```typescript
import {
  createTestDatabase,
  seedTestData,
  clearTestData,
  closeTestDatabase,
} from '../helpers/test-db.js';

let db: DatabaseType;

beforeEach(() => {
  db = createTestDatabase();
  seedTestData(db); // Optional: load test data
});

afterEach(() => {
  closeTestDatabase(db);
});

it('should query database', () => {
  const result = db.prepare('SELECT * FROM games').all();
  expect(result.length).toBeGreaterThan(0);
});
```

### Mocking External APIs

```typescript
import { createMockFetch } from '../helpers/api-mocks.js';

let mockFetch: jest.Mock;

beforeEach(() => {
  mockFetch = createMockFetch();
  global.fetch = mockFetch as any;
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it('should fetch data from API', async () => {
  const data = await fetchFromAPI();
  expect(mockFetch).toHaveBeenCalled();
  expect(data).toBeDefined();
});
```

### Testing API Routes

```typescript
import request from 'supertest';
import express from 'express';

const app = express();
app.use('/api/games', gamesRouter);

it('should return games list', async () => {
  const response = await request(app)
    .get('/api/games')
    .query({ page: 1, limit: 10 });

  expect(response.status).toBe(200);
  expect(response.body.games).toBeDefined();
});
```

## Test Coverage

Current coverage targets:

- **Branches:** 70%
- **Functions:** 70%
- **Lines:** 70%
- **Statements:** 70%

View detailed coverage:

```bash
npm run test:coverage
open coverage/index.html
```

## Best Practices

### 1. Test Naming

Use descriptive test names that explain what is being tested:

```typescript
// Good
it('should return 404 when game does not exist', () => {});

// Bad
it('test game endpoint', () => {});
```

### 2. Arrange-Act-Assert Pattern

```typescript
it('should calculate total price', () => {
  // Arrange
  const items = [{ price: 10 }, { price: 20 }];

  // Act
  const total = calculateTotal(items);

  // Assert
  expect(total).toBe(30);
});
```

### 3. Test One Thing

Each test should verify one specific behavior:

```typescript
// Good - separate tests
it('should validate required fields', () => {});
it('should sanitize user input', () => {});

// Bad - testing multiple things
it('should validate and sanitize input', () => {});
```

### 4. Use Meaningful Assertions

```typescript
// Good
expect(result).toBe(42);
expect(array).toHaveLength(3);
expect(obj).toMatchObject({ id: 1, name: 'Test' });

// Bad
expect(result).toBeTruthy(); // Too vague
```

### 5. Clean Up Resources

Always clean up after tests:

```typescript
afterEach(() => {
  closeTestDatabase(db);
  jest.restoreAllMocks();
  jest.clearAllTimers();
});
```

### 6. Avoid Test Interdependence

Tests should not depend on each other:

```typescript
// Good - each test is independent
beforeEach(() => {
  db = createTestDatabase();
  seedTestData(db);
});

// Bad - tests depend on order
let sharedData;
it('test 1', () => { sharedData = createData(); });
it('test 2', () => { useData(sharedData); }); // Fails if test 1 doesn't run
```

### 7. Mock External Dependencies

```typescript
// Mock file system
jest.mock('fs', () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}));

// Mock HTTP requests
global.fetch = jest.fn();

// Mock database
jest.mock('../db/connection.js', () => ({
  default: () => mockDb,
}));
```

### 8. Test Edge Cases

```typescript
describe('division', () => {
  it('should divide positive numbers', () => {});
  it('should divide negative numbers', () => {});
  it('should handle zero dividend', () => {});
  it('should throw on zero divisor', () => {});
  it('should handle very large numbers', () => {});
});
```

## Common Test Patterns

### Testing Async Code

```typescript
it('should fetch data asynchronously', async () => {
  const data = await fetchData();
  expect(data).toBeDefined();
});

it('should reject on error', async () => {
  await expect(failingFunction()).rejects.toThrow('Error message');
});
```

### Testing Timers

```typescript
beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

it('should delay execution', async () => {
  const promise = delayedFunction();
  jest.advanceTimersByTime(1000);
  await expect(promise).resolves.toBeDefined();
});
```

### Testing Error Handling

```typescript
it('should handle errors gracefully', async () => {
  mockFetch.mockRejectedValueOnce(new Error('Network error'));

  await expect(fetchData()).rejects.toThrow('Network error');
});

it('should return error response', async () => {
  const response = await request(app).get('/api/invalid');

  expect(response.status).toBe(404);
  expect(response.body).toHaveProperty('error');
});
```

### Testing with Snapshots

```typescript
it('should match expected structure', () => {
  const data = generateData();
  expect(data).toMatchSnapshot();
});
```

## Debugging Tests

### Run Single Test

```bash
npm test -- -t "test name"
```

### Enable Verbose Output

```bash
npm test -- --verbose
```

### See Console Logs

Remove console mock in `setup.ts` or use:

```typescript
console.log = jest.fn((msg) => {
  process.stdout.write(msg + '\n');
});
```

### Debug in VSCode

Add to `.vscode/launch.json`:

```json
{
  "type": "node",
  "request": "launch",
  "name": "Jest Debug",
  "program": "${workspaceFolder}/node_modules/.bin/jest",
  "args": ["--runInBand", "--no-cache"],
  "console": "integratedTerminal",
  "internalConsoleOptions": "neverOpen"
}
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
      - run: npm ci
      - run: npm test
      - run: npm run test:coverage
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Hang

- Check for open database connections
- Check for pending timers
- Use `--detectOpenHandles` flag

```bash
npm test -- --detectOpenHandles
```

### Flaky Tests

- Use fake timers for time-dependent code
- Avoid random data in tests
- Clean up resources properly
- Make tests deterministic

### Import Errors

- Check `.js` extensions in imports (required for ES modules)
- Verify jest.config.js module settings
- Check tsconfig.json paths

### Mock Not Working

```typescript
// Mock before importing
jest.mock('../module');
import { function } from '../module';

// Not after
import { function } from '../module';
jest.mock('../module'); // Too late!
```

## Additional Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://testingjavascript.com/)
- [Supertest Documentation](https://github.com/ladjs/supertest)
- [Better-sqlite3 Testing](https://github.com/WiseLibs/better-sqlite3/wiki/Testing)

## Contributing Tests

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass
3. Maintain coverage above 70%
4. Add integration tests for API changes
5. Update this documentation if needed

```bash
# Before committing
npm run test:coverage
npm run type-check
```
