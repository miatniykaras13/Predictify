FROM node:24.22.3@sha256:49f7adaf9f1574bc45c20ea317139b39a59d7e758d0e93745e112fd85cb42623 AS base
WORKDIR /app
COPY package.json package-lock.json ./

FROM base AS development
RUN npm ci
COPY tsconfig.json ./
COPY src/ ./src/
COPY migrations/ ./migrations/
COPY test/ ./test/

FROM development AS build
RUN npm run build

FROM base AS runtime
ENV NODE_ENV=production
RUN npm ci --omit=dev
COPY --from=build /app/dist/src ./dist/src/
CMD ["node", "dist/src/server.js"]
