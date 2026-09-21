# CIBO Test Deployment

## Main API on Render

Branch: test-deployment

Build command:
pip install -r requirements-render-main.txt

Start command:
cd attendance-system && uvicorn backend.main:app --host 0.0.0.0 --port $PORT

Environment variables:
- SUPABASE_URL
- SUPABASE_KEY
- INSIGHTFACE_URL=https://<insightface-service>.onrender.com

## InsightFace API on Render

Branch: test-deployment

Build command:
pip install -r requirements-insightface.txt

Start command:
cd attendance-system && uvicorn backend.insightface_api:app --host 0.0.0.0 --port $PORT

Environment variables:
- SUPABASE_URL
- SUPABASE_KEY

## Frontend on Vercel

Root directory:
attendance-system

Build command:
npm run build

Output directory:
dist

Environment variables:
- VITE_API_URL=https://<main-api>.onrender.com
- VITE_INSIGHTFACE_URL=https://<insightface-service>.onrender.com
- VITE_SUPABASE_URL=https://<project>.supabase.co
- VITE_SUPABASE_ANON_KEY=<Supabase publishable key>

VITE_* variables are visible in the browser. Never put a service-role key in a VITE_* variable.

## Test-only security note

The application currently uses public Supabase Storage URLs for face images. Keep this deployment restricted to controlled testing and secure face-image access before production use.
