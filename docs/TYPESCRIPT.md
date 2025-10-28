# TypeScript Guide

Deckworthy is now built with TypeScript, providing type safety and better developer experience.

## Benefits of TypeScript

- **Type Safety**: Catch errors at compile time instead of runtime
- **Better IDE Support**: Autocomplete, refactoring, and inline documentation
- **Self-Documenting**: Types serve as inline documentation
- **Easier Refactoring**: Confidence when making changes
- **Modern Features**: Latest ES features with backward compatibility

## Project Structure

```
src/
├── types/
│   ├── index.ts         # Main type exports
│   └── models.ts        # Data model types
├── db/
│   ├── connection.ts    # Database connection
│   ├── init.ts          # Schema initialization
│   └── repositories/    # Type-safe database access
├── services/            # External API services (typed)
├── api/                 # Express routes with types
├── jobs/                # Sync job scripts
└── index.ts             # Main server
```

## Key Type Definitions

### Game Types

```typescript
import type { Game, GameInsert, GameWithRating } from './types/index.js';

// Full game from database
const game: Game = {
  steam_app_id: 123456,
  name: "Portal 2",
  // ... other fields
};

// Insert new game (fewer required fields)
const newGame: GameInsert = {
  steam_app_id: 123456,
  name: "Portal 2"
};

// Game with ProtonDB rating
const gameWithRating: GameWithRating = {
  ...game,
  proton_tier: 'platinum',
  proton_score: 95
};
```

### ProtonDB Types

```typescript
import type { ProtonTier, ProtonDBRating } from './types/index.js';

// Type-safe ProtonDB tiers
const tier: ProtonTier = 'platinum'; // Only allows valid tiers

// Full rating
const rating: ProtonDBRating = {
  steam_app_id: 123456,
  tier: 'platinum',
  score: 95,
  total_reports: 1000
};
```

### API Response Types

```typescript
import type { PaginatedGamesResponse, StatsResponse } from './types/index.js';

// Type-safe API responses
const response: PaginatedGamesResponse = {
  games: [...],
  total: 100,
  page: 1,
  limit: 50,
  totalPages: 2
};
```

## Development Workflow

### Running in Development

```bash
# TypeScript is compiled and executed on-the-fly with tsx
npm run dev
```

This uses `tsx watch` which:
- Compiles TypeScript automatically
- Watches for file changes
- Restarts server on changes
- No manual build step needed

### Type Checking

```bash
# Check types without emitting files
npm run type-check
```

Run this before committing to catch type errors.

### Building for Production

```bash
# Compile TypeScript to JavaScript
npm run build

# This creates the dist/ folder with compiled .js files
```

### Running Production Build

```bash
npm start
```

This runs the compiled JavaScript from `dist/`.

## Writing Type-Safe Code

### Repository Methods

All repository methods are fully typed:

```typescript
import gamesRepo from './db/repositories/games.js';

// Return type is inferred
const game = gamesRepo.getGameById(123456); // GameDetailResponse | null

// Parameters are type-checked
gamesRepo.upsertGame({
  steam_app_id: 123456,
  name: "Portal 2"
  // TypeScript ensures all required fields are present
});
```

### API Routes

Express routes with proper typing:

```typescript
import { Request, Response } from 'express';

router.get('/:id', (req: Request, res: Response): void => {
  const id = parseInt(req.params.id);
  const game = gamesRepo.getGameById(id);

  if (!game) {
    res.status(404).json({ error: 'Not found' });
    return; // TypeScript knows execution stops here
  }

  res.json(game); // Type-safe response
});
```

### Service Methods

Services return typed promises:

```typescript
import steamService from './services/steam.js';

// Return type is Promise<SyncResult>
const result = await steamService.syncPopularGames({ limit: 100 });

console.log(result.success); // TypeScript knows this exists
console.log(result.invalid); // TypeScript error: property doesn't exist
```

## Common Patterns

### Nullable Types

```typescript
// Explicitly nullable
const price: number | null = game.min_price;

// Optional with undefined
const description: string | undefined = game.short_description;

// Both (from queries)
const store: string | null | undefined = req.query.store;
```

### Array Types

```typescript
// Array of specific type
const steamAppIds: number[] = [123, 456, 789];

// Generic array type (equivalent)
const games: Array<Game> = [...];
```

### Promise Types

```typescript
// Explicit promise return type
async function fetchData(): Promise<Game[]> {
  const data = await api.get('/games');
  return data.games;
}

// Type inference works too
async function getData() {
  return await fetchData(); // TypeScript infers Promise<Game[]>
}
```

### Type Assertions (Use Sparingly)

```typescript
// When you know more than TypeScript
const result = db.prepare('SELECT COUNT(*) as count FROM games').get();
const count = (result as { count: number }).count;

// Better: Define the type
interface CountResult {
  count: number;
}
const result = db.prepare('...').get() as CountResult;
```

## Extending Types

### Adding New Fields

Update `src/types/models.ts`:

```typescript
export interface Game {
  steam_app_id: number;
  name: string;
  // ... existing fields
  metacritic_score?: number; // New optional field
}
```

### Creating New Types

```typescript
// In src/types/models.ts or create new file
export interface UserPreferences {
  favorite_genres: string[];
  max_price: number;
  min_proton_tier: ProtonTier;
}

// Use in your code
import type { UserPreferences } from '../types/index.js';
```

## Troubleshooting

### "Cannot find module" errors

Make sure to use `.js` extensions in imports (even for .ts files):

```typescript
// ✅ Correct
import gamesRepo from './db/repositories/games.js';

// ❌ Wrong
import gamesRepo from './db/repositories/games';
import gamesRepo from './db/repositories/games.ts';
```

This is required for ES modules.

### Type errors in better-sqlite3

If you see type errors with database methods, make sure `@types/better-sqlite3` is installed:

```bash
npm install -D @types/better-sqlite3
```

### "noUncheckedIndexedAccess" warnings

This strict setting helps catch potential undefined values:

```typescript
const items = [1, 2, 3];
const item = items[0]; // Type is number | undefined

// Handle it:
if (item !== undefined) {
  console.log(item); // Now type is number
}

// Or use optional chaining
console.log(items[0]?.toString());
```

## IDE Setup

### VS Code (Recommended)

Install extensions:
- **ESLint** (for code quality)
- **Prettier** (for formatting)
- **TypeScript Importer** (auto-imports)

### Settings

Add to `.vscode/settings.json`:

```json
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "editor.codeActionsOnSave": {
    "source.organizeImports": true
  }
}
```

## Best Practices

1. **Enable Strict Mode**: Already enabled in `tsconfig.json`
2. **Avoid `any`**: Use specific types or `unknown`
3. **Use Type Inference**: Let TypeScript infer when obvious
4. **Export Types**: Make types reusable across files
5. **Document Complex Types**: Add JSDoc comments

```typescript
/**
 * Syncs games from Steam API
 * @param options - Sync configuration
 * @returns Summary of sync operation
 */
export async function syncGames(
  options: SyncOptions
): Promise<SyncResult> {
  // ...
}
```

## Migration Notes

This codebase was converted from JavaScript to TypeScript. All the following have been migrated:

- ✅ Database layer (repositories)
- ✅ Services (Steam, ProtonDB, ITAD)
- ✅ API routes (Express)
- ✅ Job scripts
- ✅ Main server
- ✅ Utilities

If you find JavaScript files in `src/`, they should be deleted. The TypeScript files are the source of truth.

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html)
- [TypeScript Deep Dive](https://basarat.gitbook.io/typescript/)
- [Express with TypeScript](https://www.typescriptlang.org/docs/handbook/declaration-files/templates/module-d-ts.html)
