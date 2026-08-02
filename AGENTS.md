<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# HoD Productivity Platform — Agent Instructions

**Read `CONTEXT.md` first** — it has the full project context, architecture, current state, and roadmap.

## Quick-start for any coding agent

1. **Understand the project:** Read `CONTEXT.md` (3 min)
2. **Check the types:** `src/lib/types.ts` has all data models
3. **Check the design system:** `src/app/globals.css` has all CSS tokens and components
4. **Build after every change:** `npm run build` → must pass

## Rules

- Match existing patterns — each page follows the same structure
- Client components use `"use client"` + Supabase client
- Pages with Supabase data need `export const dynamic = "force-dynamic"`
- Use Lucide icons, not shadcn/ui
- Never commit secrets
- Test on mobile (sidebar collapses, bottom nav)
