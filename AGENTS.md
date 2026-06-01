# Repository Guidelines

## Project Structure & Module Organization

Scribix is a Next.js App Router project deployed through OpenNext on Cloudflare. Routes, pages, layouts, and API handlers live under `app/`; localized pages use `app/[locale]/...`, and endpoints use `app/api/.../route.ts`. Shared UI is in `app/components/`, with upload pieces in `app/components/upload/` and marketing sections in `app/components/marketing/`. Core utilities live in `lib/`, auth in `auth.ts`, i18n helpers in `i18n/`, translations in `messages/*.json`, D1 migrations in `migrations/`, worker code in `crons/`, and operational notes in `docs/`.

## Build, Test, and Development Commands

- `npm run dev`: start the Next.js dev server using webpack.
- `npm run build`: run the production Next.js build; use this as baseline validation.
- `npm run start`: serve a previously built Next.js app.
- `npm run preview`: build with OpenNext and preview on Cloudflare using remote bindings.
- `npm run deploy`: build and deploy the Cloudflare app.
- `npm run cf-typegen`: regenerate `cloudflare-env.d.ts` from Wrangler bindings.
- `npm run db:migrate:local`: apply D1 migrations locally.
- `npm run db:migrate:remote`: apply D1 migrations to remote D1.
- `npm run deploy:cleanup`: deploy the cleanup worker from `wrangler.cleanup.jsonc`.

## Coding Style & Naming Conventions

Use TypeScript with `strict` enabled and the `@/*` path alias for root imports. Follow existing two-space indentation, double-quoted strings, named exports, and PascalCase component filenames such as `TranscriptViewer.tsx`. Route handlers export HTTP methods from `route.ts`. Add `"use client"` only where browser APIs or hooks require it. Reuse Tailwind tokens such as `bg-paper`, `border-line`, and `font-display`.

## Testing Guidelines

There is no dedicated test runner or `npm test` script. For changes, run `npm run build` and manually verify affected flows in `npm run dev`, especially upload, recording, transcript status/export, billing, auth, and localized pages. If adding tests, colocate them near the code or use `__tests__/`, name files `*.test.ts` or `*.test.tsx`, and add the command to `package.json`.

## Commit & Pull Request Guidelines

Recent history uses short imperative commits, often Conventional Commit prefixes such as `feat:` and `fix:`; keep that style, for example `feat: add transcript export panel`. Pull requests should include a concise summary, validation steps, linked issue or context, screenshots for UI changes, and notes for Cloudflare, D1, R2, auth, or environment-variable changes.

## Security & Configuration Tips

Do not commit secrets or local credential files such as `worker-secrets.env`. Treat `wrangler.jsonc`, `wrangler.cleanup.jsonc`, migrations, and `cloudflare-env.d.ts` as deployment-sensitive; update generated types after binding changes and document required remote migrations in the PR.
