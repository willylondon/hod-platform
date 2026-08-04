# HoD Productivity Platform

AI-powered productivity and leadership assistant for school Heads of Department.

## Purpose

This platform helps a Head of Department manage departmental workflows, teacher observations, meetings, checklists, deadlines, priorities, department goals, and administrative writing — all from one responsive web application.

This is **not** a general task-management app. It is specifically designed for school leadership.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Database | Supabase PostgreSQL |
| Authentication | Supabase Auth |
| AI | OpenAI (or built-in Mock AI mode) |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Charts | Recharts |
| Dates | date-fns |
| Deployment | Vercel |

## Setup

### Prerequisites
- Node.js 18+
- npm 9+
- Supabase account (free tier)
- OpenAI API key (optional — mock mode available)

### Environment Variables

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL` — Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Your Supabase anon/public key
- `SUPABASE_SERVICE_ROLE_KEY` — Your Supabase service role key (for seeding)
- `OPENROUTER_API_KEY` — (Optional) OpenRouter API key for AI features

### Database Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in the SQL Editor:

```bash
# Copy the migration file contents
cat supabase/migrations/001_schema.sql
# Paste into Supabase SQL Editor and run
```

3. Enable email auth in Authentication → Settings → Email Auth

4. Seed sample data (requires service role key):

```bash
npx tsx supabase/seed.ts
```

### Local Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## AI Provider Setup

### OpenAI (Recommended)
Set `OPENROUTER_API_KEY` in your `.env.local` file (get one at [openrouter.ai](https://openrouter.ai)). The AI assistant will use `OPENROUTER_MODEL` (defaults to `google/gemini-3.5-flash-lite`) for:
- Drafting emails
- Creating meeting agendas
- Summarizing meeting notes
- Drafting observation feedback
- Generating appraisal comments
- Drafting parent communications
- Reviewing workflows

### Mock AI Mode
If no `OPENROUTER_API_KEY` is set, the platform runs in Mock AI Mode. The AI assistant returns realistic professional text based on the selected action. The interface is fully functional for testing. A "Mock AI Mode" banner is displayed.

## Timetable Integration Plan

Future release will support timetable uploads:

- **Supported formats:** CSV, XLSX
- **Sample column structure:** teacher, day, period, start_time, end_time, subject, class, room
- The settings page already shows a disabled Timetable Integration card
- Database tables (`timetable_imports`, `timetable_entries`) are prepared

## Calendar Integration Plan

Future release will support external calendar sync:

- **Google Calendar** — via Google Calendar API
- **Microsoft Outlook** — via Microsoft Graph API
- The settings page shows disabled integration cards
- A provider-neutral calendar service interface is planned

## Security

- All routes are authenticated (except sign-in)
- Supabase Row Level Security on all tables
- Input validation via Zod schemas
- No API secrets in client code
- Environment variables for all credentials
- Audit-friendly timestamps (`created_at`, `updated_at`)
- Fictional data only in the seed script

### Production Privacy

A production deployment requires:
- Formal school privacy approval
- Data retention policies
- Secure handling of student and staff information
- Compliance with local education authority data protection rules
- Staff consent for observations and performance data

## Known Limitations

- **Mock AI Mode:** Without an OpenAI API key, AI responses are simulated
- **Email/Push Notifications:** In-app notifications only. Email and push are future features
- **External Calendar Sync:** Google Calendar and Outlook integration are planned but not implemented
- **Timetable Import:** CSV/XLSX upload is a future feature
- **Single User:** Prototype built for one authenticated Head of Department. Multi-role support is planned
- **No Live Booking:** Capacity and spaces are editorial values, not live inventory

## Deferred Features

| Feature | Status |
|---|---|
| Timetable upload (CSV/XLSX) | Planned — schema prepared |
| Google Calendar integration | Planned — placeholder card |
| Microsoft Outlook integration | Planned — placeholder card |
| Email notifications | Planned |
| Push notifications | Planned |
| Multi-role support (Teacher, SLT, Admin) | Planned — schema prepared |
| Document retrieval / Policy assistant | Future |
| AlphaEarth / Google Earth Engine | Future |
