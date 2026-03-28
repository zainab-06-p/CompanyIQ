# Deploy CompanyIQ Backend On Render

This project should run frontend on Vercel and backend on Render for long-running TinyFish workloads.

## 1) Create Render service from repo

1. Go to Render Dashboard -> New -> Blueprint.
2. Select this repository.
3. Render will detect `render.yaml` and create `companyiq-backend`.

## 2) Set required environment values in Render

Fill the `sync: false` values:

- APP_URL=https://companyiq.vercel.app
- CORS_ORIGINS=https://companyiq.vercel.app
- TINYFISH_API_KEY=<your tinyfish key>
- RAZORPAY_KEY_ID=<key>
- RAZORPAY_KEY_SECRET=<secret>
- SUPABASE_URL=<url>
- SUPABASE_ANON_KEY=<anon key>
- SUPABASE_SERVICE_ROLE_KEY=<service role key>

## 3) Verify backend health

Use:

`https://<your-render-service>.onrender.com/api/health`

## 4) Wire frontend (Vercel) to Render backend

Set Vercel project env var:

- VITE_API_BASE=https://<your-render-service>.onrender.com/api

Then redeploy Vercel.

## 5) Validate TinyFish execution

Open:

`https://companyiq.vercel.app`

Generate a report and verify non-zero `metadata.totalSteps` in response payload.

## Notes

- Render free plan may cold start.
- If you need faster startup and heavy workload stability, use a paid Render instance.
