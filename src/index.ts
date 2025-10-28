import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Import API routes
import gamesRouter from './api/games.js';
import dealsRouter from './api/deals.js';
import statsRouter from './api/stats.js';

// Import database connection
import getDb, { closeDb } from './db/connection.js';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(join(__dirname, '../public')));

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
  });
  next();
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  try {
    const db = getDb();
    // Try a simple query to verify DB connection
    db.prepare('SELECT 1').get();
    res.json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: (error as Error).message,
      timestamp: new Date().toISOString()
    });
  }
});

// API routes
app.use('/api/games', gamesRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/stats', statsRouter);

// Catch-all for serving index.html for client-side routing
app.get('*', (req: Request, res: Response) => {
  // Only serve index.html for non-API routes
  if (!req.path.startsWith('/api/')) {
    res.sendFile(join(__dirname, '../public/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// Error handling middleware
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing database connection...');
  closeDb();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing database connection...');
  closeDb();
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║         Deckworthy Server Started         ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log('');
  console.log(`🚀 Server running on: http://localhost:${PORT}`);
  console.log(`📊 API endpoints:     http://localhost:${PORT}/api`);
  console.log(`💚 Health check:      http://localhost:${PORT}/health`);
  console.log('');
  console.log('Press Ctrl+C to stop the server');
  console.log('');

  // Verify database connection
  try {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };
    console.log(`📦 Database connected: ${count.count} games loaded`);
  } catch (error) {
    console.error('⚠️  Database connection error:', (error as Error).message);
    console.log('💡 Run "npm run init-db" to initialize the database');
  }
  console.log('');
});

export default app;
