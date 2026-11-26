# Production image for the Competitor Intelligence backend (Express + TS).
#
# Build:  docker build -t competitor-intelligence-backend ./backend
# Run API:    docker run --env-file backend/.env -p 5000:5000 competitor-intelligence-backend
# Run worker: docker run --env-file backend/.env competitor-intelligence-backend node dist/worker.js
#             (same image — only the command changes, exactly as on Render)
#
# Notes:
# - `npm ci` needs package-lock.json — it exists in backend/; never delete it.
# - The image does NOT install Playwright/Chromium. The Playwright scraper
#   fallback is optional (SCRAPER_USE_PLAYWRIGHT=true) and stays off in
#   production; static Axios+Cheerio scraping is the default.
# - No .env file is copied into the image (see .dockerignore). All secrets
#   come from the environment at runtime (Render dashboard / docker --env-file).

FROM node:20-alpine

WORKDIR /app

# Install dependencies first (cached layer — rebuilds are fast when only
# source code changes). All deps are installed because `npm run build`
# needs TypeScript (a devDependency); dev deps are pruned after the build.
COPY package.json package-lock.json ./
RUN npm ci

# Copy source and build TypeScript -> dist/ (server.js + worker.js),
# then drop the dev dependencies (TypeScript, tsx) from the final image.
COPY tsconfig.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

# Drop root: run as the unprivileged `node` user baked into the image.
USER node

EXPOSE 5000

CMD ["node", "dist/server.js"]
