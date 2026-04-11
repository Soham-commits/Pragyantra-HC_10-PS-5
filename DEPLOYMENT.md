# Deployment Guide - MediQ Health Companion

## Overview
This guide covers deploying the MediQ Health Companion application with the frontend on Netlify and backend on a free hosting platform.

---

## Frontend Deployment (Netlify)

### Prerequisites
- GitHub account
- Netlify account (free tier)

### Steps

1. **Build Configuration**
   - Build Command: `npm run build`
   - Publish Directory: `dist`
   - Node Version: 18+

2. **Environment Variables**
   Add these in Netlify dashboard (Site settings → Environment variables):
   ```
   VITE_API_BASE_URL=https://your-backend-url.com/api
   ```

3. **Deploy from Git**
   - Connect your GitHub repository
   - Netlify will auto-deploy on push to main branch

4. **Custom Domain (Optional)**
   - Configure in Site settings → Domain management

### Build Command for Netlify
```bash
npm install && npm run build
```

---

## Backend Deployment Options (Free Tier)

### Option 1: Render.com (Recommended)

**Pros:**
- Free tier available (750 hours/month)
- Auto-sleeps after 15 min inactivity
- Easy setup with GitHub
- Built-in logs

**Setup:**
1. Create account at [render.com](https://render.com)
2. New → Web Service
3. Connect GitHub repository
4. Configure:
   - **Root Directory:** `backend`
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Environment:** Python 3
   - **Plan:** Free

5. **Environment Variables:**
   ```
   MONGODB_URI=your_mongodb_uri
   JWT_SECRET=your_secret_key_here
   GOOGLE_PLACES_API_KEY=your_api_key
   PINECONE_API_KEY=your_pinecone_key
   PINECONE_ENVIRONMENT=your_pinecone_env
   LLM_PROVIDER=mock
   LLM_MODEL=mock
   ```

**Important Notes:**
- Free tier sleeps after 15 min → first request takes ~30 sec
- 750 hours/month free
- Automatically restarts on git push

---

### Option 2: Railway.app

**Pros:**
- $5 free credit monthly
- No sleep time
- PostgreSQL included
- Auto-deploy from GitHub

**Setup:**
1. Sign up at [railway.app](https://railway.app)
2. New Project → Deploy from GitHub
3. Add Python service
4. Configure:
   - **Root:** `backend`
   - **Build:** `pip install -r requirements.txt`
   - **Start:** `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

5. Add environment variables (same as above)

**Important:**
- $5 credit = ~500 hours runtime
- Monitor usage in dashboard

---

### Option 3: Fly.io

**Pros:**
- 3 shared-cpu-1x VMs free
- Good for global deployment
- No sleep time

**Setup:**
1. Install flyctl: `brew install flyctl` (macOS)
2. Sign up: `flyctl auth signup`
3. Create fly.toml in backend/:

```toml
app = "your-app-name"

[build]
  builder = "paketobuildpacks/builder:base"

[env]
  PORT = "8000"

[[services]]
  http_checks = []
  internal_port = 8000
  protocol = "tcp"
  script_checks = []

  [[services.ports]]
    handlers = ["http"]
    port = 80

  [[services.ports]]
    handlers = ["tls", "http"]
    port = 443
```

4. Deploy: `flyctl launch` (from backend/ directory)
5. Set secrets: `flyctl secrets set MONGODB_URI=xxx JWT_SECRET=xxx`

---

### Option 4: Koyeb

**Pros:**
- Truly free tier (no credit card needed)
- Good performance
- Auto-scaling

**Setup:**
1. Sign up at [koyeb.com](https://koyeb.com)
2. Create app from GitHub
3. Select `backend` directory
4. Build: `pip install -r requirements.txt`
5. Run: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add environment variables

---

## Database Options (Free)

### MongoDB Atlas (Recommended)
- **Free Tier:** 512 MB storage
- **Setup:** [mongodb.com/cloud/atlas](https://www.mongodb.com/cloud/atlas)
- **Connection:** Get URI from Atlas dashboard

### Alternative: MongoDB on Railway
- Included in Railway free tier
- Automatically provisioned
- Good for development

---

## Environment Variables Reference

### Backend (.env)
```env
# Required
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/mediq
JWT_SECRET=your-super-secret-jwt-key-change-this
FRONTEND_URL=https://your-netlify-app.netlify.app

# Optional but Recommended
GOOGLE_PLACES_API_KEY=your_google_places_api_key
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_ENVIRONMENT=your_pinecone_environment

# AI Provider (use mock for free tier)
LLM_PROVIDER=mock
LLM_MODEL=mock

# For production with real AI:
# LLM_PROVIDER=openai  # or gemini
# LLM_MODEL=gpt-4o-mini
# OPENAI_API_KEY=your_key  # if using OpenAI
# GOOGLE_API_KEY=your_key  # if using Gemini
```

### Frontend (.env.local or Netlify)
```env
VITE_API_BASE_URL=https://your-backend-url.com/api
```

---

## Post-Deployment Checklist

- [ ] Backend health check: `GET https://your-backend-url.com/health`
- [ ] Test authentication: Login/Signup
- [ ] Verify API connections in browser console
- [ ] Check CORS settings (FRONTEND_URL in backend .env)
- [ ] Test all major features:
  - [ ] Chat functionality
  - [ ] Image scans (lung/skin)
  - [ ] Report generation
  - [ ] Profile management
- [ ] Monitor logs for errors
- [ ] Set up error monitoring (optional: Sentry.io free tier)

---

## Troubleshooting

### Backend Issues

**502/503 Errors:**
- Check if backend service is running
- Verify start command
- Check logs in hosting platform

**CORS Errors:**
- Ensure FRONTEND_URL matches your Netlify URL
- Check backend/app/main.py CORS settings

**Cold Start (Render):**
- First request after sleep takes 30-60 seconds
- Consider Railway or Fly.io for no-sleep alternative

### Frontend Issues

**API Connection Failed:**
- Verify VITE_API_BASE_URL is correct
- Check if backend is accessible
- Ensure HTTPS (not HTTP) for production

**Build Failures:**
- Check Node version (need 18+)
- Clear build cache in Netlify
- Verify all dependencies in package.json

---

## Cost Estimate (Free Tier)

| Service | Free Tier Limit | Cost After |
|---------|----------------|------------|
| Netlify | 100 GB bandwidth/month | $0 for hobby projects |
| Render | 750 hours/month | $7/month for always-on |
| MongoDB Atlas | 512 MB storage | $0.08/GB-month |
| Railway | $5 credit/month | $0.000231/GB-second |
| Fly.io | 3 VMs | $0.02/GB-month RAM |

**Recommended Free Stack:**
- Frontend: Netlify (free forever for hobby)
- Backend: Render (free, auto-sleep OK)
- Database: MongoDB Atlas (512 MB free)
- Total Cost: $0/month for moderate usage

---

## Production Optimization Tips

1. **Enable Caching:**
   - Add cache headers in backend
   - Use Netlify CDN for static assets

2. **Image Optimization:**
   - Compress images before upload
   - Use WebP format where possible

3. **Monitoring:**
   - Set up uptime monitoring (UptimeRobot - free)
   - Use error tracking (Sentry - free tier)

4. **Performance:**
   - Lazy load images and components
   - Code splitting in frontend
   - Database indexing for common queries

5. **Security:**
   - Keep dependencies updated
   - Use environment variables for all secrets
   - Enable rate limiting on backend
   - HTTPS everywhere

---

## Support & Resources

- [Netlify Docs](https://docs.netlify.com)
- [Render Docs](https://render.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Fly.io Docs](https://fly.io/docs)
- [MongoDB Atlas Docs](https://docs.atlas.mongodb.com)

---

## Quick Deploy Commands

### Frontend (Manual)
```bash
npm run build
# Upload dist/ folder to Netlify
```

### Backend (Render - Auto Deploy)
Just push to GitHub main branch - auto deploys!

### Health Check
```bash
# Backend
curl https://your-backend.onrender.com/health

# Should return:
# {"status": "healthy", "version": "1.0.0"}
```

---

**Last Updated:** December 31, 2025
