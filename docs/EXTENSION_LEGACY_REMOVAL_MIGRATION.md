# Extension migration: legacy API removal (handoff for extension / client teams)

This document explains **what the admin dashboard removed**, **why**, and **exactly what the browser extension (or any other client) must do instead**. Share it with the team that owns the extension codebase so they can plan releases and QA.

---

## 1. What was “legacy”?

The legacy integration was a **single HTTP endpoint**:

| Removed | Method & path | Role |
|--------|----------------|------|
| **Legacy ad-block** | `POST /api/extension/ad-block` | One call returned **ads**, **notifications**, and **redirect rules** together. The server could log **`ad`**, **`popup`**, **`notification`**, and **`redirect`** rows in `enduser_events` depending on the response. |

**Auth:** `Authorization: Bearer <token>` (same as today).

**Typical body:**

```json
{ "domain": "www.example.com", "requestType": "ad" }
```

Optional `requestType`: `"ad"` (default behavior) or `"notification"` (notifications-only path; `domain` could be omitted in some setups).

**Typical response shape:**

```json
{
  "ads": [ /* creatives */ ],
  "notifications": [ /* payloads */ ],
  "redirects": [ /* sourceDomain, destinationUrl, includeSubdomains */ ]
}
```

That design was simple for a first version but encouraged **one round-trip per navigation**, mixed concerns, and made **instant redirects** (client-side match + navigate) harder than a prefetch + local match model.

---

## 2. What replaced it? (v2 — the only supported path)

Legacy is **removed** from the server. Clients must use **v2** only:

| Need | Replacement endpoint | Notes |
|------|----------------------|--------|
| Live config, campaigns, `frequencyCounts`, domains | `GET /api/extension/live` (SSE) | Query: `?token=<bearer>` or streaming `fetch` with `Authorization`. First event: `init`. |
| Ads & popups for a visit (server logs **`ad`** / **`popup`**) | `POST /api/extension/serve/ads` | Body: `{ "domain": "<hostname>", "userAgent"?: string }`. Response: `{ "ads": [...] }` only. |
| Prefetch redirect rules (`domain_regex`, `target_url`, caps) | `POST /api/extension/serve/redirects` | Body: `{}` or `{ "domain": "<hostname>" }`. Does **not** log redirects. |
| Visits, client-reported **notification** & **redirect** | `POST /api/extension/events` | Body: `{ "events": [ ... ] }` (max 50 items). Types: `visit`, `notification`, `redirect`. |
| Public platform hostnames (optional if you use `init`) | `GET /api/extension/domains` | Unchanged. |
| Auth | `POST .../auth/register`, `login`, `GET .../auth/me`, etc. | Unchanged. |

**Do not** call `POST /api/extension/ad-block`. It should **404** or be absent after removal.

---

## 3. Behavioral differences the extension must implement

### 3.1 Redirects: prefetch → match locally → navigate → then telemetry

- **Before (legacy):** Redirect could appear in the **ad-block JSON**; server might log **`redirect`** when it returned a matching rule.
- **Now:**1. Hydrate rules from **`serve/redirects`** and/or SSE **`init`**.  
  2. Match the tab hostname locally (e.g. `domain_regex` from `serve/redirects`).  
  3. **Navigate immediately** when a rule matches (do not wait on HTTP for UX).  
  4. Report with **`POST /api/extension/events`**: `{ "type": "redirect", "campaignId": "<uuid>", "domain": "<pre-redirect hostname>" }`.  
  Use non-blocking `fetch` (e.g. `keepalive: true` from the background context) so navigation is not delayed.

### 3.2 Notifications

- **Before:** Could be fetched via ad-block with `requestType: "notification"`, with server-side logging when returned.
- **Now:** Decide what to show from **SSE `init` / `campaigns`** (and updates). When you actually show a notification, send **`POST /api/extension/events`** with `type: "notification"` and **`campaignId`** + **`domain`**.

### 3.3 Ads / popups

- **Before:** Part of ad-block response; server logged when returned.
- **Now:** **`POST /api/extension/serve/ads`** with the tab **`domain`** returns creatives and is where the server records **`ad`** / **`popup`** rows. There is **no** `ad` / `popup` type on `POST /events` in the standard contract—do not assume you can replace `serve/ads` with events-only for impressions unless your backend explicitly adds that.

### 3.4 Visits

- **Before:** Could be tied to ad-block visit logging depending on product version.
- **Now:** Batch **`type: "visit"`** on **`POST /api/extension/events`** (see your API doc for batch size guidance, e.g. 5–10 domains per flush).

### 3.5 Frequency caps on client-reported events (important)

On backends that align with the post-legacy dashboard:

- **`notification`** and **`redirect`** events are only **inserted** if the campaign still passes the same **schedule, audience, geo, time window, and frequency caps** as the serve endpoints. If over cap or inactive, the server may **skip** the insert **without failing the whole request**.
- The **`POST /api/extension/events`** response may include **`recorded`**: the number of rows actually written in that request. Use it if you need to distinguish “accepted” vs “skipped” for caps.

---

## 4. Quick mapping table (legacy → v2)

| Legacy (`ad-block`) | v2 |
|---------------------|-----|
| One POST per navigation for everything | SSE `live` + targeted POSTs |
| `requestType: "ad"` + `domain` | `POST /serve/ads` `{ domain }` |
| `requestType: "notification"` | SSE + `POST /events` `notification` |
| `redirects` in JSON + server log sometimes | `POST /serve/redirects` + local match + `POST /events` `redirect` |
| Mixed response keys | `serve/ads` → `{ ads }`; `serve/redirects` → `{ redirects }` |

---

## 5. Extension team checklist (definition of done)

- [ ] Remove every `fetch` / XHR to **`/api/extension/ad-block`** (including fallbacks and feature flags).
- [ ] Implement **`GET /api/extension/live`** (`?token=` or authorized stream) and handle **`init`** + relevant update events.
- [ ] Implement **`POST /api/extension/serve/redirects`** caching and local hostname / regex matching; fire **`events`** for `redirect` without blocking navigation.
- [ ] Implement **`POST /api/extension/serve/ads`** for ad/popup serves (or your agreed prefetch + background reconciliation strategy).
- [ ] Implement **`POST /api/extension/events`** for `visit`, `notification`, and `redirect` as required.
- [ ] Update env / build configs so the extension **only** targets API bases that have shipped the removal (no mixed old/new servers without branching).
- [ ] QA: frequency caps, geo, schedule, and “no double logging” (no parallel legacy + v2 calls).

---

## 6. Reference docs in this repo (when present)

- **`docs/EXTENSION_V2_API.md`** — Full v2 contract (auth, SSE, bodies, examples).
- **`docs/EXTENSION_CLIENT_IMPLEMENTATION_CHECKLIST.md`** — Prefetch, latency, and integration checklist (if maintained).
- **`docs/ARCHITECTURE.md`** — High-level API list.

If a doc path is missing in your checkout, use this file plus the route implementations under `src/app/api/extension/`.

---

## 7. One-line summary for PMs / leads

**We removed the combined `POST /api/extension/ad-block` endpoint; the extension must use SSE `live`, `serve/ads`, `serve/redirects`, and batched `events` only—prefetch redirects for instant navigation and report telemetry on `events`.**

---

*Document purpose: handoff to extension (“client”) engineering after legacy removal on the admin dashboard API.*
