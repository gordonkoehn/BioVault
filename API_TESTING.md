# BioVault Flask API Testing

This setup demonstrates how to integrate a Flask API as Vercel serverless functions with your Next.js application, similar to the [Vercel Next.js + Flask example](https://github.com/vercel/examples/tree/main/python/nextjs-flask).

## 🚀 Quick Start

### Development Mode

1. **Start both servers simultaneously:**
   ```bash
   npm run dev
   ```

   Or run them separately in different terminals:

   ```bash
   # Terminal 1: Start Flask API server
   npm run flask-dev
   
   # Terminal 2: Start Next.js development server  
   npm run next-dev
   ```

2. **Visit the test page:**
   - Next.js app: http://localhost:3000
   - API test page: http://localhost:3000/test-api
   - Flask server directly: http://127.0.0.1:5328

## 📡 Available API Endpoints

- `GET /api/python` - Simple "Hello World" endpoint
- `POST /api/test` - Test endpoint that accepts JSON data
- `GET /api/health` - Health check endpoint
- `GET /api/info` - API information and available endpoints

## 🔧 How It Works

### Development
- Next.js development server runs on port 3000
- Flask server runs on port 5328
- `next.config.js` rewrites `/api/*` requests to `http://127.0.0.1:5328/api/*`

### Production (Vercel)
- Flask functions are deployed as Vercel serverless functions
- Each route in `/api/index.py` becomes a serverless function
- No separate Flask server needed

## 📁 File Structure

```
/api/
  └── index.py          # Flask application with API routes
/src/app/
  ├── page.tsx          # Main page with link to test page
  └── test-api/
      └── page.tsx      # API testing interface
next.config.js          # Rewrites configuration
requirements.txt        # Python dependencies
```

## 🧪 Testing the API

Visit `/test-api` in your browser to access the interactive testing interface, or test endpoints manually:

```bash
# Test endpoints with curl
curl http://localhost:3000/api/python
curl http://localhost:3000/api/health
curl -X POST http://localhost:3000/api/test -H "Content-Type: application/json" -d '{"message":"Hello"}'
```

## 🚀 Deployment

When deploying to Vercel:
1. Vercel automatically detects Python functions in `/api/`
2. Creates serverless functions for each route
3. No additional configuration needed beyond `next.config.js`

The Flask server will run as serverless functions in production, with the same API endpoints available.
