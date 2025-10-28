# Deployment Guide

This guide covers deploying Deckworthy to various platforms.

## Quick Deploy Options

### Railway (Recommended - $5/month)

Railway is the easiest option with full database support and automatic deployments.

1. **Create Railway Account**
   - Go to https://railway.app/
   - Sign up with GitHub

2. **Create New Project**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `deckworthy` repository

3. **Add Environment Variables**
   - Click on your service
   - Go to "Variables" tab
   - Add the following:
     ```
     STEAM_API_KEY=your_key_here
     ITAD_API_KEY=your_key_here
     NODE_ENV=production
     DATABASE_PATH=/app/data/deckworthy.db
     ```

4. **Deploy**
   - Railway will automatically build and deploy
   - Wait for deployment to complete
   - Click on the generated URL to access your app

5. **Initialize Data**
   - SSH into your Railway container or run commands from dashboard:
     ```bash
     npm run sync-games
     npm run sync-protondb
     npm run sync-prices
     ```

**Pros:**
- Automatic deployments on git push
- Built-in database persistence
- Easy to scale
- Great developer experience

**Cons:**
- Costs $5/month (no free tier as of 2024)

---

### Render (Free Tier Available)

Render offers a free tier with some limitations.

1. **Create Render Account**
   - Go to https://render.com/
   - Sign up with GitHub

2. **Create New Web Service**
   - Click "New +" → "Web Service"
   - Connect your GitHub repository
   - Select "deckworthy"

3. **Configure Service**
   - **Name**: deckworthy
   - **Environment**: Node
   - **Build Command**: `npm install && npm run init-db`
   - **Start Command**: `npm start`
   - **Plan**: Free or Starter ($7/month)

4. **Add Environment Variables**
   ```
   STEAM_API_KEY=your_key_here
   ITAD_API_KEY=your_key_here
   NODE_ENV=production
   DATABASE_PATH=/opt/render/project/src/data/deckworthy.db
   ```

5. **Deploy**
   - Click "Create Web Service"
   - Wait for build and deployment

6. **Initialize Data**
   - Use Render shell to run:
     ```bash
     npm run sync-games
     npm run sync-protondb
     npm run sync-prices
     ```

**Pros:**
- Free tier available (with limitations)
- Automatic deployments
- SSL included

**Cons:**
- Free tier spins down after 15 minutes of inactivity
- Database persistence can be tricky on free tier
- May need to re-sync data occasionally

---

### Fly.io (Free Tier Available)

Fly.io offers a generous free tier and global deployment.

1. **Install Fly CLI**
   ```bash
   # macOS/Linux
   curl -L https://fly.io/install.sh | sh

   # Windows
   powershell -Command "iwr https://fly.io/install.ps1 -useb | iex"
   ```

2. **Login**
   ```bash
   fly auth login
   ```

3. **Initialize Fly App**
   ```bash
   cd deckworthy
   fly launch
   ```

   Answer the prompts:
   - App name: `deckworthy` (or your choice)
   - Region: Choose closest to you
   - PostgreSQL: No (we're using SQLite)
   - Redis: No

4. **Configure fly.toml**

   Fly will generate `fly.toml`. Edit it:

   ```toml
   app = "your-app-name"
   primary_region = "iad"

   [build]
     dockerfile = "Dockerfile"

   [env]
     NODE_ENV = "production"
     PORT = "8080"
     DATABASE_PATH = "/data/deckworthy.db"

   [http_service]
     internal_port = 8080
     force_https = true
     auto_stop_machines = true
     auto_start_machines = true
     min_machines_running = 0

   [[vm]]
     cpu_kind = "shared"
     cpus = 1
     memory_mb = 256

   [[mounts]]
     source = "data"
     destination = "/data"
     initial_size = "1gb"
   ```

5. **Create Volume**
   ```bash
   fly volumes create data --size 1 --region iad
   ```

6. **Set Secrets**
   ```bash
   fly secrets set STEAM_API_KEY=your_key_here
   fly secrets set ITAD_API_KEY=your_key_here
   ```

7. **Deploy**
   ```bash
   fly deploy
   ```

8. **Initialize Data**
   ```bash
   fly ssh console
   npm run sync-games
   npm run sync-protondb
   npm run sync-prices
   exit
   ```

**Pros:**
- Generous free tier (3 shared-cpu VMs with 256MB RAM each)
- Global deployment
- Persistent volumes
- Great performance

**Cons:**
- Slightly more complex setup
- CLI required

---

### Vercel (Free Tier)

Vercel works great for the frontend and API routes, but database persistence is tricky.

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Login**
   ```bash
   vercel login
   ```

3. **Create vercel.json**

   ```json
   {
     "version": 2,
     "builds": [
       {
         "src": "src/index.js",
         "use": "@vercel/node"
       },
       {
         "src": "public/**",
         "use": "@vercel/static"
       }
     ],
     "routes": [
       {
         "src": "/api/(.*)",
         "dest": "src/index.js"
       },
       {
         "src": "/(.*)",
         "dest": "public/$1"
       }
     ],
     "env": {
       "NODE_ENV": "production"
     }
   }
   ```

4. **Deploy**
   ```bash
   vercel
   ```

5. **Set Environment Variables**
   ```bash
   vercel env add STEAM_API_KEY
   vercel env add ITAD_API_KEY
   ```

**Important Note**: SQLite doesn't work well with Vercel serverless functions. You'll need to either:
- Use an external database (PostgreSQL on Supabase, PlanetScale, etc.)
- Use Vercel KV for caching
- Accept that data will be read-only

**Pros:**
- Free tier is very generous
- Excellent performance
- Easy deployment

**Cons:**
- Serverless doesn't support SQLite well
- Need external database for full functionality

---

### VPS (DigitalOcean, Linode, Vultr)

For full control, deploy to a VPS.

1. **Provision a Server**
   - 1GB RAM minimum
   - Ubuntu 22.04 LTS recommended

2. **SSH Into Server**
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

4. **Install PM2** (process manager)
   ```bash
   sudo npm install -g pm2
   ```

5. **Clone Repository**
   ```bash
   git clone https://github.com/yourusername/deckworthy.git
   cd deckworthy
   npm install
   ```

6. **Configure Environment**
   ```bash
   cp .env.example .env
   nano .env  # Edit and add your API keys
   ```

7. **Initialize Database**
   ```bash
   npm run init-db
   npm run sync-games
   npm run sync-protondb
   npm run sync-prices
   ```

8. **Start with PM2**
   ```bash
   pm2 start src/index.js --name deckworthy
   pm2 save
   pm2 startup
   ```

9. **Setup Nginx** (optional, for reverse proxy)
   ```bash
   sudo apt-get install nginx
   ```

   Create `/etc/nginx/sites-available/deckworthy`:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable site:
   ```bash
   sudo ln -s /etc/nginx/sites-available/deckworthy /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

10. **Setup SSL with Let's Encrypt** (optional)
    ```bash
    sudo apt-get install certbot python3-certbot-nginx
    sudo certbot --nginx -d your-domain.com
    ```

**Pros:**
- Full control
- Better performance
- No platform limitations
- Can run scheduled jobs

**Cons:**
- More setup required
- Need to manage server yourself
- Security is your responsibility

---

## Post-Deployment

### Keep Data Fresh

Set up scheduled jobs to keep data current:

**Option 1: Use Platform Cron**
- Railway/Render: Use their built-in cron jobs feature
- Configure to run sync scripts daily/weekly

**Option 2: External Cron Service**
- Use a service like [cron-job.org](https://cron-job.org/)
- Make HTTP requests to trigger sync endpoints

**Option 3: Built-in Scheduler**
- The app includes a scheduler that runs automatically
- Configure schedules in environment variables

### Monitor Your App

- Set up uptime monitoring (UptimeRobot, Better Uptime, etc.)
- Monitor the `/health` endpoint
- Check logs regularly for errors

### Backup Database

```bash
# For SQLite
cp data/deckworthy.db backups/deckworthy-$(date +%Y%m%d).db

# For PostgreSQL (if you migrated)
pg_dump $DATABASE_URL > backup.sql
```

## Troubleshooting Deployment

### "Cannot find module" errors
Run `npm install` again, or use `npm ci` for clean install

### Database not persisting
Make sure you're using a persistent volume/storage

### API keys not working
Double-check environment variables are set correctly

### Out of memory
Increase RAM allocation or reduce sync batch sizes

### Slow performance
- Enable caching
- Add database indexes
- Use a CDN for static files

## Migrating to PostgreSQL

For production at scale, consider PostgreSQL:

1. **Provision PostgreSQL**
   - Railway: Add PostgreSQL service
   - Supabase: Free tier available
   - Neon: Free serverless PostgreSQL

2. **Update Code**
   - Replace `better-sqlite3` with `pg`
   - Update SQL queries for PostgreSQL syntax
   - Update repositories

3. **Migrate Data**
   ```bash
   # Export from SQLite
   sqlite3 data/deckworthy.db .dump > dump.sql

   # Import to PostgreSQL (after conversion)
   psql $DATABASE_URL < dump.sql
   ```

---

## Need Help?

- Check logs for error messages
- Review the [GETTING_STARTED.md](GETTING_STARTED.md) guide
- Open an issue on GitHub
