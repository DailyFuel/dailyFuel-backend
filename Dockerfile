ARG PORT=3000

# --- Install production deps (cached) ---
FROM node:20-slim AS deps-prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev

# --- Install dev/test deps (cached) ---
FROM node:20-slim AS deps-dev
WORKDIR /app
COPY package*.json ./
RUN npm ci

# --- Development image ---
FROM node:20-slim AS development
ENV NODE_ENV=development
WORKDIR /app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .
EXPOSE ${PORT}
USER node
CMD ["npm", "run", "dev"]

# --- Test image ---
FROM node:20-slim AS test
ENV NODE_ENV=test
WORKDIR /app
COPY --from=deps-dev /app/node_modules ./node_modules
COPY . .
USER node
CMD ["npm", "run", "test"]

# --- Production image ---
FROM node:20-slim AS production
ENV NODE_ENV=production
WORKDIR /app
COPY --from=deps-prod /app/node_modules ./node_modules
COPY . .
EXPOSE ${PORT}
USER node
CMD ["npm", "run", "start"]

# # --- Development stage ---

# ARG PORT=3033
# ARG NODE_ENV=production

# # --- Base dependencies (production) ---
# FROM node:20-slim AS deps-prod
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci --omit=dev

# # --- Base dependencies (development/test) ---
# FROM node:20-slim AS deps-dev
# WORKDIR /app
# COPY package*.json ./
# RUN npm ci

# # --- Development stage ---
# FROM node:20-slim AS development
# ENV NODE_ENV=development
# WORKDIR /app
# COPY --from=deps-dev /app/node_modules ./node_modules
# COPY . .
# EXPOSE ${PORT}
# CMD ["node", "src/index.js"]

# # --- Test stage ---
# FROM node:20-slim AS test
# ENV NODE_ENV=test
# WORKDIR /app
# COPY --from=deps-dev /app/node_modules ./node_modules
# COPY . .
# CMD ["npm", "run", "test"]

# # --- Production stage ---
# FROM node:20-slim AS production
# ENV NODE_ENV=production
# WORKDIR /app
# COPY --from=deps-prod /app/node_modules ./node_modules
# COPY . .
# EXPOSE ${PORT}
# CMD ["node", "src/index.js"]

