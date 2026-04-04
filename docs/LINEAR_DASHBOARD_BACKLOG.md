# Dashboard backlog (Linear — Ad blocker extension)

Local reference for **admin dashboard** work tracked in Linear.  
Workspace: [extension-project](https://linear.app/extension-project) · Team: **Team Rishabh_s** (`EXT`).

Last synced from Linear: **2026-03-21** (re-query Linear when planning sprints).

---

## Active & review

| ID | Status | Title | Link |
|----|--------|--------|------|
| EXT-20 | In Progress | Dashboard: browser & OS, CSV export | [linear](https://linear.app/extension-project/issue/EXT-20/need-to-add-in-dashboard) |
| EXT-21 | In Progress | Analytics, persona, tags (dashboard/backend scope) | [linear](https://linear.app/extension-project/issue/EXT-21/feature-request) |
| EXT-14 | In Review | Admin dashboard — users, notifications CRUD, platform ads | [linear](https://linear.app/extension-project/issue/EXT-14/dashboard-view-for-admin-control) |

**Note:** EXT-14 references HTML injection presets → **EXT-78**.

---

## Todo (dashboard-titled issues)

| ID | Title | Link |
|----|--------|------|
| EXT-78 | HTML injection presets for admins | [linear](https://linear.app/extension-project/issue/EXT-78/dashboard-make-html-injection-easier-for-admin-presets) |
| EXT-76 | Improve campaign settings (UX + behavior) | [linear](https://linear.app/extension-project/issue/EXT-76/dashboard-improve-campaign-settings) |
| EXT-75 | Settings tab — user subscriptions / days & expiry | [linear](https://linear.app/extension-project/issue/EXT-75/dashboard-settings-tab-for-user-subscriptions-days-update) |
| EXT-74 | Redirect tab — campaign redirects + backend rules | [linear](https://linear.app/extension-project/issue/EXT-74/dashboard-redirect-tab-for-direct-redirects-campaign) |
| EXT-79 | Track active users per site (local + push to backend) | [linear](https://linear.app/extension-project/issue/EXT-79/dashboard-track-active-users-on-specific-websites) |

---

## Suggested order (dashboard-only)

1. Close **EXT-14** (review → Done): defines the core admin surface.
2. Ship **EXT-20** in slices: CSV first if data already exists; browser/OS only after telemetry exists (see below).
3. **EXT-78** then **EXT-76** — presets and campaign UX build on stable CRUD.
4. **EXT-75** — needs a clear subscription model in DB + API (not present in schema as of this doc).
5. **EXT-74** / **EXT-79** — cross-cutting (redirect rules; per-site visit stream from extension).

**EXT-21** runs as a parallel track: persona/analytics is larger; break into milestones in Linear.

---

## Codebase reality check (this repo)

- **`enduser_events`** rows: `enduser_id`, `campaign_id`, `domain`, `type`, `country`, `status_code`, timestamps — **no `user_agent` / OS fields** yet.  
  So **“browser & OS”** for extension end users implies: extension (or API) sends UA → DB migration → dashboard columns/filters.
- **Auth `session`** has `user_agent` (255) for **logged-in dashboard users**, not extension end users — useful only if you decide to show “last admin device,” not EXT-20 as written.
- No dedicated **subscription / trial expiry** table for extension users → **EXT-75** is schema + API + UI, not a small patch.

---

## Low-hanging tasks (smallest safe wins)

These are intentionally **small** and mostly **dashboard or API-without-new-domains**. Re-validate against `main` before picking up.

1. **CSV export (EXT-20, partial)**  
   Export current **Visitors** (or **Analytics**) table data as CSV from existing queries — no new tables if you only export what the page already loads.

2. **Review checklist for EXT-14**  
   Document or tick: routes, auth, CRUD happy paths, platform-specific ads edge cases — unblocks marking review done.

3. **Campaign settings polish (EXT-76, partial)**  
   Copy, validation messages, disabled states, consistent spacing — without new campaign types or redirect logic.

4. **HTML injection presets — MVP (EXT-78, partial)**  
   Start with a **fixed list** of named presets (config or seed table) + dropdown that fills the editor — full custom preset CRUD can follow.

5. **Empty and error states**  
   On dashboard list pages: explicit “no data” and retry for failed fetches — quick UX win across admin.

6. **Internal doc links**  
   Point relevant pages or `docs/` sections to **EXTENSION_API_REFERENCE.md** / **DATABASE.md** so admins and future you align with the extension contract.

### Not low-hanging (without extra design work)

- **Browser & OS for extension users** — needs **EXT-20** telemetry + migration (see above).
- **EXT-75** subscriptions — needs data model for “plan / expiry per end user.”
- **EXT-74** redirect campaigns — new rules engine + extension behavior.
- **EXT-79** per-site activity — extension batching + new storage/API surface.
- **EXT-21** full persona system — multi-feature analytics backend.

---

## Related (not dashboard UI)

- **EXT-81** — notification targeting bug (likely API/extension logic); fix may not add dashboard screens.
- **EXT-26** — CORS for extension origins (backend).

When in doubt, confirm scope in the Linear issue description before coding.
