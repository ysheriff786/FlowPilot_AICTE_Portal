# Build the React bundle and the Prisma client for PostgreSQL.
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npx prisma generate --schema prisma/schema.postgres.prisma

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Prisma's query engine needs OpenSSL on Alpine.
RUN apk add --no-cache openssl

# Runtime dependencies include tsx (runs the TypeScript server) and the Prisma
# CLI (creates/updates the PostgreSQL schema on start). A placeholder URL is
# only needed so `prisma generate` can resolve the datasource during build; the
# real DATABASE_URL is supplied by the platform at runtime.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci --omit=dev && npx prisma generate --schema prisma/schema.postgres.prisma

COPY --from=build /app/dist ./dist
COPY --from=build /app/src ./src
COPY --from=build /app/tsconfig.json ./tsconfig.json

EXPOSE 5000
CMD ["sh", "-c", "npx prisma db push --schema prisma/schema.postgres.prisma --skip-generate && npm start"]
