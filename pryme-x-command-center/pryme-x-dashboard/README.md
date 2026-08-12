# Pryme X AI Cyber Solutions — Executive Command Center

A production-ready, real-time executive dashboard: secure RBAC authentication, live team chat,
peer-to-peer WebRTC video meetings, world clocks, live project metrics, and Gmail-powered
staff invitations — backed by MongoDB (no local JSON/db.json files anywhere).

## Stack
- **Backend:** Node.js, Express, Socket.io
- **Database:** MongoDB Atlas via Mongoose (all users, messages, groups, metrics, meetings persist here)
- **Auth:** JWT (httpOnly-free bearer token) + bcrypt password hashing, rate-limited login
- **Email:** Nodemailer over Gmail SMTP (App Password) for real staff invitation emails
- **Real-time:** Socket.io for presence, chat, and WebRTC signaling (mesh topology)
- **Frontend:** Vanilla HTML/CSS/JS — "Liquid Glass" design system with dark/light theme toggle

## 1. File Structure

```
pryme-x-dashboard/
├── server.js                 # Express + Socket.io entry point
├── package.json
├── Procfile                  # Render/Railway process definition
├── .env.example               # All required environment variables
├── render.yaml                # Render Blueprint — one-click deploy
├── config/
│   └── db.js                 # MongoDB connection
├── models/                   # Mongoose schemas (User, Group, Message, Metrics, ClockSettings, Meeting)
├── middleware/
│   ├── auth.js                # JWT verification
│   └── rbac.js                # requireCEO / requireFullAccess guards
├── routes/                   # /api/auth, /api/users, /api/chat, /api/metrics, /api/clocks, /api/meetings, /api/inbox
├── sockets/
│   └── index.js               # presence, chat, WebRTC signaling
├── utils/
│   └── mailer.js               # Gmail SMTP invitation emails
├── seed/
│   └── seedAdmins.js           # Creates the two CEO & Founder accounts
└── public/                   # Static frontend (login.html, dashboard.html, css/, js/)
```

## 2. Local Setup

```bash
git clone <your-repo-url>
cd pryme-x-dashboard
npm install
cp .env.example .env
# edit .env with your real MongoDB URI, JWT secret, Gmail credentials, and admin passwords
npm run seed     # creates the two master CEO & Founder accounts
npm run dev      # or npm start
```

Visit `http://localhost:5000/login.html`.

## 3. Environment Variables

All configuration lives in environment variables — see `.env.example` for the full list. Key ones:

| Variable | Purpose |
|---|---|
| `MONGO_URI` | MongoDB Atlas connection string (free tier at mongodb.com/cloud/atlas) |
| `JWT_SECRET` | Long random string signing session tokens |
| `ADMIN1_USERNAME` / `ADMIN1_PASSWORD` / `ADMIN1_EMAIL` | First CEO & Founder account (`Yash2009lk`) |
| `ADMIN2_USERNAME` / `ADMIN2_PASSWORD` / `ADMIN2_EMAIL` | Second CEO & Founder account (`Ya23@runp`) |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Gmail SMTP sender for staff invitation emails (use a Gmail **App Password**, not your login password) |
| `CLIENT_URL` | Your live deployed URL, used for CORS and email links |

**Never commit `.env`.** It's already in `.gitignore`.

## 4. Database Architecture

There is **no local JSON storage anywhere** in this project. Every piece of state — user accounts,
access levels, chat groups, messages, live metrics, clock configuration, and meeting sessions — is a
Mongoose model persisted to MongoDB (see `models/`). This means:
- Data survives restarts/redeploys.
- Multiple server instances (horizontal scaling) share the same source of truth.
- You can inspect/query production data directly via MongoDB Atlas or `mongosh`.

## 5. Authentication & RBAC

- Only the two seeded CEO accounts carry `role: 'CEO'` and always have Full System Access, with
  a protected title of **"CEO & Founder"**.
- The CEO invites staff via **Staff Management → Invite Staff Member**, choosing **Full System
  Access** or **Preview Only**. This triggers a real email via Gmail SMTP containing their
  username and temporary password (the invitee is forced to change it on first login).
- `middleware/rbac.js` enforces access at the API layer (`requireCEO`, `requireFullAccess`) —
  restrictions aren't just cosmetic on the frontend; every write endpoint checks server-side.
- Wrong username or wrong password both return an identical generic `401 Invalid credentials`
  response — no information leakage about which field was wrong. Login is also rate-limited.

## 6. Deploying to Render

### Option A — One-click Blueprint (recommended)
1. Push this repo to GitHub.
2. In Render: **New → Blueprint** → select your repo. Render reads `render.yaml` and
   provisions the web service automatically.
3. Fill in the secret values Render prompts for (`MONGO_URI`, `CLIENT_URL`, admin passwords,
   `GMAIL_USER`, `GMAIL_APP_PASSWORD`) — `JWT_SECRET` is auto-generated for you.
4. After the first deploy succeeds, open the **Shell** tab on the service and run: `npm run seed`.
5. Update `CLIENT_URL` to the live `*.onrender.com` URL Render assigned, then redeploy.

### Option B — Manual Web Service
1. Push this repo to GitHub.
2. In Render: **New → Web Service** → connect your GitHub repo.
3. Build command: `npm install`. Start command: `npm start` (or rely on the included `Procfile`).
4. Add all variables from `.env.example` under **Environment**.
5. Deploy. Then run the seed script once (Render Shell tab): `npm run seed`.
6. Set `CLIENT_URL` to your `*.onrender.com` URL and redeploy so CORS/email links match.

## 7. Deploying to Railway

1. Push this repo to GitHub.
2. In Railway: **New Project → Deploy from GitHub repo**.
3. Railway auto-detects Node and uses the `Procfile`/`npm start`.
4. Add the same environment variables in the **Variables** tab.
5. After first deploy, open a Railway shell (or run locally against the same `MONGO_URI`) and run
   `npm run seed`.
6. Set `CLIENT_URL` to your Railway-generated domain.

## 8. MongoDB Atlas Quick Setup

1. Create a free cluster at https://www.mongodb.com/cloud/atlas.
2. Database Access → add a user with a strong password.
3. Network Access → allow `0.0.0.0/0` (or your host's static IP) so Render/Railway can connect.
4. Copy the connection string into `MONGO_URI` in your environment variables.

## 9. Gmail SMTP + IMAP Quick Setup

1. Enable 2-Step Verification on the sending Gmail account.
2. Go to https://myaccount.google.com/apppasswords and generate an App Password for "Mail".
3. Put the Gmail address in `GMAIL_USER` and the 16-character app password in `GMAIL_APP_PASSWORD`.
   The same credential pair powers both outbound invite emails (SMTP) and the Live Inbox (IMAP).
4. In Gmail: **Settings → Forwarding and POP/IMAP → Enable IMAP → Save Changes.** Without this,
   the Live Inbox will return a connection error even with valid credentials.

## 10. Feature Map

| Feature | Where |
|---|---|
| Liquid glass dark/light theme | `public/css/style.css`, `public/js/theme.js` |
| Login + strict RBAC | `routes/auth.js`, `public/login.html`, `public/js/login.js` |
| Staff invitations + Gmail | `routes/users.js`, `utils/mailer.js` |
| Live chat (Socket.io) | `sockets/index.js`, `routes/chat.js`, `public/js/chat.js` |
| WebRTC video meetings | `routes/meetings.js`, `sockets/index.js`, `public/js/webrtc.js` |
| Live project metrics | `routes/metrics.js`, dashboard Overview section |
| World clocks (10 countries incl. Sri Lanka) | `routes/clocks.js`, `public/js/clock.js` |
| Live corporate email inbox (IMAP, Full Access only) | `routes/inbox.js`, `public/js/inbox.js` |
| Group creation, leaving, and deletion (Full Access only) | `routes/chat.js`, `sockets/index.js` |
| Profile customization | `routes/users.js` (`/me/profile`), Profile section |

## 11. Security Notes for Production

- Rotate `JWT_SECRET` and all admin passwords before going live; the values in `.env.example`
  are placeholders only.
- Consider adding 2FA and IP allow-listing for the CEO accounts given the "Full System Access"
  scope.
- `helmet` and rate-limiting are already wired in `server.js` / `routes/auth.js`; extend as needed
  (e.g. per-route rate limits on `/invite`).
