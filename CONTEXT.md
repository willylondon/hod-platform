# PROJECT CONTEXT — HoD Productivity Platform

> **For AI coding agents:** Read this first before making any changes. It explains what we're building, the current state, architectural decisions, and where we're headed.

## What we're building

An AI-powered productivity and leadership assistant specifically for school Heads of Department (HoDs). This is **not** a generic task manager — it's purpose-built for school leadership workflows.

### Core user
A Head of Department at a secondary school who needs to manage:
- Teacher observations and feedback cycles
- Department meetings and action items
- Curriculum planning and exam preparation
- Staff performance and development
- Administrative tasks and deadlines
- Department goals and progress tracking

### Key design principles
1. **School-specific, not generic** — Every feature feels purpose-built for education leadership
2. **Professional, not flashy** — Clean design, strong hierarchy, no excessive animations
3. **AI-assisted, not AI-driven** — AI drafts require human approval before acting
4. **Privacy-first** — No student data, no real staff data in the prototype

## Current architecture

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16.2 (App Router) | Turbopack, TypeScript, Tailwind CSS v4 |
| Database | Supabase PostgreSQL | 23 tables with Row Level Security |
| Auth | Supabase Auth | Email/password, auto-confirm enabled for demo |
| AI | Mock mode (default) or OpenAI | `OPENAI_API_KEY` env var enables real AI |
| Hosting | Vercel | Auto-deploys from `main` branch |
| Styling | Tailwind CSS v4 + CSS variables | No shadcn/ui — custom design system in globals.css |
| Icons | Lucide React | All icons from single package |

### File structure
```
src/
├── app/
│   ├── layout.tsx              # Root layout (Inter font, skip link)
│   ├── page.tsx                # Redirects to /dashboard
│   ├── globals.css             # Design system (colors, typography, components)
│   ├── (auth)/
│   │   ├── layout.tsx          # Centered auth card layout
│   │   ├── sign-in/page.tsx    # Email/password, auto-sign-up on first attempt
│   │   └── onboarding/page.tsx # 3-step wizard (profile → school → preferences)
│   ├── (app)/
│   │   ├── layout.tsx          # Desktop sidebar + mobile bottom nav
│   │   ├── dashboard/          # Leadership dashboard (greeting, stats, priorities, etc.)
│   │   ├── tasks/              # List/board/grouped views with filters
│   │   ├── workflows/          # Templates list + detail with progress
│   │   ├── observations/       # List + detail with status pipeline
│   │   ├── meetings/           # List + detail with agenda, notes, action items
│   │   ├── calendar/           # Month view with event dots
│   │   ├── ai-assistant/       # Action selector, mock AI output, approve/edit/discard
│   │   ├── goals/              # Department goals with progress bars
│   │   ├── staff/              # Directory with names, subjects, emails
│   │   └── settings/           # Profile, notifications, AI provider, integration cards
│   └── api/
│       └── ai/route.ts         # POST endpoint: mock or OpenAI response
├── components/
│   ├── layout/AppShell.tsx     # Sidebar + mobile nav component
│   ├── observations/ObservationCard.tsx
│   └── meetings/ (MeetingCard, ActionItemRow)
├── lib/
│   ├── types.ts                # All TypeScript interfaces (Task, Observation, Meeting, etc.)
│   ├── utils.ts                # cn(), formatDate(), getGreeting(), priority/status colors
│   ├── supabase/client.ts      # Browser Supabase client
│   └── supabase/server.ts      # Server Supabase client (for middleware)
└── middleware.ts               # Route protection (redirects to /sign-in)
```

### Database tables
23 tables: `schools`, `departments`, `profiles`, `staff`, `workflow_templates`, `workflow_steps`, `workflow_instances`, `tasks`, `task_dependencies`, `checklist_items`, `observations`, `meetings`, `meeting_attendees`, `meeting_actions`, `department_goals`, `calendar_events`, `countdowns`, `reminders`, `notifications`, `ai_drafts`, `settings`, `leadership_quotes`, `timetable_imports`

Full schema: `supabase/migrations/001_schema.sql`

## Current state (August 2, 2026)

### What works
- ✅ Sign-in / sign-up with Supabase Auth
- ✅ 3-step onboarding wizard
- ✅ Leadership dashboard with all sections
- ✅ Tasks CRUD with list/board/grouped views and filters
- ✅ 10 workflow templates with start/archive
- ✅ Observations list + detail with status pipeline
- ✅ Meetings list + detail with agenda, notes, action items
- ✅ Calendar month view
- ✅ AI Assistant with 11 action types (mock mode)
- ✅ Department goals with progress tracking
- ✅ Staff directory with 6 seeded teachers
- ✅ Settings with integration placeholders
- ✅ All empty states, loading states, error handling
- ✅ Mobile-responsive design
- ✅ Accessibility: skip link, focus styles, labels
- ✅ Production build passes (18 routes, zero TS errors)

### What's seeded
- 1 school (Kingston College), 1 department (English)
- 6 fictional teachers
- 4 leadership quotes
- 4 countdown events

### What needs manual seeding (tasks, meetings, observations, goals)
The seed script at `supabase/seed.ts` contains full data but ran into API auth issues. To manually seed:
1. Go to Supabase SQL Editor
2. Run the INSERT statements from `supabase/seed.ts`

## Where we're going

### Short-term (next sprint)
1. **Fix onboarding button click** — React event handler sometimes doesn't fire in certain browsers. Consider using a form `onSubmit` instead of button `onClick`
2. **Complete seed data** — Populate tasks, meetings, observations, goals via SQL
3. **Workflow task generation** — When a workflow starts, auto-create linked tasks
4. **Meeting → task conversion** — Wire up the "Convert to Task" button on action items
5. **Observation AI feedback** — Wire the "Generate Feedback" button to the AI API route

### Medium-term (next phase)
6. **Real OpenAI integration** — Add `OPENAI_API_KEY` env var, remove mock mode banner
7. **Notification center** — Implement in-app notification bell with dropdown
8. **Dashboard live data** — Replace empty states with real seeded data
9. **Multi-role support** — Enable teacher, senior leader, admin roles (schema ready)
10. **File attachments** — Evidence upload for observations, meeting documents

### Future (v2)
11. **Timetable integration** — CSV/XLSX upload with parsing (schema ready)
12. **External calendar sync** — Google Calendar and Outlook via OAuth
13. **Email notifications** — Brevo/SendGrid integration
14. **Policy assistant** — Document retrieval for school policies
15. **Reporting** — Department performance reports with charts (Recharts)

## Development commands

```bash
# Local dev
npm run dev           # http://localhost:3000

# Build check
npm run build         # Must pass before pushing

# Supabase local
npx supabase start    # Docker-based local Supabase
npx supabase stop

# Database
npx supabase db diff  # Show unapplied migrations
npx supabase db push  # Apply migrations

# Deploy
npx vercel deploy --prod --yes
```

## Environment variables

```
NEXT_PUBLIC_SUPABASE_URL=https://fgcljtcfvaolbvvmequn.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJ... (get from Supabase → Settings → API)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJ... (get from Supabase → Settings → API)
OPENAI_API_KEY=sk-... (optional — enables real AI, omit for mock mode)
NEXT_PUBLIC_APP_URL=https://hod-platform.vercel.app
```

## Design conventions

### CSS
- All design tokens in `globals.css` as CSS custom properties (`--color-primary`, etc.)
- Component classes in globals.css (`.card`, `.btn`, `.badge`, `.form-input`)
- **No shadcn/ui** — custom design system
- Inline styles for one-off adjustments

### TypeScript
- All shared types in `src/lib/types.ts`
- Client components use `"use client"` directive
- `export const dynamic = "force-dynamic"` on pages that use Supabase

### Data fetching
- Use Supabase client directly in components (no API routes for CRUD)
- API routes only for server-side logic (AI, future integrations)
- Loading states: `<div className="skeleton ..." />` for initial load
- Empty states: centered message with optional CTA button

## Known issues

1. **Onboarding Next button** — `browser_click` doesn't always trigger React `onClick`. Works with real user clicks. Consider refactoring to form `onSubmit`.
2. **Middleware deprecation** — Next.js 16 renamed `middleware.ts` to `proxy.ts`. Non-blocking warning, works fine.
3. **Font Awesome CDN** — Heavy (19KB). Consider subsetting or switching to Lucide-only.
4. **Hero image** — `hero-group-2026.jpg` at 364KB. WebP version at 327KB exists but not applied everywhere.
5. **`force-dynamic` export** — Required because Supabase client initialization fails during static generation without env vars.

## For agents picking up this project

1. **Read types.ts first** — All data models are there
2. **Check globals.css** — Design tokens and component classes live there
3. **Build after every change** — `npm run build` catches TS errors fast
4. **Don't add new dependencies** without checking existing ones first
5. **Match existing patterns** — Each page follows the same structure (client component, Supabase fetch, loading/empty/error states)
6. **Never commit secrets** — `.env.local` is in `.gitignore`
7. **Test on mobile** — The sidebar collapses, bottom nav appears on small screens
