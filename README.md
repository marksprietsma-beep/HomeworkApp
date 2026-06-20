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

## Seed local development data

After PostgreSQL is running and migrations are applied, seed a small fake development dataset:

```bash
npm run db:seed
```

The seed is safe to rerun. It uses stable fake `example.test` email addresses and updates the same records instead of creating duplicates. After seeding, the local database should contain:

- one teacher-like development user: `Dev Teacher <teacher.dev@example.test>`
- three student-like development users: `Ada Student`, `Ben Student`, and `Cleo Student`
- one class: `Development Maths Class`
- class enrolments linking all three students to `Development Maths Class`

To reset local data completely before reseeding, stop PostgreSQL and delete the local Docker volume, then start PostgreSQL again, apply migrations, and seed:

```bash
docker compose down -v
docker compose up -d postgres
npm run prisma:deploy
npm run db:seed
```

Mark can confirm the seed worked by opening Prisma Studio and checking the `User`, `Class`, and `ClassEnrollment` tables:

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

## Core product data model

The first homework workflow model extends the local development `User`, `Class`, and `ClassEnrollment` tables without adding authentication or UI.

- `User` still represents a simple local teacher or student. Teachers can own classes and create homework assignments. Students can be enrolled in classes and create submissions.
- `Class` is teacher-managed and now has many `HomeworkAssignment` records.
- `HomeworkAssignment` belongs to one class, is created by one teacher user, and stores a title, optional description, optional due date, and simple status (`DRAFT`, `PUBLISHED`, or `ARCHIVED`).
- `HomeworkQuestion` stores ordered questions for an assignment. Each question has a prompt, a simple text `questionType`, and optional points. The ordered question rows keep the generated homework structure queryable without introducing a complex parser yet.
- `Submission` belongs to one assignment and one student. A student can have one submission per assignment, with simple status (`DRAFT` or `SUBMITTED`) and an optional submission timestamp.
- `SubmissionAnswer` stores one answer for a submission and can link back to the relevant homework question. The question link is optional so answers can be retained if a question is later removed.

The seed data includes one fake published homework assignment with two text questions and one submitted example answer set for the first development student. This is only for local model testing and can be reseeded safely.
