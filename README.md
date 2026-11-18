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

There is **no self sign-up**. An admin creates each account on the **Users** page (work email,
name, role, temporary password) and hands over the temporary password. At first sign-in the user
must choose their own password. Roles: viewer (open, export), editor (also create and change),
admin (also delete reports and manage users). The database enforces all of this.

If the person already has a login from another app in the same Supabase project, the app only
grants access and keeps their existing password. Admins can reset passwords only for accounts
this app created; everyone else uses "Forgot password".

## Supabase settings (dashboard, one-time)

Authentication → URL Configuration:

- **Site URL:** the production URL, e.g. `https://management-report-builder.vercel.app`
- **Redirect URLs:** add `https://management-report-builder.vercel.app/auth/callback` and
  `http://localhost:3000/auth/callback`

Without these, links in password-reset emails open `localhost`. Public sign-up stays enabled
in Supabase because other apps in the project use it; this app has no sign-up screen, and a
login without a member entry gets no access.

## Moving to Microsoft Entra sign-in later

Ask IT for an Entra app registration (single tenant, redirect URI
`https://<project-ref>.supabase.co/auth/v1/callback`). Enable the Azure provider in Supabase
Auth with the tenant URL, then replace the email form in `src/components/auth/SignInForm.tsx`
with `supabase.auth.signInWithOAuth({ provider: "azure" })`. The `mr_members` roles stay as they are.

## Database

Schema, policies and the storage bucket are in `supabase/migrations/`.
