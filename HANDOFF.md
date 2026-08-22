# HANDOFF

## Timetable Upload feature (added 2026-08-22)

Upload department timetables as **CSV, XLSX, or image files** (screenshots of printed TimeTabler grids) and view them as a colour-coded weekly grid.

### Files
- `supabase/migrations/002_timetable.sql` — extends `timetable_imports` (uploaded_by, storage_path, file_type, raw_text, error_message), adds `timetable_slots`, RLS (school-scoped), private storage bucket `timetables` + per-user folder policies.
- `src/app/api/timetable/upload/route.ts` — POST endpoint. Auth via server Supabase client; max 10MB; CSV parsed in-house (quoted-cell safe), XLSX via `xlsx` package, images via OpenAI vision (`gpt-4o`) when key present.
- `src/app/(app)/timetable/page.tsx` — drag-and-drop upload, import list with status badges, weekly grid (days × periods, colour-coded by kind: class/registration/break/lunch/assembly/meeting/clubs/free).
- `src/components/layout/AppShell.tsx` — "Timetable" sidebar entry (mobile bottom nav unchanged).
- `src/app/(app)/settings/page.tsx` — Timetable Upload card now links to `/timetable`.
- `src/lib/types.ts` — `TimetableImport`, `TimetableSlot`.

### Environment variables
- `OPENAI_API_KEY` (optional) — enables image timetable parsing. Without it, image uploads are stored with status `pending`.
- Existing Supabase vars unchanged.

### Manual setup steps
1. Run `supabase/migrations/002_timetable.sql` in the Supabase SQL Editor (idempotent).
2. If the bucket INSERT fails due to permissions, create a **private** bucket named `timetables` manually in Storage.
3. Add `OPENAI_API_KEY` in Vercel project settings if image parsing is wanted.

### Test sample (CSV)
```csv
Hillel Academy: F. ATKINS (13)
,7:45-8:00,8:05-8:50,9:35-9:55,BREAK
Monday,REG 2,"ELL 1
13
Rm 23",,BREAK
Tuesday,REG 2,TOK 12,,LUNCH
```
Verified: parser produces correct day × period slots with kinds (registration/class/break/lunch/meeting/clubs/assembly/free) and TIME values.

### Verification status
- `npm run build`: PASS (20 routes, zero TS errors)
- Parser unit test against TimeTabler-style fixture: PASS (25 slots, kinds correct)
- Full E2E (auth + storage): NOT RUN locally — `.env.local` points at local Supabase (127.0.0.1:54321), Docker unavailable on this machine. Test after applying migration against the cloud project.
