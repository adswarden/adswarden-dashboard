# Extension & Admin Dashboard: How It All Works

This document explains how the **browser extension** and **admin dashboard** work together, how they communicate, how notifications and ads flow, and how you can **reduce request volume** to the backend.

---

## Table of Contents

1. [High-Level Overview](#1-high-level-overview)
2. [Who Does What](#2-who-does-what)
3. [Communication Between Extension and Backend](#3-communication-between-extension-and-backend)
4. [How Notifications (and Ads) Work End-to-End](#4-how-notifications-and-ads-work-end-to-end)
5. [Why You Can Get Many Requests Per Second](#5-why-you-can-get-many-requests-per-second)
6. [Improving Data Delivery: Fewer Requests, Same Data](#6-improving-data-delivery-fewer-requests-same-data)
7. [Quick Reference](#7-quick-reference)

---

## 1. High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ADMIN DASHBOARD (Next.js)                          │
│  • Admins create/manage: Platforms, Ads, Notifications                       │
│  • Admins view: Analytics (request logs from extension)                      │
│  • Serves public API used by the extension                                   │
└─────────────────────────────────────────────────────────────────────────────┘
                    ▲                                    │
                    │                                    │
         Extension calls                        Dashboard calls
         (Bearer for ad-block; SSE/domains public)  (auth required)
                    │                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BROWSER EXTENSION (your code)                         │
│  • Runs on user’s browser on configured domains                              │
│  • Fetches ads + notifications from dashboard API                           │
│  • Replaces ads / shows notifications on the page                           │
│  • Sends logs back for analytics                                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

- **Admin Dashboard**: backend + UI. It stores platforms, ads, notifications, and request logs. It exposes **public** endpoints for the extension and **protected** endpoints for the admin UI.
- **Extension**: runs in the user’s browser, calls the dashboard’s **public** API to get ads/notifications and to send logs. For real-time notification signals, connect to `GET /api/extension/live` (SSE); when the admin creates a notification, the server pushes an event and the extension pulls the new content. **When the user is on the dashboard (admin UI), do not pull or show notifications** — admins should not see notification banners.

---

## 2. Who Does What

| Component            | Responsibility |
|----------------------|----------------|
| **Admin Dashboard**  | Store platforms (domains), ads, and global notifications; serve ads by domain and notifications globally (per-user read tracking); single extension endpoint logs visits and returns data; show analytics. |
| **Browser Extension**| Users sign in (`POST /api/extension/auth/login`); calls `POST /api/extension/ad-block` with **`Authorization: Bearer`** to get ads (per domain) and notifications. Renders content; telemetry goes to `enduser_events` / `end_users`. |
| **Database**         | `platforms`, `ads`, `notifications`, `campaigns`, `end_users`, `enduser_sessions`, `enduser_events`, `payments`, etc. (admin auth: Better Auth tables). |
| **Redis**           | Live SSE / realtime; not the primary store for extension identity. |

**Real-time:** Connect to `GET /api/extension/live` (SSE). On `notification`, call `POST /api/extension/ad-block` with **Bearer token** and `{ "requestType": "notification" }`. **Skip notification pull when the user is on the dashboard** — admins should not see notifications.

---

## 3. Communication Between Extension and Backend

All communication is **HTTP (REST)**.

### 3.1 Extension → Dashboard (what the extension calls)

**`POST /api/extension/ad-block` requires a Bearer session token** from `POST /api/extension/auth/login` (or register). **`GET /api/extension/domains`** and **`GET /api/extension/live`** do not require that token. Do **not** use `/api/notifications` from the extension — that is for the admin UI (Better Auth).

| Purpose              | Method | Endpoint                          | When extension typically calls |
|----------------------|--------|-----------------------------------|---------------------------------|
| Sign in / register   | POST | `/api/extension/auth/login` / `.../register` | Before calling ad-block; store `token`. |
| Live SSE             | GET | `/api/extension/live` | Keep open while extension is active. |
| Pull notifications only | POST | `/api/extension/ad-block` | On extension load. Headers: `Authorization: Bearer`. Body: `{ "requestType": "notification" }`. **Skip when user is on the dashboard**. |
| Get ads / both       | POST | `/api/extension/ad-block` | Headers: `Authorization: Bearer`. Body: `{ "domain", "requestType"? }`. |

- **Ad block**: User identity and plan come from **`end_users`** via the token — not from the JSON body.

### 3.2 Dashboard → Extension

There is **no** direct dashboard → extension call. The dashboard only:

- Serves the above API when the extension calls it.
- Uses stored data (including `request_logs`) to show analytics in the admin UI.

So “notification” in the product sense is: **extension pulls notification content from the API and displays it**; it is not a push from server to browser.

### 3.3 Data flow summary

```
Extension (Bearer token from auth/login)
    │
    └─ POST /api/extension/ad-block
            Headers: Authorization: Bearer <token>
            Body: { domain?, requestType? }
            → Dashboard: resolve end user from token; resolve campaigns/ads by domain
            → Returns { ads: [...], notifications: [...] }
            → Writes enduser_events; may update end_users (e.g. country)
```

**Recommended:** Call for **ads** on domain page load; call for **notifications** once per day when the user opens the browser or when the extension loads (response is the list of new notifications for that user).

Full request/response shapes, errors, and TypeScript types: [EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md).

---

## 4. How Notifications (and Ads) Work End-to-End

### 4.1 Configuration (in the dashboard)

1. **Platforms**: each platform has a **domain** (e.g. `example.com`). Ads are tied to platforms.
2. **Ads**: linked to one platform; have status (e.g. `active`) and optional start/end dates. Dashboard auto-expires ads when `endDate` has passed.
3. **Notifications**: Delivered per campaign rules; eligibility uses **`enduser_events`** and campaign config (not legacy `notification_reads` in current schema).

### 4.2 Extension flow (what the extension does)

1. **Auth**: extension user logs in; store **Bearer token** securely.
2. **Ads**: on domain page load, `POST /api/extension/ad-block` with Bearer + `{ domain }` or `requestType: "ad"`.
3. **Notifications**: same endpoint with `{ requestType: "notification" }` when appropriate. **Skip when the user is on the dashboard**.
4. Response is always `{ads: [...], notifications: [...]}` (arrays). Logging is automatic.

So “how notification works” is: **dashboard stores global notification content and date range; extension asks “what notifications are new for this user?” once per session/day and displays the returned list.**

---

## 5. Why You Can Get Many Requests Per Second

Request volume scales with **number of extension users × how often each one triggers requests**.

Typical causes of high request rate:

1. **Calling ad-block on every page load / tab**  
   If the extension calls `POST /api/extension/ad-block` on every navigation or tab switch without caching, request count grows with page loads and tabs.

2. **Notifications too often**  
   Notifications are global and per-user; calling with `requestType: "notification"` on every load is unnecessary. Call once per day when the extension loads instead.

3. **Many users / many domains**  
   Same logic per user; more users and more domains mean more total requests.

So “many requests each second” usually means: **frequent calls to `/api/extension/ad-block`** (e.g. no caching for ads, or notifications requested on every load).

---

## 6. Improving Data Delivery: Fewer Requests, Same Data

### 6.1 Extension-side: cache ads by domain

- **Idea**: Cache the `ads` part of the ad-block response (or the full response when you request both) keyed by `domain`, in memory or extension storage.
- **TTL**: e.g. 5–15 minutes. After TTL, refetch when the user hits that domain again.
- **Effect**: Same domain in many tabs or quick refreshes = one ad-block call per TTL per domain instead of per load.

### 6.2 Notifications: once per day when extension loads

- **Idea**: Notifications are global and each is shown only once per user. Call `POST /api/extension/ad-block` with `requestType: "notification"` (or omit for both) **once per day when the user opens the browser or when the extension loads**, not on every page load.
- **Effect**: One notification fetch per user per day; response is the list of new notifications. No need to refetch notifications on every domain visit.

### 6.3 Throttling / debouncing

- Don’t call ad-block on every tiny navigation; debounce or only refetch when domain changes or cache expires.
- Use a single call (omit `requestType`) when you need both ads and notifications so one request returns both arrays.

### 6.4 Summary of impact

| Change | Where | Effect |
|--------|--------|--------|
| Cache ad-block response by domain (e.g. 5–15 min TTL) | Extension | Fewer requests per second on same domain. |
| Notifications once per day on extension load | Extension | Minimal notification traffic; same UX. |
| One call for both ads and notifications when needed | Extension | One POST instead of two. |

---

## 7. Quick Reference

### Extension → Dashboard API

| Endpoint | Method | Purpose |
|----------|--------|--------|
| `/api/extension/auth/login` | POST | Email + password → Bearer token |
| `/api/extension/live` | GET | SSE; reconnect on close |
| `/api/extension/domains` | GET | List active domains |
| `/api/extension/ad-block` | POST | **Bearer required.** Body: `{ domain?, requestType? }`. Returns `{ ads: [...], notifications: [...] }`. |

### Auth and response format

- **Bearer token**: From login/register; identifies the row in **`end_users`**.
- **Response**: Always `{ ads: [...], notifications: [...] }`.

### How notifications work (on extension load)

- **Extension**: `POST /api/extension/ad-block` with **`Authorization: Bearer`** and `{ "requestType": "notification" }`. **Do not pull when the user is on the admin dashboard** (avoid banners for staff).

### Reducing requests (short list)

1. **Extension**: Cache ad-block responses by domain (TTL 5–15 min) for ads.
2. **Extension**: Request notifications once per day on extension load, not on every page.
3. **Extension**: Use one call without `requestType` when you need both ads and notifications.

**Full API reference (request/response shapes, types, errors):** [EXTENSION_AD_BLOCK_API.md](./EXTENSION_AD_BLOCK_API.md). System architecture: [ARCHITECTURE.md](./ARCHITECTURE.md).
