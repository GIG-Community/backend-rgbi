# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

WORKDIR /usr/src/app

# Install production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source
COPY . .

ENV NODE_ENV=production

EXPOSE 5000

CMD ["node", "app.js"]
