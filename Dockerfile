# ---- Build stage ------------------------------------------------------------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY . .
# Build the client (Vite) and bundle the server (esbuild). Invoked directly with
# node so the build works regardless of the checkout folder name.
RUN node node_modules/vite/bin/vite.js build \
 && node node_modules/esbuild/bin/esbuild server.ts \
      --bundle --platform=node --format=cjs --packages=external \
      --outfile=dist/server.cjs

# ---- Runtime stage ---------------------------------------------------------
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install --omit=dev --no-audit --no-fund

COPY --from=build /app/dist ./dist

# Cloud Run sets PORT (8080); server.ts reads process.env.PORT.
EXPOSE 8080
CMD ["node", "dist/server.cjs"]
