# 🔑 API Key Manager

Manage API Key and record user IP. Deploy on Render.com.

## 🚀 Deploy to Render

### Method 1: Use Blueprint (render.yaml)

1. Fork this repository
2. Log in to [Render.com](https://render.com)
3. Select **"New +"** → **"Blueprint"**
4. Connect to the repository
5. Render automatically deploys both services

### Method 2: Deploy manually

#### Backend
1. **New +** → **Web Service**
2. Connect to the repository
3. Fill in:
   - Name: `api-key-manager-backend`
   - Runtime: `Node`
   - Build Command: `cd backend && npm install`
   - Start Command: `cd backend && node server.js`
4. Add Environment Variables:
   - `NODE_ENV`: `production`
   - `API_SECRET_KEY`: `<create secret>`
   - `ALLOWED_ORIGINS`: `https://api-key-manager-frontend.onrender.com`

#### Frontend
1. **New +** → **Static Site**
2. Connect to the repository
3. Fill in:
   - Name: `api-key-manager-frontend`
   - Publish Directory: `frontend`
4. Add Environment Variables:
   - `API_URL`: `https://api-key-manager-backend.onrender.com`

## 🔐 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (production/development) | ✅ |
| `PORT` | Server port | ✅ |
| `API_SECRET_KEY` | API authentication key | ⚠️ Recommended |
| `ALLOWED_ORIGINS` | CORS allowed origins | ⚠️ Recommended |
| `LOG_LEVEL` | Logging level (debug/info/error) | ❌ |

## 📡 API Endpoints

- `GET /` - Server info
- `GET /api/health` - Health check
- `GET /api/logs` - Get all IP logs
- `GET /api/request` - User manual
- `POST /api/request` - Create new key
- `DELETE /api/logs` - Delete all logs (admin)
- `GET /api/stats` - Get statistics

## 🛠️ Local Development

```bash
# Clone repository
git clone https://github.com/ugmoddev/api-key-manager.git
cd api-key-manager

# Install backend dependencies
cd backend
npm install

# Create .env file
cp .env.example .env
# Edit .env with your values

# Run backend
npm start
# Or with nodemon
npm run dev

# Open frontend
# Double click frontend/index.html or use Live Server
