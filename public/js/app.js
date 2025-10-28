// API base URL
const API_BASE = window.location.origin;

// State
let currentPage = 1;
let currentFilters = {};
let gridApi = null;
let stats = {};

// Initialize the app
document.addEventListener('DOMContentLoaded', () => {
  initializeGrid();
  loadStats();
  loadGames();
  setupEventListeners();
});

// Setup AG-Grid
function initializeGrid() {
  const gridOptions = {
    columnDefs: [
      {
        headerName: 'Game',
        field: 'name',
        flex: 2,
        cellRenderer: params => {
          const img = params.data.header_image_url
            ? `<img src="${params.data.header_image_url}" class="game-image mb-2" />`
            : '';
          return `
            <div>
              ${img}
              <a href="${params.data.steam_url}" target="_blank" class="grid-link font-semibold">
                ${params.data.name}
              </a>
            </div>
          `;
        },
        autoHeight: true
      },
      {
        headerName: 'Proton',
        field: 'proton_tier',
        width: 120,
        cellRenderer: params => {
          if (!params.value) return '<span class="text-gray-500">-</span>';
          return `<span class="proton-badge proton-${params.value}">${params.value}</span>`;
        }
      },
      {
        headerName: 'Price',
        field: 'min_price',
        width: 120,
        cellRenderer: params => {
          if (params.value === null || params.value === undefined) {
            return '<span class="text-gray-500">-</span>';
          }
          const isFree = params.value === 0;
          const isOnSale = params.data.active_sales > 0;
          const priceClass = isOnSale ? 'price-on-sale' : 'price-tag';

          if (isFree) {
            return '<span class="text-green-400 font-semibold">FREE</span>';
          }

          let html = `<span class="${priceClass}">$${params.value.toFixed(2)}</span>`;

          if (params.data.max_discount > 0) {
            html += `<span class="discount-badge">-${params.data.max_discount}%</span>`;
          }

          return html;
        },
        sortable: true,
        sort: 'asc'
      },
      {
        headerName: 'Sales',
        field: 'active_sales',
        width: 100,
        cellRenderer: params => {
          if (!params.value || params.value === 0) {
            return '<span class="text-gray-500">-</span>';
          }
          return `<span class="text-green-400 font-semibold">${params.value}</span>`;
        }
      },
      {
        headerName: 'Release',
        field: 'release_date',
        width: 120,
        valueFormatter: params => {
          if (!params.value) return '-';
          try {
            return new Date(params.value).toLocaleDateString();
          } catch {
            return params.value;
          }
        }
      },
      {
        headerName: '',
        field: 'steam_app_id',
        width: 100,
        cellRenderer: params => {
          return `
            <button
              class="px-3 py-1 bg-blue-600 hover:bg-blue-700 rounded text-sm"
              onclick="viewGameDetails(${params.value})"
            >
              Details
            </button>
          `;
        }
      }
    ],
    defaultColDef: {
      sortable: true,
      resizable: true,
      filter: false
    },
    rowHeight: 80,
    pagination: false,
    domLayout: 'normal',
    suppressRowHoverHighlight: false,
    suppressCellFocus: true,
    onGridReady: params => {
      gridApi = params.api;
    }
  };

  const gridDiv = document.querySelector('#gamesGrid');
  new agGrid.Grid(gridDiv, gridOptions);
}

// Load statistics
async function loadStats() {
  try {
    const response = await fetch(`${API_BASE}/api/stats`);
    const data = await response.json();
    stats = data;

    document.getElementById('stat-total-games').textContent = data.total_games.toLocaleString();
    document.getElementById('stat-active-sales').textContent = data.active_sales.toLocaleString();
    document.getElementById('stat-avg-discount').textContent = `${data.average_discount}%`;
    document.getElementById('stat-best-discount').textContent = `${data.best_discount}%`;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load games with current filters
async function loadGames() {
  showLoading(true);

  try {
    const params = new URLSearchParams({
      page: currentPage,
      limit: 50,
      sort_by: 'min_price',
      sort_order: 'asc',
      ...currentFilters
    });

    const response = await fetch(`${API_BASE}/api/games?${params}`);
    const data = await response.json();

    // Update grid
    if (gridApi) {
      gridApi.setRowData(data.games);
    }

    // Update pagination
    document.getElementById('currentPage').textContent = data.page;
    document.getElementById('totalPages').textContent = data.totalPages;
    document.getElementById('gameCount').textContent = data.total.toLocaleString();

    // Update button states
    document.getElementById('prevPage').disabled = data.page === 1;
    document.getElementById('nextPage').disabled = data.page >= data.totalPages;
  } catch (error) {
    console.error('Error loading games:', error);
    alert('Failed to load games. Please try again.');
  } finally {
    showLoading(false);
  }
}

// Setup event listeners
function setupEventListeners() {
  // Apply filters
  document.getElementById('applyFilters').addEventListener('click', () => {
    currentFilters = buildFilters();
    currentPage = 1;
    loadGames();
  });

  // Clear filters
  document.getElementById('clearFilters').addEventListener('click', () => {
    // Reset form
    document.getElementById('searchInput').value = '';
    document.getElementById('minPrice').value = '';
    document.getElementById('maxPrice').value = '';
    document.getElementById('minDiscount').value = '';
    document.getElementById('onSaleFilter').checked = false;
    document.querySelectorAll('.proton-filter').forEach(cb => cb.checked = false);

    // Reset filters and reload
    currentFilters = {};
    currentPage = 1;
    loadGames();
  });

  // Pagination
  document.getElementById('prevPage').addEventListener('click', () => {
    if (currentPage > 1) {
      currentPage--;
      loadGames();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  });

  document.getElementById('nextPage').addEventListener('click', () => {
    currentPage++;
    loadGames();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Refresh button
  document.getElementById('refreshBtn').addEventListener('click', () => {
    loadStats();
    loadGames();
  });

  // Enter key on search
  document.getElementById('searchInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('applyFilters').click();
    }
  });
}

// Build filters object from form
function buildFilters() {
  const filters = {};

  // Search
  const search = document.getElementById('searchInput').value.trim();
  if (search) filters.search = search;

  // ProtonDB tiers
  const selectedTiers = Array.from(document.querySelectorAll('.proton-filter:checked'))
    .map(cb => cb.value);
  if (selectedTiers.length > 0) {
    filters.proton_tier = selectedTiers.join(',');
  }

  // Price range
  const minPrice = document.getElementById('minPrice').value;
  const maxPrice = document.getElementById('maxPrice').value;
  if (minPrice) filters.min_price = minPrice;
  if (maxPrice) filters.max_price = maxPrice;

  // Min discount
  const minDiscount = document.getElementById('minDiscount').value;
  if (minDiscount) filters.min_discount = minDiscount;

  // On sale only
  if (document.getElementById('onSaleFilter').checked) {
    filters.on_sale = 'true';
  }

  return filters;
}

// Show/hide loading overlay
function showLoading(show) {
  const overlay = document.getElementById('loadingOverlay');
  if (show) {
    overlay.classList.remove('hidden');
  } else {
    overlay.classList.add('hidden');
  }
}

// View game details (will be implemented later)
function viewGameDetails(steamAppId) {
  window.open(`https://store.steampowered.com/app/${steamAppId}`, '_blank');
}

// Make viewGameDetails global so it can be called from grid
window.viewGameDetails = viewGameDetails;
