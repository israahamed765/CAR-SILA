# CAR-SILA

A digital identity for a car, without exposing a phone number.

CAR-SILA is a web platform that connects a passerby to a vehicle owner through a QR code. The passerby scans the sticker, sends a report, and continues in a private thread. The owner receives the alert and the message inside their account. The phone number stays hidden.

Published site: [car-sila-sand.vercel.app](https://car-sila-sand.vercel.app)

## The problem

Leaving a mobile number on a car window gives every passerby a personal contact channel. Random calls, saved numbers, and messages outside the original situation all follow from that habit.

CAR-SILA separates “I need to reach the owner of this car” from “I want their phone number.”

## What happens on a scan

1. The owner creates an account and registers a vehicle.
2. The platform generates a unique code for that vehicle, ready to print as a sticker.
3. A passerby scans the code with a phone camera, or types the plate. No app, and no account is required.
4. Only public vehicle details are shown: brand, model, year, color, and plate.
5. The passerby chooses a reason and writes a note. The owner receives it in the product, and by email when mail is configured.
6. Both sides continue in the thread attached to that report. The owner sees every conversation. The sender sees the reply in the same visit.

## Who sees what

| Party | Can see | Cannot see |
| --- | --- | --- |
| Passerby | Public vehicle details, the report form, and this visit’s thread | The owner’s phone, email, or other vehicles |
| Owner | Their vehicles, reports, conversations, and the in-page alert | The passerby’s phone |
| Administrator | An overview of accounts, vehicles, and reports | Google sign-in |

A new report or message raises a short notice near the top of the page. It disappears after a few seconds and plays a brief tick. The count beside Messages stays until that conversation is opened.

## Privacy and security

CAR-SILA was reviewed with a find → prove → fix → re-test loop on specific weaknesses. That does **not** mean the product is “100% secure.” It means the issues found inside the current test scope were closed, and further review is still expected.

Privacy stays first.

- The database is not opened from the browser. Only the server uses the database key.
- The user session is an HttpOnly cookie. A passerby is identified by a visit session, not by an account.
- A public vehicle lookup does not return a phone, an email, or an owner id.
- Report emails do not place the sender’s email address in the message body.
- Owners sign in with email and password, or with Google. The administrator signs in with email and password only.

### Security hardening applied (within current scope)

| Area | What was secured |
| --- | --- |
| Account enumeration | Registration no longer reveals whether an email is already registered |
| Content Security Policy | Same CSP / baseline headers on the UI (static pages + assets via Vercel routes) and on the API (Express) |
| Error disclosure | API failures return a generic error to clients; details stay in server logs |
| CORS | Cross-origin access is limited to an explicit allowlist, not open wildcards |
| CSRF | `POST` / `PUT` / `PATCH` / `DELETE` require a matching double-submit CSRF token |
| Dependencies | Known package advisories were cleared with `npm audit` / `npm audit fix` (re-check dated evidence under `security/`) |

Also in place:

- Rate limits on sensitive routes
- Baseline security headers (`CSP`, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`) on both UI and API paths
- Server-only secrets (`.env` is never committed)
- Cookie-based sessions with careful cross-origin rules

### Test scope (what was covered / what was not)

**Covered in this round**

- Live and local checks for account-enumeration signals on registration
- CSP and related security headers on API responses; UI/static header parity fixed after external review
- Generic API error responses (no stack / internal detail to the client) on the paths exercised in testing
- CORS allowlist behavior against untrusted origins
- CSRF double-submit on state-changing browser calls used by the app
- `npm audit` dependency review inside the project tree

**How it was tested**

- Browser DevTools (Network / Response Headers) on the live site and local app
- Crafted `Origin` / CSRF mismatch requests against the API
- Local attacker-page style CORS checks where relevant
- `npm audit` before/after dependency fixes

**Not fully covered yet (needs deeper or privileged review)**

- CSRF on every mutating route under all auth roles with a dedicated test account matrix
- Account enumeration across every auth-related message path and timing side channel
- Error-disclosure review of every API path and failure mode
- Authenticated deep review with a mentor/test account and full source walkthrough
- Continuous SCA beyond the dated `npm audit` snapshot in `security/`

Wording used in reports and this README: *specific findings inside the stated scope were fixed*; ongoing testing and review remain necessary.

## Stack

- Interface: React 19, TypeScript, and Vite
- Server: Node.js and Express, started together with the interface in development
- Data: Supabase
- Sign-in: email and password, or Google Identity Services
- Mail: SMTP through Nodemailer, skipped when it is not configured
- Hosting: Vercel, with the interface and the API on the same domain
- Scanning: the phone camera in the browser

## Run locally

```bash
npm install
npm run dev
```

The interface is at `http://localhost:5173`. The API is at `http://127.0.0.1:8787`.

Copy `.env.example` to `.env` and fill in the values on your machine. Do not commit `.env`.

| Variable | Purpose |
| --- | --- |
| `VITE_GOOGLE_CLIENT_ID` | Google sign-in button |
| `SUPABASE_URL` | Database project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only database key |
| `SMTP_USER` and `SMTP_PASS` | Optional report email |
| `SMTP_HOST` and `SMTP_PORT` | Mail server, Gmail on port 587 by default |
| `APP_URL` | Site link used inside a report email |

For Google sign-in, add the site origin under Authorized JavaScript origins in Google Cloud. Locally that origin is `http://localhost:5173`.

```bash
npm run build
```

The build writes the interface to `dist`. On Vercel, every `/api` path is routed to the Express server.
