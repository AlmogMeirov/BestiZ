
# Multi-stage Dockerfile for the React + Vite client.
# - `development` target: runs the Vite dev server with HMR.
# - `production` target: builds static assets and serves them with `vite preview`
#   (sufficient for this assignment; a real deployment would use nginx).


FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
RUN npm install

# Development target
FROM base AS development
COPY . .
EXPOSE 5173
CMD ["npm", "run", "dev"]

# Build stage 
FROM base AS build
COPY . .
RUN npm run build

# Production target 
FROM node:20-alpine AS production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/vite.config.js ./
EXPOSE 5173
CMD ["npm", "run", "preview"]