# Homework App

Homework App is a local-first web app foundation for development on Mark's local machine. It is intentionally independent of SharePoint, Supabase, Vercel-specific hosting, authentication, and production database hosting at this stage.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- PostgreSQL for local development
- Prisma for database schema, migrations, and client access

## Prerequisites

Install these tools before running the app locally:

- Node.js 20 or newer with npm
- Docker Desktop, Rancher Desktop, or another Docker Compose-capable runtime

## Local setup

From a clean clone, install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

The example uses a local-only PostgreSQL connection string for the Docker Compose database. Do not commit `.env` because it is for machine-specific values and secrets.

## Start PostgreSQL locally

Start the local PostgreSQL service:

```bash
docker compose up -d postgres
```

Check that Docker reports the service as running and healthy:

```bash
docker compose ps
```

Stop the database when you are done:

```bash
docker compose down
```

To stop the database and delete the local PostgreSQL volume, run:

```bash
docker compose down -v
```

## Prisma commands

Generate the Prisma client after installing dependencies or changing the schema:

```bash
npm run prisma:generate
```

Apply committed migrations to the local database:

```bash
npm run prisma:deploy
```

During development, create and apply a new migration after editing `prisma/schema.prisma`:

```bash
npm run prisma:migrate -- --name describe_change_here
```

Open Prisma Studio for local database inspection:

```bash
npm run prisma:studio
```

## Database connection check

After PostgreSQL is running, dependencies are installed, `.env` exists, and migrations are applied, verify that Prisma can connect:

```bash
npm run db:check
```

The command should print `Database connection OK` with a simple query result.

## Run locally

Start the development server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in your browser. The homepage should show the title **Homework App**.

## Checks

Run linting:

```bash
npm run lint
```

Create a production build:

```bash
npm run build
```

## Environment variables

Copy `.env.example` to `.env` for local development. The required variable is:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string used by Prisma. |
