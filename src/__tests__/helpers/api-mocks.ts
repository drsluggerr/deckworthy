/**
 * Mock responses for external APIs
 */

export const mockSteamGameList = {
  applist: {
    apps: [
      { appid: 570, name: 'Dota 2' },
      { appid: 730, name: 'Counter-Strike 2' },
      { appid: 1938090, name: 'Call of Duty: Black Ops 6' },
    ],
  },
};

export const mockSteamGameDetails = {
  570: {
    success: true,
    data: {
      type: 'game',
      name: 'Dota 2',
      steam_appid: 570,
      is_free: true,
      short_description: 'Multiplayer MOBA game',
      header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/570/header.jpg',
      developers: ['Valve'],
      publishers: ['Valve'],
      genres: [{ description: 'Action' }, { description: 'Strategy' }],
      categories: [{ description: 'Multiplayer' }, { description: 'Free to Play' }],
      release_date: { date: 'Jul 9, 2013' },
      metacritic: { score: 90 },
    },
  },
  730: {
    success: true,
    data: {
      type: 'game',
      name: 'Counter-Strike 2',
      steam_appid: 730,
      is_free: true,
      short_description: 'Tactical FPS game',
      header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/730/header.jpg',
      developers: ['Valve'],
      publishers: ['Valve'],
      genres: [{ description: 'Action' }, { description: 'FPS' }],
      categories: [{ description: 'Multiplayer' }],
      release_date: { date: 'Sep 27, 2023' },
    },
  },
  1938090: {
    success: true,
    data: {
      type: 'game',
      name: 'Call of Duty®: Black Ops 6',
      steam_appid: 1938090,
      is_free: false,
      short_description: 'First-person shooter',
      header_image: 'https://cdn.akamai.steamstatic.com/steam/apps/1938090/header.jpg',
      developers: ['Treyarch', 'Raven Software'],
      publishers: ['Activision'],
      price_overview: {
        final: 6999,
        initial: 6999,
        discount_percent: 0,
      },
      genres: [{ description: 'Action' }],
      categories: [{ description: 'Single-player' }, { description: 'Multiplayer' }],
      release_date: { date: 'Oct 25, 2024' },
      metacritic: { score: 86 },
    },
  },
  invalid: {
    success: false,
  },
};

export const mockProtonDBResponse = {
  '570': {
    tier: 'platinum',
    confidence: 'high',
    score: 95,
    total: 5000,
  },
  '730': {
    tier: 'native',
    confidence: 'high',
    score: 100,
    total: 8000,
  },
  '1938090': {
    tier: 'gold',
    confidence: 'medium',
    score: 85,
    total: 1500,
  },
};

export const mockITADPricesResponse = {
  data: {
    '570': {
      list: [],
    },
    '730': {
      list: [],
    },
    '1938090': {
      list: [
        {
          shop: { id: 'steam', name: 'Steam' },
          price_new: 69.99,
          price_old: 69.99,
          price_cut: 0,
          url: 'https://store.steampowered.com/app/1938090',
        },
        {
          shop: { id: 'gog', name: 'GOG' },
          price_new: 59.99,
          price_old: 69.99,
          price_cut: 14,
          url: 'https://gog.com/game/cod_bo6',
        },
        {
          shop: { id: 'epic', name: 'Epic Games' },
          price_new: 64.99,
          price_old: 69.99,
          price_cut: 7,
          url: 'https://store.epicgames.com/cod',
        },
      ],
    },
  },
};

export const mockITADPlainIdsResponse = {
  data: {
    '570': 'dota2',
    '730': 'counterstrike2',
    '1938090': 'callofdutyblackops6',
  },
};

/**
 * Create a mock fetch function
 */
export function createMockFetch() {
  return jest.fn((url: string, options?: any) => {
    const urlString = url.toString();

    // Steam API - Game List
    if (urlString.includes('ISteamApps/GetAppList')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockSteamGameList),
      });
    }

    // Steam API - Game Details
    if (urlString.includes('api.steampowered.com/ISteamApps/GetAppDetails')) {
      const appidMatch = urlString.match(/appids=(\d+)/);
      if (appidMatch) {
        const appid = appidMatch[1];
        const response = mockSteamGameDetails[appid as keyof typeof mockSteamGameDetails];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve({ [appid]: response }),
        });
      }
    }

    // ProtonDB API
    if (urlString.includes('protondb.com/api')) {
      const appidMatch = urlString.match(/\/appid\/(\d+)/);
      if (appidMatch) {
        const appid = appidMatch[1];
        const response = mockProtonDBResponse[appid as keyof typeof mockProtonDBResponse];
        return Promise.resolve({
          ok: true,
          status: 200,
          json: () => Promise.resolve(response || { tier: 'pending' }),
        });
      }
    }

    // IsThereAnyDeal API - Prices
    if (urlString.includes('isthereanydeal.com') && urlString.includes('/prices')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockITADPricesResponse),
      });
    }

    // IsThereAnyDeal API - Plain IDs
    if (urlString.includes('isthereanydeal.com') && urlString.includes('/lookup')) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockITADPlainIdsResponse),
      });
    }

    // Default 404
    return Promise.resolve({
      ok: false,
      status: 404,
      json: () => Promise.resolve({ error: 'Not found' }),
    });
  });
}

/**
 * Mock HTTP client with rate limiting
 */
export function createMockHttpClient() {
  const mockFetch = createMockFetch();

  return {
    get: jest.fn((url: string) => mockFetch(url).then(r => r.json())),
    post: jest.fn((url: string, data: any) => mockFetch(url, { method: 'POST', body: JSON.stringify(data) }).then(r => r.json())),
  };
}
