# 🚀 Production Deployment Guide: Railway (Backend) & Vercel (Frontend)

This guide walks you through deploying the **Express Node.js Backend** to [Railway](https://railway.app) and the **React Frontend** to [Vercel](https://vercel.com).

---

## 1. ⚙️ Deploying Backend to Railway

### Step 1: Push Repository to GitHub
Ensure your latest codebase is pushed to your GitHub repository.

### Step 2: Create Railway Project
1. Log into **[Railway.app](https://railway.app)**.
2. Click **"New Project"** -> Select **"Deploy from GitHub repo"**.
3. Select your repository (`Salesmh-main`).
4. Set the **Root Directory** to `backend`.

### Step 3: Configure Railway Environment Variables
In Railway -> Project Settings -> **Variables**, add the following environment variables:

| Variable Name | Recommended Value |
|---|---|
| `PORT` | `5002` (Railway dynamically overrides if needed) |
| `NODE_ENV` | `production` |
| `GOOGLE_API_KEY` | `AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk` |
| `JOB_ORDER_SPREADSHEET_ID` | `1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI` |
| `CUTTING_SPREADSHEET_ID` | `1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA` |
| `TRACKING_SPREADSHEET_ID` | `1jTju43L6-M1_f-zl67IMsI-sj7RMiLXOXN6z0vzSyck` |
| `CACHE_SYNC_INTERVAL_MS` | `180000` |

### Step 4: Deploy & Copy Domain
1. Railway will automatically build and deploy the app using `backend/Procfile` / `backend/railway.json`.
2. Go to **Settings** -> **Networking** -> Click **"Generate Domain"** (e.g. `https://salesmh-backend-production.up.railway.app`).
3. Verify backend health by opening `https://salesmh-backend-production.up.railway.app/health` in browser.

---

## 2. 🌐 Deploying Frontend to Vercel

### Step 1: Create Vercel Project
1. Log into **[Vercel.com](https://vercel.com)**.
2. Click **"Add New..."** -> Select **"Project"**.
3. Import your GitHub repository (`Salesmh-main`).

### Step 2: Configure Framework & Root Directory
* **Framework Preset**: Create React App
* **Root Directory**: `./` (Root)
* **Build Command**: `npm run build`
* **Output Directory**: `build`

### Step 3: Configure Vercel Environment Variables
In Vercel -> Project Settings -> **Environment Variables**, add:

| Environment Variable | Value |
|---|---|
| `REACT_APP_BACKEND_URL` | `https://your-railway-backend-url.up.railway.app/api` |
| `REACT_APP_GOOGLE_API_KEY` | `AIzaSyAomDFBkOySlIxKWSKGHe6ATv9gvaBr7uk` |
| `REACT_APP_JOB_ORDER_SPREADSHEET_ID` | `1fKSwGBIpzWEFk566WRQ4bzQ0anJlmasoY8TwrTLQHXI` |
| `REACT_APP_CUTTING_SPREADSHEET_ID` | `1Hj3JeJEKB43aYYWv8gk2UhdU6BWuEQfCg5pBlTdBMNA` |
| `REACT_APP_TRACKING_SPREADSHEET_ID` | `1jTju43L6-M1_f-zl67IMsI-sj7RMiLXOXN6z0vzSyck` |

### Step 4: Deploy!
Click **Deploy**. Vercel will automatically build the React application and deploy it with `vercel.json` SPA routing handling all sub-routes smoothly.

---

## 🔍 Verification & Health Check

1. **Backend Health Check**: Open `https://your-railway-backend-url.up.railway.app/health` — should return `{"status": "OK"}`.
2. **Frontend App**: Open your Vercel URL (e.g., `https://sales-mh.vercel.app`).
3. **Live Google Sheets Sync**: Test creating a Cutting Matrix or Challan — it will sync directly with Google Sheets.
