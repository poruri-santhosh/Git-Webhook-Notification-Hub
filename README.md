# Commit Stream

A small MERN-style GitHub push webhook receiver with a React commit feed. Express receives GitHub push events, Mongoose stores each commit in MongoDB, and the feed refreshes every 15 seconds.

## Requirements

- Node.js 20 or newer
- A MongoDB Atlas cluster (or another reachable MongoDB instance)
- A GitHub repository where you can configure webhooks

## Run locally

1. Install dependencies:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set `MONGODB_URI`. Set `GITHUB_WEBHOOK_SECRET` to a long random value; webhook signature validation is enabled whenever this variable is set.

3. Start the API and React development server:

   ```sh
   npm run dev
   ```

   The React app is at `http://localhost:5173`. The Express API listens on `http://localhost:3001`.

## API

- `POST /api/webhook` accepts GitHub `push` events. Each commit's SHA, message, author name, timestamp, repository full name, and URL are upserted into MongoDB. Repeated deliveries update the existing commit instead of duplicating it.
- `GET /api/commits` returns the latest 100 commits, newest first.
- `GET /api/health` returns a basic API health response.

Only GitHub `push` events are processed. Other event types receive `202 Accepted` and are ignored. Configure the webhook's content type as `application/json` and subscribe to the **Pushes** event.

## Test with a local tunnel

1. Start the local app with `npm run dev` and expose the API port (`3001`) with a tunnel:

   ```sh
   ngrok http 3001
   ```

   Alternatively, use Cloudflare Tunnel: `cloudflared tunnel --url http://localhost:3001`.

2. In the GitHub repository, open **Settings → Webhooks → Add webhook**. Set the payload URL to `https://<your-tunnel-host>/api/webhook`, choose `application/json`, enter the same secret as `GITHUB_WEBHOOK_SECRET`, and select **Just the push event**.

3. Push a commit, then open the local feed at `http://localhost:5173`. GitHub also provides **Recent Deliveries** on the webhook settings page for inspecting delivery status and response bodies.

4. To check the API directly, open `http://localhost:3001/api/commits` or `http://localhost:3001/api/health`.

If a webhook is configured with a secret, set the matching environment variable before starting the server. For a local smoke test without signature verification, leave `GITHUB_WEBHOOK_SECRET` unset.

## Deploy to Vercel

1. Push this project to a GitHub repository.
2. In Vercel, select **Add New → Project**, import that GitHub repository, and keep the detected Vite settings (`npm run build`, output directory `dist`).
3. Add `MONGODB_URI` and `GITHUB_WEBHOOK_SECRET` under **Project → Settings → Environment Variables**. Use a MongoDB connection string reachable from Vercel and allow Vercel's network access in MongoDB Atlas.
4. Deploy (and redeploy after changing environment variables). The included `vercel.json` routes `/api/*` to the Express function in `api/index.js`; the React app is served from `dist`.
5. Add a GitHub webhook pointing to `https://<your-vercel-domain>/api/webhook`, set its secret to the exact `GITHUB_WEBHOOK_SECRET`, and subscribe to **Pushes**.

Do not commit `.env` or production credentials. GitHub and Vercel can both be connected through Vercel's Git integration for automatic deployments on pushes.
