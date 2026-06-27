# Speak Lab AI

IELTS Speaking prep for English learners — AI video practice with a Tavus examiner, mock exams, and personalized study plans.

Built for the Tavus Labs hackathon. The app is developed in [Lovable](https://lovable.dev) and synced to this repo on `main`.

## Links

| | |
|---|---|
| **Lovable editor** | https://lovable.dev/projects/0310155f-b8b5-4b53-8493-1f3f9e04411b |
| **Live preview** | https://id-preview--0310155f-b8b5-4b53-8493-1f3f9e04411b.lovable.app |

## Repository layout

| Path | What |
|---|---|
| `src/` | TanStack Start + React frontend (auth, onboarding, mock, practice, progress) |
| `backend/` | Python assessment service — IELTS scoring, coaching cues, Tavus integration |
| `supabase/` | Database migrations (Lovable Cloud / Supabase) |
| `AGENTS.md` | Always-on rules for Lovable and AI agents |

See [`backend/README.md`](backend/README.md) for the assessment pipeline, Tavus PAL setup, and API endpoints.

## Stack

**Frontend**

- React 19, TanStack Start/Router, Vite, TypeScript, Tailwind CSS 4
- Supabase auth (Lovable Cloud)
- i18next for localization

**Backend**

- Python — fluency, lexical, grammar, pronunciation features + rubric judges
- Tavus CVI for in-call AI examiner

## Local development

### Frontend

```bash
cp .env.example .env   # if present; otherwise copy vars from Lovable Cloud tab
bun install            # or npm install
bun run dev            # or npm run dev
```

Run SQL in `supabase/migrations/` via the Lovable Cloud SQL editor.

### Backend

```bash
cd backend
cp .env.example .env   # add TAVUS_API_KEY and other secrets
uv sync
uv run python examples/live_demo.py
```

## App routes

- `/` — marketing landing page
- `/signup`, `/login` — email/password auth
- `/home`, `/onboarding`, `/mock`, `/practice`, `/progress`, `/session/preview` — authenticated app

## GitHub sync

This repo is connected to Lovable with two-way sync on `main`:

- Edits in Lovable push here automatically
- Commits pushed to `main` sync back into the Lovable editor

Do not rename, move, or delete this repository — that breaks the Lovable connection.

---

Built with [Lovable](https://lovable.dev).
