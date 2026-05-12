# Multi-stage Dockerfile for the Express server (JavaScript).
# - `development` target: runs with node --watch for hot reload.
# - `production` target: runs the same source files (no build step needed for JS).


#  Base stage: shared by dev and prod
FROM node:20-alpine AS base
WORKDIR /app
COPY package.json ./
# `npm install` is used here (no lockfile yet) so anyone can build the project as-is.
# In a production setup we'd commit package-lock.json and use `npm ci`.
RUN npm install

# Development target 
FROM base AS development
COPY . .
EXPOSE 4000
CMD ["npm", "run", "dev"]

#  Production target 
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY package.json ./
RUN npm install --omit=dev
COPY src ./src
EXPOSE 4000
CMD ["npm", "start"]