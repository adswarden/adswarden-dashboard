# Extension API Reference

Complete reference for the browser extension: **authentication**, pull endpoints, live SSE, TypeScript types, and examples. **`POST /api/extension/ad-block` requires `Authorization: Bearer <token>`** from **provision**, **login**, or **register**.

## How this doc relates to EXTENSION_AD_BLOCK_API.md

| Document | Use when |
|----------|----------|
| **EXTENSION_API_REFERENCE.md** (this file) | Full flow, types, error handling, code examples. |
| **EXTENSION_AD_BLOCK_API.md** | Shorter cheat sheet and cURL. |

---

## Table of Contents

1. [Base URL](#base-url)
2. [Authentication](#authentication)
3. [Recommended extension flow](#recommended-extension-flow)
4. [Endpoints overview](#endpoints-overview)
5. [GET /api/extension/domains](#get-apiextensiondomains)
6. [POST /api/extension/ad-block](#post-apiextensionad-block)
7. [GET /api/extension/live (SSE)](#get-apiextensionlive-sse)
8. [TypeScript types](#typescript-types)
9. [Error handling](#error-handling)
10. [Code examples](#code-examples)
11. [Best practices](#best-practices)

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local      | `http://localhost:3000` |
| Production | Your deployed dashboard origin |

---

## Authentication

Dashboard **admins** use Better Auth (`/login`, cookies). **Extension end users** are separate:

| Endpoint | Method | Auth on request | Body / notes |
|----------|--------|-----------------|--------------|
| `/api/extension/auth/provision` | POST | No | `{ installationId }` — extension-generated stable id (e.g. UUID in `chrome.storage.local`). Creates anonymous trial user + **`token`**. Trial length: **`DEFAULT_TRIAL_DAYS`** (default `7`). |
| `/api/extension/auth/register` | POST | Optional `Bearer` | `{ email, password, name? }` — min password 8 chars. With **`Bearer`** from anonymous user: **merges** email/password onto same account. |
| `/api/extension/auth/login` | POST | No | `{ email, password }` → returns **`token`**, **`user`**, **`expiresAt`** |
| `/api/extension/auth/logout` | POST | `Bearer` | Deletes current session |
| `/api/extension/auth/me` | GET | `Bearer` | Returns `{ user }` |

Store **`token`** (e.g. `chrome.storage.local`). Use it for **every** `ad-block` call:

```http
Authorization: Bearer <token>
```

Optional env on server: **`ENDUSER_SESSION_DAYS`** (default `30`) for session lifetime; **`DEFAULT_TRIAL_DAYS`** (default `7`) for anonymous trial `endDate` after **provision**.

Only **one** extension session per user is kept: each login, register, or provision replaces previous sessions.

Users can also register via the public web page **`/register`** (same backend as `POST /api/extension/auth/register` when no Bearer is sent).

---

## Recommended extension flow

1. **Onboarding**  
   On first install, generate **`installationId`**, persist it, call **`POST /api/extension/auth/provision`**, save **`token`**. If you need email sign-in instead, call **`POST /api/extension/auth/login`**. To attach email to an anonymous user: call **`POST /api/extension/auth/register`** with **`Authorization: Bearer`** + `{ email, password }`. After trial **`endDate`**, **`ad-block`** returns **403** with **`error: "trial_expired"`** — show sign-in / purchase UI.

2. **Connect to live SSE**  
   `GET /api/extension/live` — keeps connection count updated; receive `notification` and `domains` events. No Bearer required.

3. **Extension startup — pull notifications**  
   `POST /api/extension/ad-block` with **`Authorization: Bearer`**, body `{ "requestType": "notification" }`. No `domain`.

4. **Per page / domain**  
   `POST /api/extension/ad-block` with Bearer, body `{ "domain": "<hostname>" }` or `requestType: "ad"`.

5. **On SSE `notification` event**  
   Same as step 3: ad-block with `requestType: "notification"` and Bearer token.

6. **On SSE `domains` event**  
   `GET /api/extension/domains` and refresh your cached domain list.

7. **Logout**  
   `POST /api/extension/auth/logout` with Bearer; clear stored token.

---

## Endpoints overview

| Endpoint | Method | Bearer required | Notes |
|----------|--------|-----------------|-------|
| `/api/extension/auth/provision` | POST | No | Anonymous user + token |
| `/api/extension/auth/register` | POST | Optional Bearer | Create or merge anonymous → registered |
| `/api/extension/auth/login` | POST | No | Returns token |
| `/api/extension/auth/logout` | POST | Yes | |
| `/api/extension/auth/me` | GET | Yes | |
| `/api/extension/domains` | GET | No | Active platform domains |
| `/api/extension/ad-block` | POST | **Yes** | Pull ads/notifications; logs `enduser_events` |
| `/api/extension/live` | GET | No | SSE stream |

Do **not** use admin routes like `/api/notifications` from the extension — those expect dashboard session cookies.

---

## GET /api/extension/domains

**URL:** `GET {BASE_URL}/api/extension/domains`

**Response:**

```json
{ "domains": ["instagram.com", "youtube.com"] }
```

---

## POST /api/extension/ad-block

**URL:** `POST {BASE_URL}/api/extension/ad-block`

**Headers:**

```
Content-Type: application/json
Authorization: Bearer <session_token>
```

**Body:**

```json
{
  "domain": "string (optional if requestType is notification-only)",
  "requestType": "ad | notification (optional)",
  "userAgent": "string (optional)"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `domain` | When fetching ads | Omit only for `requestType: "notification"` |
| `requestType` | No | `"ad"` or `"notification"`; omit = both |
| `userAgent` | No | Sent for telemetry if provided |

**Response:** `{ ads: [...], notifications: [...] }` — always arrays.

**Rules:**

- Ads: resolved from `domain` → platform / campaigns.
- Notifications: global / campaign rules; frequency and `enduser_events` affect eligibility.
- User identity, **plan**, and **email** (nullable for anonymous) come from **`end_users`**, not the JSON body.

---

## GET /api/extension/live (SSE)

**URL:** `GET {BASE_URL}/api/extension/live`

Optional: `?endUserId=...` (legacy; not used for auth).

**Events:** `connection_count`, `notification`, `domains`

On **`notification`**, call ad-block with Bearer and `{ "requestType": "notification" }`.

Reconnect after timeout (~5 min on some hosts).

---

## TypeScript types

```typescript
interface AuthLoginResponse {
  token: string;
  expiresAt: string;
  user: {
    id: string;
    email: string | null;
    shortId: string;
    installationId: string | null;
    name: string | null;
    plan: 'trial' | 'paid';
    status: 'active' | 'suspended' | 'churned';
    country: string | null;
    startDate: string;
    endDate: string | null;
    createdAt: string;
  };
}

interface AdBlockResponse {
  ads: Array<{
    title: string;
    image: string | null;
    description: string | null;
    redirectUrl: string | null;
    htmlCode?: string | null;
    displayAs?: 'inline' | 'popup';
  }>;
  notifications: Array<{
    title: string;
    message: string;
    ctaLink?: string | null;
  }>;
}

interface AdBlockRequestBody {
  domain?: string;
  requestType?: 'ad' | 'notification';
  userAgent?: string;
}
```

---

## Error handling

| Status | Typical cause |
|--------|----------------|
| 400 | Invalid JSON, missing `domain` when ads needed, bad `requestType` |
| 401 | Missing or invalid Bearer token on ad-block |
| 403 | End user `status` not `active`, or **`trial_expired`** on **`ad-block`** when trial `endDate` passed |
| 409 | Register: email already exists |
| 500 | Server/database error |

```typescript
async function adBlock(token: string, body: AdBlockRequestBody): Promise<AdBlockResponse> {
  const res = await fetch(`${BASE_URL}/api/extension/ad-block`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return res.json();
}
```

---

## Code examples

### Login and store token

```typescript
const BASE_URL = 'https://your-dashboard.example.com';

async function extensionLogin(email: string, password: string): Promise<string> {
  const res = await fetch(`${BASE_URL}/api/extension/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? 'Login failed');
  }
  const data = (await res.json()) as AuthLoginResponse;
  return data.token;
}
```

### Pull notifications (extension load)

```typescript
async function pullNotifications(token: string) {
  return adBlock(token, { requestType: 'notification' });
}
```

### Pull ads for current tab

```typescript
async function pullAds(token: string, hostname: string) {
  return adBlock(token, { domain: hostname, requestType: 'ad' });
}
```

### Live SSE + pull on event

```typescript
function connectLive(token: string) {
  const es = new EventSource(`${BASE_URL}/api/extension/live`);

  es.addEventListener('notification', async () => {
    try {
      const { notifications } = await adBlock(token, { requestType: 'notification' });
      notifications.forEach((n) => showNotificationBanner(n.title, n.message));
    } catch {
      /* handle 401 → re-login */
    }
  });

  es.addEventListener('domains', async () => {
    const r = await fetch(`${BASE_URL}/api/extension/domains`);
    const { domains } = await r.json();
    updateCachedDomains(domains);
  });

  es.onerror = () => {
    es.close();
    setTimeout(() => connectLive(token), 2000);
  };
  return es;
}
```

---

## Best practices

- **Token storage:** Use extension secure storage; treat token like a password.
- **401 on ad-block:** Clear token and prompt login again (or refresh via `/api/extension/auth/me`).
- **Account status:** Server returns 403 if `end_users.status` is not `active` (e.g. suspended).
- **Caching:** You may cache ads per domain briefly; notifications are usually pulled fresh after SSE or on schedule.
- **CORS:** Extension origins may need to be allowed if calling from non-extension contexts.

### Telemetry

Successful pulls write **`enduser_events`**. Profile fields live on **`end_users`** (updated when relevant).

---

## Summary

| Step | Action |
|------|--------|
| Auth | `POST .../auth/login` → save `token` |
| Pull | `POST .../ad-block` + `Authorization: Bearer` + JSON body (`domain` / `requestType`) |
| Push | `GET .../live` (SSE); on `notification`, pull ad-block |
| Domains | `GET .../domains` (also refresh after SSE `domains`) |
