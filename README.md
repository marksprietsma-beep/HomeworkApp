# Homework App

Local-first homework app foundation.

## Prerequisites

- Docker Desktop or another Docker-compatible runtime with Docker Compose support.
- Node.js 20 or newer and npm.

## Local database

This repository includes a Docker Compose PostgreSQL service for local development. It uses non-secret local-only credentials from `.env.example`.

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Start PostgreSQL:

   ```bash
   docker compose up -d postgres
   ```

3. Install Node dependencies:

   ```bash
   npm install
   ```

4. Generate the Prisma client:

   ```bash
   npm run prisma:generate
   ```

5. Apply the initial migration:

   ```bash
   npm run prisma:deploy
   ```

   To create a new development migration after changing `prisma/schema.prisma`, run:

   ```bash
   npm run prisma:migrate -- --name your_migration_name
   ```

6. Check the database connection:

   ```bash
   npm run db:check
   ```

7. Optional: open Prisma Studio:

   ```bash
   npm run prisma:studio
   ```

## Stopping the database

Stop the local PostgreSQL container while keeping its data volume:

```bash
docker compose down
```

Remove the local database volume and all PostgreSQL data:

```bash
docker compose down -v
```

## Database schema scope

The initial Prisma schema intentionally contains only a minimal `LocalDatabaseCheck` model. The full homework product data model, authentication, student UI, and production hosting are out of scope for this baseline.
