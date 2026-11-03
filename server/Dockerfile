# Multi-stage Dockerfile for the Express server (JavaScript).
# - `development` target: runs with node --watch for hot reload.
# - `production` target: runs the same source files (no build step needed for JS).


#  Base stage: shared by dev and prod
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json ./
# `npm ci` installs exactly the tree the lockfile describes. `npm install`
# re-resolves it from scratch instead, which was both slower and a real
# problem here: this package.json pins six transitive dependencies through
# `overrides`, and resolving those without a lockfile crashed npm 10.8.2 — the
# version in this image — inside its own dependency planner. `npm ci` does not
# run that planner at all.
#
# It also means the container and a developer's machine install the same
# versions rather than merely compatible ones, so a patched transitive
# dependency cannot quietly drift back on a later rebuild.
RUN npm ci

# Development target 
FROM base AS development
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

#  Production target 
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
EXPOSE 4000
CMD ["npm", "start"]