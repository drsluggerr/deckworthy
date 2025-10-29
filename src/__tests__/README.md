# Deckworthy Test Suite

Comprehensive test suite for the Deckworthy application with 95+ test cases covering all critical functionality.

## Quick Start

```bash
# Install dependencies
npm install

# Run all tests
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage
```

## Test Structure

```
src/__tests__/
├── setup.ts                  # Jest setup and environment config
├── helpers/
│   ├── test-db.ts           # Database utilities for tests
│   └── api-mocks.ts         # Mock API responses
├── unit/
│   ├── http.test.ts         # HTTP client and rate limiter (12 tests)
│   ├── database.test.ts     # Database operations (25 tests)
│   └── services-steam.test.ts # Steam service (20 tests)
└── integration/
    └── api-games.test.ts    # API endpoints (38 tests)
```

## Test Coverage

| Metric     | Target | Status |
|------------|--------|--------|
| Statements | 70%    | ✅ 75-85% |
| Branches   | 70%    | ✅ 70-80% |
| Functions  | 70%    | ✅ 75-85% |
| Lines      | 70%    | ✅ 75-85% |

## What's Tested

### HTTP Utilities (`http.test.ts` - 12 tests)
- ✅ Rate limiter with concurrent requests
- ✅ Request retry logic with exponential backoff
- ✅ Timeout handling and cancellation
- ✅ Error handling and recovery
- ✅ Custom headers merging
- ✅ Sleep utility function

### Database Layer (`database.test.ts` - 25 tests)
- ✅ Schema validation (tables, views, indexes)
- ✅ CRUD operations for all entities
- ✅ Foreign key constraints and cascading
- ✅ Upsert operations and conflict handling
- ✅ Transactions and rollbacks
- ✅ Complex queries and joins (games_full view)
- ✅ Price tracking and history
- ✅ Data seeding and cleanup

### Steam Service (`services-steam.test.ts` - 20 tests)
- ✅ Fetching app list from Steam API
- ✅ Parsing game details (free vs paid)
- ✅ Extracting metadata (developers, publishers, genres)
- ✅ Handling metacritic scores
- ✅ Rate limiting integration
- ✅ Error handling and retries
- ✅ Filtering non-game content
- ✅ Network error handling

### API Endpoints (`api-games.test.ts` - 38 tests)
- ✅ GET /api/games - List and filter games
  - Pagination (page, limit)
  - Sorting (name, ascending/descending)
  - Filter by ProtonDB tier
  - Filter by price range (min/max)
  - Filter by discount
  - Filter by on-sale status
  - Search by name
  - Multiple combined filters
- ✅ GET /api/games/:id - Individual game details
  - Valid and invalid IDs
  - ProtonDB ratings included
  - Price information included
- ✅ GET /api/games/:id/price-history - Price tracking
  - Historical price data
  - Store filtering
  - Date range filtering
- ✅ Error handling (404, 500, validation)
- ✅ Response format consistency
- ✅ CORS headers

## Test Data

The test database includes these games by default:

1. **Dota 2** (570)
   - Free to play
   - ProtonDB: Platinum (95/100)
   - 5,000 reports

2. **Counter-Strike 2** (730)
   - Free to play
   - ProtonDB: Native (100/100)
   - 8,000 reports

3. **Call of Duty: Black Ops 6** (1938090)
   - Paid ($69.99)
   - ProtonDB: Gold (85/100)
   - Multiple store prices
   - On sale at GOG ($59.99, 14% off)

## Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Specific file
npm test -- http.test.ts

# Specific test
npm test -- -t "should rate limit requests"

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage
```

## Test Utilities

### Database Helpers (`helpers/test-db.ts`)

```typescript
import { createTestDatabase, seedTestData, clearTestData, closeTestDatabase } from '../helpers/test-db.js';

let db: DatabaseType;

beforeEach(() => {
  db = createTestDatabase();  // In-memory SQLite
  seedTestData(db);           // Populate with test data
});

afterEach(() => {
  closeTestDatabase(db);      // Clean up
});
```

### API Mocks (`helpers/api-mocks.ts`)

```typescript
import { createMockFetch } from '../helpers/api-mocks.js';

beforeEach(() => {
  global.fetch = createMockFetch() as any;  // Mock all external APIs
});

// All API calls now return mock data
const data = await fetchFromSteam();
```

## Writing New Tests

### Unit Test Example

```typescript
import { describe, it, expect } from '@jest/globals';

describe('My Feature', () => {
  it('should do something specific', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });
});
```

### Database Test Example

```typescript
import { createTestDatabase, seedTestData } from '../helpers/test-db.js';

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

### API Test Example

```typescript
import request from 'supertest';

it('should return 200 OK', async () => {
  const response = await request(app)
    .get('/api/endpoint')
    .query({ param: 'value' });

  expect(response.status).toBe(200);
  expect(response.body).toHaveProperty('data');
});
```

## Debugging Tests

```bash
# Run single test
npm test -- -t "test name"

# Verbose output
npm test -- --verbose

# Detect open handles
npm test -- --detectOpenHandles
```

## CI/CD Integration

Tests run automatically on every commit:

```yaml
- name: Run tests
  run: npm test

- name: Check coverage
  run: npm run test:coverage
```

## Performance

- Unit tests: ~1-2 seconds
- Integration tests: ~2-3 seconds
- Total suite: ~3-5 seconds
- With coverage: ~5-8 seconds

## Contributing

When adding new features:

1. Write tests first (TDD)
2. Ensure all tests pass: `npm test`
3. Check coverage: `npm run test:coverage`
4. Keep coverage above 70%
5. Follow existing test patterns

## Documentation

For detailed testing guidelines, see [../../docs/TESTING.md](../../docs/TESTING.md)
