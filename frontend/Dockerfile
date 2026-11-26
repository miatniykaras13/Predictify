FROM node:24.22.3@sha256:49f7adaf9f1574bc45c20ea317139b39a59d7e758d0e93745e112fd85cb42623 AS development
WORKDIR /app

COPY package.json package-lock.json ./
COPY frontend/package.json ./frontend/
RUN npm ci --workspace frontend --include-workspace-root
COPY frontend/ ./frontend/

FROM development AS preview
RUN npm run build -w frontend
CMD ["npm", "run", "preview", "-w", "frontend", "--", "--host", "0.0.0.0", "--port", "5173", "--strictPort"]
