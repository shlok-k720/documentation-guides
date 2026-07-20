# documentation-guides
A small Node.js + Express app for listing documentation guides, accepting guide requests, and a minimal admin UI for managing guides and requests.

**Quick Start**

- Install dependencies and start the server:

```bash
npm install
npm start
```

- Open the site: http://localhost:3000

**What this repo contains**

- Server: [src/server.js](src/server.js)
- JSON-backed store: [src/db_json.js](src/db_json.js) (data at [db/guides.json](db/guides.json))
- Public UI: [public/index.html](public/index.html), [public/app.js](public/app.js), [public/styles.css](public/styles.css)
- Admin UI: [public/admin.html](public/admin.html), [public/admin.js](public/admin.js)
- Example guide(s): [public/guides](public/guides)

**Main features**

- Guide listing (dynamic) and add-guide API (admin)
- Request form to request new guides; requests are persisted to `db/guides.json`
- Admin authentication: client sends SHA-256 of password, server validates against `ADMIN_PASSWORD` (server-side hash) and issues a short-lived token
- Admin actions: list requests (paginated), delete requests, export requests as CSV, add guides, delete guides
- Optional email notifications for new requests via SMTP (`nodemailer`) if SMTP env vars are provided
- Simple in-memory rate-limiter for `POST /api/request-guide` and session TTLs (configurable)

**Environment variables**

Set these in your environment (or a `.env` loader) before running:

- `PORT` — server port (default 3000)
- `ADMIN_PASSWORD` — admin password (server computes SHA-256 hash of this value on startup)
- `SESSION_TTL_SECONDS` — session lifetime in seconds (default 3600)

Optional SMTP (for email notifications on new requests):

- `SMTP_HOST` — SMTP host to enable sending
- `SMTP_PORT` — SMTP port (default 587)
- `SMTP_SECURE` — `true` to use TLS
- `SMTP_USER` / `SMTP_PASS` — SMTP auth (optional)
- `SMTP_FROM` — From address for notifications
- `ADMIN_EMAIL` or `SMTP_TO` — recipient address for notifications

**Admin UI**

- Visit `/admin` to access the admin UI. The client computes a SHA-256 hash of the password and sends it to `POST /api/admin/login`.
- The server compares the hash against the server-side `ADMIN_PASSWORD` (hashed at startup) and returns a token.
- The token is stored in `localStorage` and used as a `Bearer` token for admin API calls.

**Important endpoints**

- `GET /api/guides` — list guides
- `POST /api/request-guide` — submit a request (rate-limited)
- `POST /api/admin/login` — admin login (client sends SHA-256 hash)
- `GET /api/requests?page=&per_page=` — paginated requests (admin)
- `GET /api/requests.csv` — download all requests as CSV (admin)
- `DELETE /api/requests/:id` — delete a request (admin)
- `POST /api/guides` — add a guide (admin)
- `DELETE /api/guides/:id` — delete a guide (admin)

**Data storage**

- The app stores data in JSON at [db/guides.json](db/guides.json). To reset stored data, stop the server and delete that file.

**Security & deployment notes**

- Sessions and rate-limiting are in-memory. For production, replace these with a persistent store (Redis) and a robust rate-limiting middleware.
- Run the app behind an HTTPS reverse proxy (nginx, Traefik) and use Let's Encrypt for TLS. The server does not terminate TLS by default.
- The admin authentication is simple (token + SHA-256); consider stronger auth (password hashing with salt and PBKDF2/argon2 / OAuth) for production.

**Troubleshooting**

- If emails are not sent, ensure `SMTP_HOST` (and auth if required) are set. Check server logs for `Email notification failed` messages.
- If native builds fail (previously `better-sqlite3`), the project uses a JSON-backed store and does not require native modules.

If you'd like, I can:

- Add persistent sessions (file or Redis)
- Improve rate-limiting to use Redis / persistent buckets
- Add server-side input validation or integrate an HTML email template for notifications

---
Minimal maintainer notes: edits to server and DB were made to support pagination, CSV export, guide deletion, session TTL, rate-limiting, and optional SMTP notifications.

