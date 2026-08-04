# AI Assistant: file upload for notes/style reference, switch to OpenRouter

## Context

The AI Assistant page (`src/app/(app)/ai-assistant/page.tsx`) has a single
free-text "prompt" textarea used for every action (draft email, observation
feedback, meeting agenda, etc.). All input has to be typed by hand. There's
no way to bring in existing notes or show the AI an example of the tone/
format you want.

Separately, `src/app/api/ai/route.ts` calls OpenAI directly
(`https://api.openai.com/v1/chat/completions`, `OPENAI_API_KEY`,
`gpt-4o-mini`). The project owner uses OpenRouter, not OpenAI directly, so
the "real AI" path as written doesn't match how they'd actually configure
it.

## Goals

1. Let a user upload a notes file instead of typing, for any AI action.
2. Let a user separately upload a template/sample file that the AI treats
   as a style/format reference (not content to write about).
3. Switch the real-AI call from OpenAI direct to OpenRouter, defaulting to
   a cheap, current-generation, reliable model.

## Non-goals

- No upload support on Observations/Meetings' own notes fields (AI
  Assistant page only, per decision).
- No change to Mock AI Mode's response quality — it stays canned
  per-action text. Uploaded/typed content is appended the same way either
  way; the real payoff is only once a real model is called.
- No dual-provider support (OpenAI direct + OpenRouter). OpenRouter only,
  since that's what's actually used.
- No persistence of uploaded templates for reuse across sessions — each
  upload is used for the next single generation only.

## Architecture

### New route: `POST /api/extract-text`

Single responsibility: accept one uploaded file, return its plain text.

- Request: `multipart/form-data` with one `file` field.
- Detects type from file extension: `.txt`, `.md` → read directly as
  UTF-8 text. `.docx` → extract via `mammoth`. `.pdf` → extract via
  `pdf-parse`.
- Validates size (5MB cap) and extension before attempting extraction.
- Truncates extracted text to 15,000 characters.
- Response: `{ text: string, truncated: boolean }` on success, or
  `{ error: string }` with an appropriate 4xx status on failure (bad
  type, too large, empty extraction result e.g. scanned/image-only PDF).

### AI Assistant page changes

Two upload controls, both driving the existing `generate()` flow:

- **Upload notes** (near the prompt textarea): on file select, POST to
  `/api/extract-text`, show a spinner on the button while extracting, then
  **append** the returned text to whatever's already in the prompt
  textarea (with a blank line separator), so it stays editable. On error,
  show the existing inline error banner pattern already used on this page.
- **Style reference (optional)** (new, separate control): on file select,
  extract the same way, but store the result in new state `styleReference`
  instead of the textarea. Shown as a small chip with the filename and a
  remove (×) button — not inlined into any visible textarea, since it's
  metadata about *how* to write, not *what* to write about.
- `generate()`'s POST body to `/api/ai` gains one new optional field:
  `styleReference`.

### `/api/ai/route.ts` changes

- Swap the OpenAI call for OpenRouter:
  `https://openrouter.ai/api/v1/chat/completions`,
  `Authorization: Bearer ${OPENROUTER_API_KEY}`, model from
  `OPENROUTER_MODEL` env var, defaulting to `google/gemini-3.5-flash-lite`
  (checked current OpenRouter pricing: $0.30/$2.50 per million
  input/output tokens — cheapest current-generation model from an
  established provider at time of writing).
- `GET /api/ai`'s mock-mode flag now reflects `!process.env.OPENROUTER_API_KEY`
  instead of `!process.env.OPENAI_API_KEY`.
- When `styleReference` is present, add it to the real-model prompt as an
  explicit instruction (e.g. "Style/format reference — match this tone and
  structure:") before the user's request. In mock mode, `mockResponse()`
  gets a small acknowledgment line appended when a style reference was
  provided, consistent with how `context` is already echoed today.

## Data flow

```
User picks a file
  -> POST /api/extract-text (multipart)
  -> extract-text route reads extension, extracts, truncates
  -> { text, truncated } returned
  -> Notes upload: appended into prompt textarea (editable)
     Style upload: stored in styleReference state, shown as a chip
User clicks Generate
  -> POST /api/ai { action, context, prompt, styleReference }
  -> real mode: OpenRouter chat completion (gemini-3.5-flash-lite by default)
     mock mode: canned response + short acknowledgment of styleReference
  -> rendered in the existing output panel, same as today
```

## Error handling

- Unsupported extension → `400` with a clear message, shown in the page's
  existing error banner.
- File over 5MB → `400`, same treatment.
- Extraction yields empty/whitespace-only text (e.g. scanned PDF) → `422`
  with a message telling the user the file appears to have no extractable
  text.
- Network/parse failure → generic `500`, caught and shown the same way.
- OpenRouter request failure (bad key, rate limit, etc.) → same pattern
  `/api/ai` already uses for OpenAI failures today (502 passthrough of
  provider error).

## New dependencies

- `mammoth` — `.docx` → text extraction.
- `pdf-parse` — PDF → text extraction.

Both are pure-JS, no native bindings, safe for Vercel's serverless
functions.

## Environment variables

- `OPENROUTER_API_KEY` replaces `OPENAI_API_KEY` (already added to
  `.env.local`, gitignored as before).
- `OPENROUTER_MODEL` replaces `OPENAI_MODEL`, defaults to
  `google/gemini-3.5-flash-lite` (already added to `.env.local`).
- Vercel production env vars will need the same two keys added for the
  real-AI path to work in production (currently runs in mock mode there
  regardless, same as before this change).

## Testing plan

Manual, live-browser verification (matching how the rest of this app has
been validated this session), against the local dev server pointed at the
real Supabase project:

1. Upload a `.txt` notes file → confirm text appends to the textarea.
2. Upload a `.docx` notes file → confirm extraction works.
3. Upload a `.pdf` notes file → confirm extraction works.
4. Upload an unsupported file type → confirm clear inline error, no crash.
5. Upload an oversized file → confirm clear inline error.
6. Upload a style-reference file → confirm it shows as a chip, does not
   appear in the prompt textarea, and is included in the `/api/ai` request
   body.
7. Generate in mock mode (no key yet at test time, or key present but
   forced off) → confirm existing canned-response behavior still works
   unchanged, plus the new acknowledgment line when a style reference was
   provided.
8. Generate with `OPENROUTER_API_KEY` set → confirm a real OpenRouter
   response comes back and `GET /api/ai` reports `mock: false`.
9. `npm run build` and `npm run lint` — no regressions.
