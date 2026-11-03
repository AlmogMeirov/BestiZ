
# Multi-stage Dockerfile for the React + Vite client.
# - `development` target: runs the Vite dev server with HMR.
# - `production` target: builds static assets and serves them with `vite preview`
#   (sufficient for this assignment; a real deployment would use nginx).


FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` rather than `npm install`: it installs exactly what the lockfile
# describes instead of re-resolving the tree, so the container and a
# developer's machine get the same versions and a rebuild cannot quietly pick
# up something newer. See the server's Dockerfile for the failure that made
# this more than a preference.
RUN npm ci

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
COPY package.json package-lock.json ./
# Not `--omit=dev`: this stage serves the built assets with `vite preview`, and
# vite is a devDependency. Omitting them would leave the stage without the one
# binary its CMD runs.
RUN npm ci
COPY --from=build /app/dist ./dist
COPY --from=build /app/vite.config.js ./
EXPOSE 5173
CMD ["npm", "run", "preview"]