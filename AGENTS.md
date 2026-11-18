# HydraSpecma development rules

These rules apply to every HydraSpecma web app, whoever writes the code: a developer, a citizen
developer, Claude, Copilot or Lovable. Stack-specific rules follow further down.

## Way of working

1. **Understand** the request and read the code it touches before changing anything.
2. **Plan**: for anything bigger than a small fix, say what you will change and why, and wait for
   approval.
3. **Build** in small steps that keep the app working.
4. **Verify**: run the checks under *Definition of done* and report the real result. If something
   fails or was skipped, say so.

- Never push, merge, deploy or change Azure resources unless the user explicitly asks you to.
- Never rewrite published git history: no force-push, and no rebase, amend or squash of commits
  that are already pushed.
- Ask when a requirement is unclear instead of guessing. Make conventional choices yourself and
  mention them.

## Code

- **No duplicated code.** Extract shared logic into one helper: query fragments, mappers,
  validation and message building. Logic must only be maintained in one place.
- Match the surrounding code: naming, comment density and idioms. Prettier settings are in
  `.prettierrc`.
- TypeScript is `strict`. Don't use `any` or `@ts-ignore` to silence an error; fix the type.
- Keep comments for *why*, not *what*.

## Design (HydraSpecma brand)

- Use the brand components in `src/components/brand/` (Button, Card, PageTitle, StatusBadge,
  `inputClasses` for form controls, …) and the Tailwind brand utilities: `bg-brand-yellow`,
  `text-ink`, `border-line`, `text-status-green`, …
- **Never hard-code hex colours, fonts or radii.** All of them come from
  `src/styles/brand/hydraspecma.css`. If a colour is missing, ask; don't invent one.
- The brand follows the HydraSpecma Corporate Design Guide (the "HydraSpecma Design System"
  project in claude.ai/design):
  - **Black and yellow.** Yellow is an accent (buttons, section tags, underlines), never a
    large fill and never text on white.
  - **Roboto Light** is the default text. Use Medium for emphasis, Roboto Slab (`font-slab`)
    for lead paragraphs and Roboto Mono (`font-mono`) for part numbers and data.
  - **Square corners** by default. 2–4px only on small widgets, and pills only for tags.
  - **The 10° skew** appears only on the yellow section tag (`<Eyebrow>`), never on buttons.
  - Buttons and labels are UPPERCASE. Headings and body text use sentence case, never Title
    Case. Text is left-aligned.
  - **Market-area and segment colours** (`market-*`, `segment-*`) tag content that belongs to
    that market or segment. Never use them for decoration.
  - **Off-brand:** emoji, gradients, drawn illustrations and glassmorphism.
- Pages must work on a phone (from 320px) and be keyboard accessible. Every image needs `alt`
  text, and colour is never the only signal.
- The files in `src/components/brand/` and `src/styles/brand/` come from the
  `webdev-coding-templates` repo. Change brand-wide things there, not in a single app.

## Security

- **No secrets in the repo, and no secrets or tokens in logs.** Local values go in `.env`, which is
  git-ignored. `.env.example` lists the variable names only.
- Never expose a secret to the browser: no `NEXT_PUBLIC_` or `VITE_` prefix on secrets.
- Sign-in is Microsoft Entra ID, single tenant (HydraSpecma). Never use the `/common` or
  `/organizations` endpoints.
- **Authorisation is enforced on the server.** Hiding a button is not security. Every API route,
  server action and server function that reads or changes data checks the user's role itself.
  In a browser-only app (SPA), role checks are cosmetic: the API it calls must validate the
  token and authorise every request.
- Deny by default: new pages and API routes are protected unless they are deliberately made public.
- APIs answer 401 (not signed in) or 403 (not allowed) as JSON, never with a redirect.
- Validate all input on the server (zod). Use parameterised queries only.
- Roles come from Entra group membership: `viewer` < `editor` < `admin`. The group ids are
  configuration, never code.

## Definition of done

Run these before you say a task is done, and report the result:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- Add or update a test when you change logic: roles, validation, data mapping.
- For UI changes, describe what you checked in the browser, and attach screenshots to the PR.

## Git and pull requests

- Work on a branch: `feature/<short-name>` or `fix/<short-name>`.
- Commit messages are short and imperative, optionally with a ticket prefix:
  `ID-1234 Add approval page`.
- A PR says what changed, why, which checks ran, and links the work item. Mention any new
  environment variables or Entra changes.

## Backstage catalog

- `catalog-info.yaml` describes this app in Backstage. Keep it up to date when the owner,
  dependencies, data classification or application roles change.
- `metadata.name` is lowercase kebab-case. `spec.owner` always has the `group:` prefix.
- All options are documented in `catalog-info.reference.yaml` in the `webdev-coding-templates`
  repo.

## Azure and infrastructure

- Apps run on Azure App Service (Linux, Node 22) or Azure Static Web Apps, built by Azure DevOps
  (`azure-pipelines.yml`).
- Resources are created through the `infrastructureascode` repo (Bicep) by IT. Don't create
  resources by hand. Names follow `<type>-<app>-<env>-<region>-<nn>`, for example
  `app-myapp-dev-westeu-01`.
- Use managed identity (`DefaultAzureCredential`) for Azure SQL, Storage and Key Vault. Avoid
  connection strings with passwords.

## This app: Management Report Builder

Deviations from the standard template, agreed with the product owner:

- **Hosting:** Vercel (team `hydra-specma`), not Azure App Service.
- **Data and sign-in:** Supabase (shared project; every object is prefixed `mr_`). Email and
  password sign-in limited to @hydraspecma.com until IT registers an Entra app; then switch the
  Supabase Auth provider to Azure (Entra) and keep the `mr_members` role table.
- **Authorisation** is enforced by row-level security in `supabase/migrations/`. Roles live in
  `public.mr_members` (viewer < editor < admin), mirrored in `src/lib/auth/roles.ts`.
- **Editor engine:** `public/editor/` is plain browser JavaScript (slide model, preview and
  PowerPoint export with a bundled PptxGenJS). React mounts it in
  `src/components/editor/ReportEditor.tsx` and gives it a store (`store.ts`) that saves to
  Supabase. Keep the slide model framework-free; UI styling lives in `editor.css` and uses brand
  tokens only.
- `public/editor/pptxgen.bundle.js` is PptxGenJS 3.12.0 with two small patches: bullet colour
  (`bullet.color`) and ZIP compression for `write({ outputType: "blob" })`.
