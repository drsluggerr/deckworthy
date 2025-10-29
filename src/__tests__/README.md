# Deckworthy Test Suite

Comprehensive test suite for the Deckworthy application.

## Overview

This test suite provides thorough testing of all critical components:

- **Unit Tests:** Test individual components in isolation
- **Integration Tests:** Test complete workflows with real database operations
- **Test Coverage:** Enforces 70%+ coverage across all metrics

## Quick Start

```bash
# Install dependencies (if not already installed)
npm install

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

### Helpers (`helpers/`)

**`test-db.ts`** - Database Testing Utilities
- `createTestDatabase()` - Creates in-memory SQLite database with full schema
- `seedTestData()` - Populates database with realistic test data
- `clearTestData()` - Cleans all data between tests
- `closeTestDatabase()` - Properly closes database connections

**`api-mocks.ts`** - External API Mocking
- Mock responses for Steam API
- Mock responses for ProtonDB API
- Mock responses for IsThereAnyDeal API
- `createMockFetch()` - Pre-configured fetch mock

### Unit Tests (`unit/`)

**`http.test.ts`** - HTTP Utilities (72 tests)
- Rate limiter functionality and concurrency
- Request retry logic with exponential backoff
- Timeout handling
- Error handling and recovery
- Sleep utility function

**`database.test.ts`** - Database Layer (45 tests)
- Schema validation (tables, views, indexes)
- CRUD operations for all entities
- Foreign key constraints and cascading
- Upsert operations
- Transactions and rollbacks
- Data integrity constraints
- Complex queries and views
- Price tracking and history

**`services-steam.test.ts`** - Steam Service (25 tests)
- Fetching app list from Steam
- Parsing game details
- Handling free vs paid games
- Extracting metadata (developers, publishers, genres)
- Rate limiting integration
- Error handling and retries
- Data type filtering
- Invalid response handling

### Integration Tests (`integration/`)

**`api-games.test.ts`** - Games API Endpoints (38 tests)
- **GET /api/games** - List games with filters
  - Pagination (page, limit)
  - Sorting (by name, price, rating)
  - Filtering (ProtonDB tier, price range, discount, sale status)
  - Search functionality
  - Multiple filter combinations
- **GET /api/games/:id** - Game details
  - Valid and invalid IDs
  - ProtonDB ratings included
  - Price information included
- **GET /api/games/:id/price-history** - Price history
  - Historical price data
  - Store filtering
  - Date range filtering
- Error handling and validation
- Response format consistency
- CORS header validation

## Test Coverage

Current coverage (enforced minimums):

| Metric     | Target | Typical |
|------------|--------|---------|
| Statements | 70%    | 75-85%  |
| Branches   | 70%    | 70-80%  |
| Functions  | 70%    | 75-85%  |
| Lines      | 70%    | 75-85%  |

View detailed coverage:
```bash
npm run test:coverage
# Opens coverage/index.html in browser
```

## What's Tested

### ✅ Fully Tested Components

- **HTTP Client & Rate Limiter**
  - Request/response handling
  - Rate limiting algorithms
  - Retry logic and backoff
  - Timeout and error handling
  - Concurrent request handling

- **Database Layer**
  - Schema creation and migrations
  - All CRUD operations
  - Relationships and constraints
  - Transactions
  - Complex queries and joins
  - Views and indexes

- **External API Integration**
  - Steam API calls and parsing
  - ProtonDB API integration
  - IsThereAnyDeal API v3
  - Error handling for all services
  - Rate limiting compliance

- **REST API Endpoints**
  - All /api/games/* endpoints
  - Query parameter validation
  - Pagination and sorting
  - Filtering and search
  - Error responses
  - Response format

### 🔄 Partially Tested

- Service layer (Steam only)
  - ProtonDB service tests can be added
  - ITAD service tests can be added

- Sync jobs
  - Basic structure tested
  - Full job execution needs more tests

### ❌ Not Tested (By Design)

- Frontend JavaScript (tested manually)
- Database initialization script (one-time setup)
- Scheduler configuration (cron syntax validation)
- Main server entry point (integration tested)

## Running Specific Tests

```bash
# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run specific file
npm test -- http.test.ts

# Run tests matching pattern
npm test -- -t "rate limiter"

# Run with coverage
npm run test:coverage

# Watch mode for TDD
npm run test:watch
```

## Writing New Tests

### 1. Unit Test Example

```typescript
// src/__tests__/unit/my-feature.test.ts
import { describe, it, expect } from '@jest/globals';
import { myFunction } from '../../utils/my-feature.js';

describe('My Feature', () => {
  it('should do something specific', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle errors', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

### 2. Database Test Example

```typescript
import { createTestDatabase, seedTestData } from '../helpers/test-db.js';
import type { Database as DatabaseType } from 'better-sqlite3';

let db: DatabaseType;

beforeEach(() => {
  db = createTestDatabase();
  seedTestData(db);
});

afterEach(() => {
  db.close();
});

it('should query data', () => {
  const games = db.prepare('SELECT * FROM games').all();
  expect(games.length).toBeGreaterThan(0);
});
```

### 3. API Test Example

```typescript
import request from 'supertest';
import app from '../../index.js';

it('should return 200 OK', async () => {
  const response = await request(app)
    .get('/api/endpoint')
    .query({ param: 'value' });

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('data');
});
```

## Test Data

### Seeded Games

The test database includes these games by default:

1. **Dota 2** (570)
   - Free to play
   - ProtonDB: Platinum
   - Rating: 95/100

2. **Counter-Strike 2** (730)
   - Free to play
   - ProtonDB: Native
   - Rating: 92/100

3. **Call of Duty: Black Ops 6** (1938090)
   - Paid ($69.99)
   - ProtonDB: Gold
   - Multiple store prices
   - On sale at GOG ($59.99, 14% off)

Use these IDs in your tests for consistent results.

## Mocking External APIs

All external API calls are mocked by default using `api-mocks.ts`:

```typescript
import { createMockFetch } from '../helpers/api-mocks.js';

beforeEach(() => {
  global.fetch = createMockFetch() as any;
});

// Now all API calls return mock data
const data = await fetchFromSteam();
```

## CI/CD Integration

Tests run automatically on:
- Every commit (if CI configured)
- Pull requests
- Pre-deployment

Example GitHub Actions:
```yaml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Debugging Tests

### Enable Verbose Output
```bash
npm test -- --verbose
```

### Run Single Test
```bash
npm test -- -t "specific test name"
```

### See Console Logs
Uncomment console mocks in `setup.ts`

### Debug in VSCode
Use the Jest Debug configuration in `.vscode/launch.json`

## Common Issues

### Tests Hang
- Check for unclosed database connections
- Look for pending timers
- Use `--detectOpenHandles`:
  ```bash
  npm test -- --detectOpenHandles
  ```

### Import Errors
- Ensure `.js` extensions in imports (required for ES modules)
- Check jest.config.js settings
- Verify tsconfig.json paths

### Flaky Tests
- Use fake timers for time-dependent code
- Avoid random data in tests
- Clean up resources properly

## Performance

Test execution time:
- Unit tests: ~1-2 seconds
- Integration tests: ~2-3 seconds
- Total suite: ~3-5 seconds
- With coverage: ~5-8 seconds

## Contributing

When adding new features:

1. Write tests first (TDD recommended)
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Keep coverage above 70%
5. Follow existing test patterns
6. Update this README if needed

## Documentation

For detailed testing guidelines, see [docs/TESTING.md](../../docs/TESTING.md)

## Maintenance

### Updating Test Data

Edit `helpers/test-db.ts`:
```typescript
export function seedTestData(db: DatabaseType): void {
  // Add your test data here
}
```

### Adding New Mocks

Edit `helpers/api-mocks.ts`:
```typescript
export const mockNewAPI = {
  // Your mock response
};
```

### Updating Coverage Thresholds

Edit `jest.config.js`:
```javascript
coverageThreshold: {
  global: {
    branches: 70,
    functions: 70,
    lines: 70,
    statements: 70,
  },
}
```

## Questions?

See [TESTING.md](../../docs/TESTING.md) for comprehensive testing guide.
