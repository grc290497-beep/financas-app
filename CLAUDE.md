# CLAUDE.md

Personal finance tracker (web app / PWA). Multi-user, EUR + BRL. **Full spec and roadmap: `PLAN.md`. Read it before starting any phase.**
**Current status, setup on a new machine and required skills/plugins: `HANDOFF.md`. Read it first.**

## Working rules
- Work **one phase at a time**, in the order of PLAN.md §8. Don't start the next phase without being asked.
- At the end of each phase run `npm run lint`, `npm run typecheck` and `npm test`, then summarize what changed and what the user must do manually.
- UI text in **Portuguese (pt-BR)** via next-intl message files; code, comments and commits in English.
- Ask before adding a dependency that isn't listed in PLAN.md §2.

## Stack
Next.js (App Router) + TypeScript (strict) · Tailwind + shadcn/ui · Supabase (Postgres, Auth, RLS) via `@supabase/ssr` · react-hook-form + zod · Recharts · date-fns · next-intl · Vitest + Playwright · Vercel.

## Non-negotiables
- **Money is integer cents (`bigint`)**, never float. Do all money math in `lib/money.ts`.
- Every transaction stores its original `amount_cents` + `currency`, plus `fx_rate` and `amount_primary_cents` frozen at entry time.
- FX comes from the Frankfurter API (ECB) and is cached in `fx_rates`. All FX logic lives in `lib/fx.ts`.
- The financial month follows `profiles.month_start_day`. All period logic lives in `lib/period.ts`.
- **RLS is enabled on every table** (`user_id = auth.uid()`). Every new table needs its policies in the same migration.
- `SUPABASE_SERVICE_ROLE_KEY` is server-only and never imported in client components.
- Validate every Server Action input with zod (shared schemas in `lib/validators.ts`).
- Schema changes go in a new migration under `supabase/migrations/`; never edit an applied migration.
- Recurring generation must be idempotent (unique `recurring_item_id + occurred_on`).

## Testing
- Unit-test all of `lib/money.ts`, `lib/fx.ts`, `lib/period.ts` and `lib/goals.ts`, including edge cases (rounding, month_start_day = 28, February, leap years, negative contributions).
- Add an RLS test proving user A cannot read or modify user B's rows.

## UX
- Mobile-first. The quick-add "+" sheet must let the user log an expense in under 10 seconds.
- Format currency with `Intl.NumberFormat` (`pt-BR` locale: `€ 12,50`, `R$ 80,00`).
- Always show empty states, loading skeletons and friendly error messages.

## Commands
```
npm run dev        # local dev
npm run lint
npm run typecheck  # tsc --noEmit
npm test           # vitest
npm run test:e2e   # playwright
supabase db push   # apply migrations
```
