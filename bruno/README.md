# Deckworthy API - Bruno Collection

This directory contains a [Bruno](https://www.usebruno.com/) API collection for testing the Deckworthy API.

## What is Bruno?

Bruno is an open-source API client similar to Postman or Insomnia, but with a Git-friendly approach - collections are stored as plain text files that work great with version control.

## Getting Started

1. **Install Bruno**: Download from [usebruno.com](https://www.usebruno.com/)
2. **Open Collection**: In Bruno, click "Open Collection" and select this `bruno/` directory
3. **Select Environment**: Choose the "Local" environment from the dropdown
4. **Start the Server**: Make sure the Deckworthy server is running (`npm run dev`)
5. **Send Requests**: Click on any request and hit "Send"

## Collection Structure

### Environments

- **Local**: `http://localhost:3000` (default development environment)

### Request Categories

#### Health
- **Health Check** - Verify the server is running

#### Games
- **Get All Games** - List all games with filtering, sorting, and pagination
- **Get Game by ID** - Get detailed information for a specific game
- **Get Price History** - View price history for a game across different stores

#### Deals
- **Get Best Deals** - Find the best current deals (by discount %)
- **Get Active Sales** - List all games currently on sale
- **Get Active Bundles** - View all active Humble Bundles
- **Get Bundle by ID** - Get details for a specific bundle

#### Stats
- **Get Statistics** - Overall platform statistics including ProtonDB distribution, price ranges, etc.

## Example Usage

### Filter Games by ProtonDB Tier
```
GET /api/games?proton_tier=platinum,gold&limit=10
```

### Search for Games
```
GET /api/games?search=counter&limit=5
```

### Find Cheap Games on Sale
```
GET /api/games?max_price=10&on_sale=true
```

### Get Best Deals (50%+ off)
```
GET /api/deals/best?min_discount=50&limit=20
```

## Tips

- Requests with `~` prefix in query parameters are disabled by default - toggle them on as needed
- The collection automatically uses the `{{apiUrl}}` and `{{baseUrl}}` variables from the environment
- Modify the example IDs in requests (like game ID `10`) to test with different data

## Related

See `../tools/` for utility scripts including server cleanup tools.
