# Management Report Builder

Builds the **HSIN board meeting management report** in the same layout as the HySp Tianjin
(China) board report and exports it as an editable PowerPoint.

- 52-page India template (sales, production, procurement, QHSE, finance, IT, P&C, strategy,
  forecast/budget, OEM pages). Every text, table, chart and image is editable.
- **Page-wise entry:** fill every page in order, with its page number and header. Comments,
  table cells and chart values are typed or pasted from Excel. Images are uploaded, dropped
  or pasted (Ctrl+V) into each slot and can be moved by location preset or exact position.
- Untick a page to leave it out (page numbers renumber), or delete, duplicate and reorder pages.
- **Export PPTX:** 16:9 deck with the board-report backgrounds, real PowerPoint charts and tables.
- Reports are saved automatically in Supabase. Images are stored in a private bucket. Several
  people can work on the app; if two people edit the same report, the second saver is asked to
  reload or overwrite.

## Stack

Next.js 16 (App Router), React 19, TypeScript strict, Tailwind CSS 4 with the HydraSpecma brand
kit (from `webdev-coding-templates`), Supabase (Auth, Postgres with RLS, Storage), Vercel.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in the Supabase URL and publishable key
npm run dev
```

Checks: `npm run lint && npm run typecheck && npm test && npm run build`.

## Access

Sign-in is email + password for @hydraspecma.com addresses. Being signed in is not enough: an
admin adds people on **Members** (viewer, editor or admin). The database enforces this.

## Supabase settings (dashboard, one-time)

Authentication → URL Configuration:

- **Site URL:** the production URL, e.g. `https://management-report-builder.vercel.app`
- **Redirect URLs:** add `https://management-report-builder.vercel.app/auth/callback` and
  `http://localhost:3000/auth/callback`

Without these, links in confirmation and password-reset emails open `localhost`.

## Moving to Microsoft Entra sign-in later

Ask IT for an Entra app registration (single tenant, redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`). Enable the Azure provider in Supabase
Auth with the tenant URL, then replace the email form in `src/components/auth/SignInForm.tsx`
with `supabase.auth.signInWithOAuth({ provider: "azure" })`. The `mr_members` roles stay as they are.

## Database

Schema, policies and the storage bucket are in `supabase/migrations/`.
