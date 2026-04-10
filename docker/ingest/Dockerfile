FROM node:22-alpine AS base

WORKDIR /app

COPY docker/ingest/package.json ./package.json
COPY docker/ingest/tsconfig.json ./tsconfig.json
COPY docker/ingest/src ./src

RUN npm install
RUN npm run build

EXPOSE 8787

CMD ["npm", "start"]
