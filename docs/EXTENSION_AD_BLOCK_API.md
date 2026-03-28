# Extension API — Ad Block, Auth & Notifications

Short reference: auth, endpoints, request/response shapes, and cURL. **Extension users get a Bearer token** from **`POST /api/extension/auth/provision`** (anonymous install), **`/login`**, or **`/register`**, and send it on `POST /api/extension/ad-block`. Plan, email, short id, and user id come from the server — not from the request body.

## How this doc relates to EXTENSION_API_REFERENCE.md

| Document | Use when |
|----------|----------|
| **EXTENSION_AD_BLOCK_API.md** (this file) | Compact cheat sheet: auth, paths, bodies, cURL. |
| **EXTENSION_API_REFERENCE.md** | Full reference: recommended flow, TypeScript types, error handling, longer examples. |

---

## Base URL

| Environment | Base URL |
|-------------|---------|
| Local      | `http://localhost:3000` |
| Production | Your deployed dashboard origin |

---

## Authentication (extension end users)

End users are **not** the same as dashboard admins (Better Auth). They use:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/extension/auth/provision` | POST | **First install:** `{ installationId }` → anonymous trial user + **token** (store id in `chrome.storage.local`) |
| `/api/extension/auth/register` | POST | Create account, or **upgrade** anonymous: same body + **`Authorization: Bearer`** from provision |
| `/api/extension/auth/login` | POST | Email + password → session **token** |
| `/api/extension/auth/logout` | POST | Invalidate current session (`Authorization: Bearer`) |
| `/api/extension/auth/me` | GET | Validate token, return profile |

**Login / register response (example):**

```json
{
  "token": "<opaque-token>",
  "expiresAt": "2025-04-01T12:00:00.000Z",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "shortId": "a1b2c3d4",
    "installationId": null,
    "name": null,
    "plan": "trial",
    "status": "active",
    "country": null,
    "startDate": "...",
    "endDate": null,
    "createdAt": "..."
  }
}
```

Store **`token`** securely (e.g. `chrome.storage.local`). Send it on every **ad-block** request:

```http
Authorization: Bearer <token>
```

Session lifetime defaults to **30 days** unless `ENDUSER_SESSION_DAYS` is set.

Anonymous trial length (provision + new anonymous admin users) defaults to **7 days** unless **`DEFAULT_TRIAL_DAYS`** is set on the server.

### Provision (anonymous)

`POST /api/extension/auth/provision`  
**Body:** `{ "installationId": "..." }` — stable id from the extension (e.g. random UUID stored in `chrome.storage.local` on first run). Min length 8; `[a-zA-Z0-9_-]` only.  
**Response:** same shape as login (`token`, `expiresAt`, `user`). For new installs, `user.email` is `null`, `user.endDate` is set from **`DEFAULT_TRIAL_DAYS`**.

### Register (API)

`POST /api/extension/auth/register`  
**Body:** `{ "email": "...", "password": "...", "name?": "..." }`  
**Password:** min 8 characters.  
**Account merge:** if the client sends **`Authorization: Bearer <token>`** from an anonymous provisioned user, the same row is updated with email/password (same `id` / `shortId`).

### Login

`POST /api/extension/auth/login`  
**Body:** `{ "email": "...", "password": "..." }`

### Logout

`POST /api/extension/auth/logout`  
**Header:** `Authorization: Bearer <token>`

### Me

`GET /api/extension/auth/me`  
**Header:** `Authorization: Bearer <token>`

---

## Endpoint: Live (SSE)

| | |
|---|---|
| **Method** | `GET` |
| **Path**   | `/api/extension/live` |

Server-Sent Events: connection count, `notification` events (pull new content via ad-block), `domains` events (refresh domain list). **No auth required** for this stream.

When you receive a **`notification`** event, call **`POST /api/extension/ad-block`** with **`Authorization: Bearer`** and body `{ "requestType": "notification" }` (no `domain`).

Optional query: `?endUserId=...` (legacy / future; not required for auth).

---

## Endpoint: Domains list

`GET /api/extension/domains` → `{ "domains": ["instagram.com", ...] }`  
**No auth.**

---

## Endpoint: Ad block (pull ads / notifications)

| | |
|---|---|
| **Method** | `POST` |
| **Path**   | `/api/extension/ad-block` |

### Headers

| Header | Value | Required |
|--------|-------|----------|
| `Content-Type` | `application/json` | Yes |
| `Authorization` | `Bearer <session_token>` | **Yes** — from provision, login, or register |

### Body (JSON)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `domain` | string | For ads | Page hostname. **Required when fetching ads**; omit when `requestType: "notification"` only. |
| `requestType` | string | No | `"ad"` \| `"notification"`. Omit = both (domain required for ads). |
| `userAgent` | string | No | Optional; forwarded for telemetry. |

**Do not send** `endUserId`, `email`, or `plan`. The server resolves the user from the Bearer token and writes **`enduser_events`** with that user’s id and profile fields.

### Example bodies

**Both ads and notifications:**

```json
{
  "domain": "instagram.com"
}
```

**Ads only:**

```json
{
  "domain": "instagram.com",
  "requestType": "ad"
}
```

**Notifications only (extension load — no domain):**

```json
{
  "requestType": "notification"
}
```

### Response (200)

Always includes **`ads`** and **`notifications`** arrays (each may be empty).

```json
{
  "ads": [
    {
      "title": "Ad Title",
      "image": "https://example.com/image.jpg",
      "description": "Ad description",
      "redirectUrl": "https://example.com/target",
      "htmlCode": null,
      "displayAs": "inline"
    }
  ],
  "notifications": [
    {
      "title": "Notification Title",
      "message": "Notification message",
      "ctaLink": "https://example.com/action"
    }
  ]
}
```

---

## Errors (ad-block)

| Status | Condition |
|--------|-----------|
| 400 | Bad `Content-Type`, invalid JSON, missing `domain` when ads requested, bad `requestType` |
| 401 | Missing/invalid Bearer token |
| 403 | End user `status` not `active`, or **`trial_expired`** (`plan` trial and `endDate` in the past) — show login/register UI and offer purchase |
| 500 | Server error |

---

## Telemetry / logging

Successful ad-block calls insert rows into **`enduser_events`** (campaign deliveries, requests, etc.). Profile data (**plan**, **email** may be null for anonymous users, **country** from edge headers) is stored on **`end_users`**.

---

## cURL: login then ad-block

```bash
BASE_URL=http://localhost:3000
TOKEN=$(curl -s -X POST "$BASE_URL/api/extension/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"your-password"}' | jq -r .token)

curl -X POST "$BASE_URL/api/extension/ad-block" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"domain":"instagram.com"}'
```

**Notifications only:**

```bash
curl -X POST "$BASE_URL/api/extension/ad-block" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"requestType":"notification"}'
```

---

## Public registration page

End users can create an account at **`/register`** on the same dashboard origin; then they sign in from the extension via **`POST /api/extension/auth/login`**.
