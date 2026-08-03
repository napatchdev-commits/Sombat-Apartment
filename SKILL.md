---
name: sombat-apartment
description: Use this skill whenever working on the "Sombat Apartment" hostel-management web app (Sombat_Apartment_Supabase project) — the admin app (index.html/app.js), the tenant portal (tenant.html/tenant-app.js), or its Supabase backend (schema, RPC functions, LINE bot Edge Function). Trigger for any request to add a feature, fix a bug, change the data model, add a new field/table, touch billing/invoice logic, or debug sync issues in this specific codebase.
---

# Sombat Apartment — Project Skill

หอพักสมบัติ นนทบุรี — ระบบจัดการหอพัก (ห้อง/ผู้เช่า/บิล/ซ่อม/บัญชี) + พอร์ทัลผู้เช่า, backend เป็น Supabase

## Read this first, always
Before editing anything, `view` these two things:
1. `app.js` — search for the feature area you're touching (grep the relevant Thai/English label or field name; file is 6000+ lines, one big set of static-method classes, no build step).
2. The current Supabase schema (`1_schema.sql` if present in the project, or ask the user to paste `information_schema` output) — **do not assume table shapes from memory**, the schema evolves (see "Schema history" below).

There is **no bundler/build step**. `index.html` loads `app.js` + `tenant-style.css`/`style.css` directly as plain `<script>` tags. Every class is `static`-only (no instances). Edit files directly; no npm install needed for the frontend.

## Architecture map

| File | Role |
|---|---|
| `index.html` | Admin app shell, loads `app.js` |
| `app.js` | Entire admin app: `DBService`, `AuthService`, `LoggerService`, `PromptPayService`, `LineService`, `ExportService`, then one class per UI module (`RoomsComponent`, `TenantsComponent`, `InvoicesComponent`, `RepairsComponent`, `LedgerComponent`, `CalendarComponent`, `SettingsComponent`, `App`, `LoginComponent`, ...). All static classes. |
| `tenant.html` | Tenant portal shell, loads `tenant-app.js` |
| `tenant-app.js` | Tenant-facing app: `TenantDBService` (talks to Supabase **only via RPC**, never direct table reads), `MyBillsApp` (UI) |
| `style.css` / `tenant-style.css` | Styling for admin / tenant portal respectively |
| `supabase/functions/line-notify/index.ts` | Supabase Edge Function — replaces the old Google Apps Script `Code.gs`. Handles (1) admin "ส่ง LINE Bot" button → LINE broadcast, (2) inbound LINE webhook → auto-reply |
| `manifest.json`, `sw.js`, `icons/` | PWA scaffolding, rarely relevant |

Two independent frontends share the same Supabase project but access it differently:
- **Admin (`app.js`)**: reads/writes tables **directly** via PostgREST (`/rest/v1/{table}`), using the "admin" anon key (`getSavedApiKey()`).
- **Tenant portal (`tenant-app.js`)**: **only** calls 4 RPC functions (`get_room_list`, `get_tenant_bill`, `submit_tenant_payment`, `submit_tenant_repair`) via `/rest/v1/rpc/...`, using a separate restricted "tenant" anon key (`getSavedTenantApiKey()`). This is intentional (limits blast radius of the tenant-facing key) — **never** make tenant-app.js read tables directly; add/modify an RPC instead.

## Data model — normalized per-category tables (NOT a single JSON blob)

⚠️ **Schema history, important for context:** this project originally stored *everything* (rooms, tenants, invoices, ledger, repairs, settings, users — the works) as one JSON blob in a single row of a table called `apartment_state` (`{id:1, state: {...}}`). Every save overwrote the entire blob, which caused data collisions between concurrent users and had no real duplicate-invoice protection. This was refactored into per-category tables (see below). **If a user says "it still writes everything as one blob" or you see code hitting `/rest/v1/apartment_state`, that's the OLD pattern — flag it, it means changes reverted or an old version is in play.**

Current tables (see `1_schema.sql` for full DDL if present in the project):

- `settings`, `rates` — singleton rows, `id = 1`
- `users`, `room_types`, `rooms` — one row per record
- `tenants` — includes `deposit_amount` / `deposit_status` as **plain columns**, NOT nested JSON
- `tenant_documents` — id-card copy / house-registration copy / other files, **one row per document**, FK `tenant_id`
- `tenant_deposit_deductions` — deposit deduction line items, FK `tenant_id`
- `invoices` — **`UNIQUE(room_id, month_key)`** is the anti-duplicate-billing guarantee. Never add a second way to key invoices; always upsert against this constraint when generating bills.
- `repairs`, `ledger`, `events` — one row per record

RLS: all tables have an `"allow all"` policy (`using (true) with check (true)`) to match the original fully-open anon-key model. If asked to tighten security, that policy is the place to change — but changing it will likely break the app's current no-login-to-DB assumption, so confirm with the user first.

### In-memory shape stays the same as the old blob (important!)
`DBService.getState()` / the `state` object used throughout `app.js` still looks like the old blob shape (`state.rooms`, `state.tenants`, `state.invoices`, `state.tenants[i].documents`, `state.tenants[i].deposit.deductions`, etc.) — **this was preserved on purpose** so the ~6000 lines of UI code (which read/mutate `this.state.rooms.push(...)`, `tenantToEdit.deposit.initialBail = ...`, etc.) didn't need to change. Only `DBService`'s persistence layer (`pullFromSupabase` / `syncToSupabase`) was rewritten to flatten/reconstruct between this nested JS shape and the normalized DB tables.

**Implication for future work:** when adding a new field or entity,
1. Decide the DB column/table first.
2. Add it to the relevant `fields` mapping in `DBService.getTableConfigs()` / `getSingletonConfigs()` / `getNestedTenantConfigs()` (JS-camelCase ↔ db-snake_case pairs) in `app.js`.
3. Only then wire it into the UI component — the UI still just reads/writes `this.state.xxx` like before.

## Sync mechanism (DBService in app.js) — read before touching persistence

`DBService.saveState(state)` is called after every mutation throughout the UI code (e.g. `this.state.rooms.push(newRoom); DBService.saveState(this.state);`). It still writes a full local cache to `localStorage` (`STORAGE_KEY`), same as before. The Supabase part now:

1. `syncToSupabase(url, state)` loads a snapshot (`SNAPSHOT_KEY` in localStorage) of `{key: {id, json}}` per category from the *last successful sync*.
2. For each category, diffs current rows vs snapshot by a `keyFn` (defaults to `id`; **invoices use `roomId::monthKey`** so that regenerating a bill — which creates a brand-new client-side `id` each time — still upserts into the *same* DB row instead of creating a duplicate).
3. Only changed/new rows are POSTed (bulk upsert, `Prefer: resolution=merge-duplicates`, `on_conflict=<table's unique key>`). Rows whose key disappeared from state get DELETEd from the DB.
4. `tenant.documents` / `tenant.deposit.deductions` are flattened out of each tenant into their own flat arrays (injecting `tenantId`) before the same diff-and-sync treatment against `tenant_documents` / `tenant_deposit_deductions`.
5. `settings` / `rates` are singleton upserts (`id: 1`), always sent (low risk, low volume).
6. On success, the new snapshot is saved. **If a request fails, the snapshot is NOT updated**, so the next save retries the same diff — don't "fix" a failed sync by clearing the snapshot unless you mean to force a full re-push.

`pullFromSupabase(url)` does the inverse: fetches every table in parallel, converts snake_case rows back to the camelCase JS shape, reconstructs nested `documents`/`deposit.deductions` into each tenant, and rebuilds the snapshot so subsequent saves diff correctly.

**Gotcha:** if you add a brand-new top-level state array (a new "sheet"), you must add it to *both* `getTableConfigs()` (or `getNestedTenantConfigs()` if it's nested under another entity) — pull and save share the same config, so one entry handles both directions.

## Adding a new field to an existing entity — checklist
1. Add the column to the SQL table (write a small `alter table ... add column ...` migration snippet for the user to run in Supabase SQL Editor — don't silently assume they'll regenerate the whole schema).
2. Add `[jsCamelCase, db_snake_case]` to that entity's `fields` array in the matching `DBService` config.
3. Update wherever the entity is created/edited in the UI component (search `this.state.<entity>` in `app.js`).
4. If the tenant portal needs to see it, add it to the relevant RPC function's `json_build_object(...)` in the schema SQL — tenant-app.js only ever gets what the RPC explicitly returns.

## Billing / invoice logic gotchas
- Invoice numbers are generated as `` `INV${monthKey.replace('-','')}-${room.name}` `` — human-readable but **not** the uniqueness key; `(room_id, month_key)` is.
- Bulk bill generation (`InvoicesComponent`, look for `existingIdx`/`invoiceObj`) always creates a **new** `id` even when overwriting an existing bill for the same room+month — this is intentional/known, the sync layer's `roomId::monthKey` keyFn handles it (see above). Don't "fix" this by trying to preserve the old id unless you also update the sync keyFn accordingly.
- `DBService.getUniqueInvoices()` is a legacy client-side dedupe safety net (kept for defense-in-depth); the real guarantee is the DB `UNIQUE(room_id, month_key)` constraint.

## LINE bot
Admin's "ส่ง LINE Bot แจ้งเตือน" button calls `${supabaseUrl}/functions/v1/line-notify` (Supabase Edge Function), not Google Apps Script. The same Edge Function also receives LINE's inbound webhook. Secrets (`LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`) are Supabase secrets, not in code. Deploy with `supabase functions deploy line-notify --no-verify-jwt`.

## Language & tone
UI strings, comments, and user-facing text are Thai. Match existing tone/terminology when adding UI text (e.g. ห้องเช่า, ผู้เช่า, ใบแจ้งหนี้, มัดจำ) rather than introducing new terms for the same concepts.

## Before shipping any change
- Run `node --check app.js` (and `tenant-app.js`) — no build step means syntax errors would otherwise only surface in-browser.
- If you touched the DB schema, write/update a small numbered `.sql` migration file rather than editing schema in place, so the user has something to run in Supabase SQL Editor.
- If you touched `DBService`'s table configs, sanity-check both directions: does a fresh `pullFromSupabase` reconstruct the same shape the UI expects, and does `syncToSupabase` round-trip it back correctly?
