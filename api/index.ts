import type { VercelRequest, VercelResponse } from '@vercel/node';
import express from 'express';
import cors from 'cors';

// Import API routes
import gamesRouter from '../src/api/games.js';
import dealsRouter from '../src/api/deals.js';
import statsRouter from '../src/api/stats.js';

// Create Express app
const app = express();

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGINS?.split(',') || '*'
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// API routes
app.use('/api/games', gamesRouter);
app.use('/api/deals', dealsRouter);
app.use('/api/stats', statsRouter);

// Export handler for Vercel
export default async (req: VercelRequest, res: VercelResponse) => {
  return app(req as any, res as any);
};
