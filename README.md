# Homework App

Homework App is a local-first web app foundation for development on Mark's local machine. It is intentionally independent of SharePoint, Supabase, Vercel-specific hosting, authentication, and database setup at this stage.

## Tech stack

- Next.js App Router
- TypeScript
- Tailwind CSS

## Local setup

From a clean clone, install dependencies:

```bash
npm install
```

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

No environment variables are required for the current local-first foundation, so there is no `.env.example` yet.
