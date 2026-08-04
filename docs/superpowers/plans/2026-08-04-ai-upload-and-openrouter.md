# AI Upload + OpenRouter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload notes and a style-reference file on the AI Assistant page instead of typing, and switch the real-AI backend from direct OpenAI to OpenRouter.

**Architecture:** A new `POST /api/extract-text` route does server-side text extraction (`.txt`/`.md` read directly, `.docx` via `mammoth`, `.pdf` via `pdf-parse`). The AI Assistant page gets two upload controls that call this route and feed the result into the existing prompt flow. `/api/ai/route.ts` swaps its OpenAI call for an OpenRouter-compatible one and gains an optional `styleReference` field.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (unrelated to this feature), `mammoth`, `pdf-parse`.

## Global Constraints

- No test framework exists in this repo (confirmed via `package.json` — no jest/vitest/playwright as a project dependency). Verification is `npm run build` + `npm run lint` + manual live-browser checks against the dev server, matching this project's existing convention (see `AGENTS.md`: "Build after every change").
- Match existing patterns: client components use `"use client"`, Lucide icons only, no shadcn/ui, existing `.card`/`.btn`/`.form-input` classes from `globals.css`.
- Never commit secrets. `OPENROUTER_API_KEY`/`OPENROUTER_MODEL` go in `.env.local` only (already gitignored).
- Max upload size: 5MB. Max extracted text: 15,000 characters (truncate, report `truncated: true`).
- Accepted extensions: `.txt`, `.md`, `.docx`, `.pdf` — case-insensitive.
- Spec: `docs/superpowers/specs/2026-08-04-ai-upload-and-openrouter-design.md`

---

## Task 1: `/api/extract-text` route

**Files:**
- Modify: `package.json` (add `mammoth`, `pdf-parse`)
- Create: `src/app/api/extract-text/route.ts`

**Interfaces:**
- Produces: `POST /api/extract-text` accepting `multipart/form-data` with a `file` field. Returns `200 { text: string, truncated: boolean }` on success, or `{ error: string }` with a `400`/`422`/`500` status on failure. This is the exact contract Task 3's UI code depends on.

- [ ] **Step 1: Install dependencies**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm install mammoth pdf-parse
```

- [ ] **Step 2: Write the route**

`pdf-parse` at the currently-installed version (2.x) uses a class-based API — `import { PDFParse } from "pdf-parse"`, `new PDFParse({ data: Uint8Array })`, `await parser.getText()` → `{ text }`, then `await parser.destroy()`. It ships its own TypeScript types (no ambient declaration needed) and is built on `pdfjs-dist` with documented Vercel/serverless support. This exact API was verified working end-to-end against a real generated PDF and DOCX before writing this plan (see spec/plan session notes) — don't substitute the older `pdf(buffer)`-style v1 API you may know from training data; it is not what gets installed by a plain `npm install pdf-parse` today.

`pdf-parse`'s `getText()` also appends a `-- N of M --` page-marker line after each page's text — strip those before returning, so they don't pollute what gets sent to the AI model later.

Create `src/app/api/extract-text/route.ts`:

```typescript
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB
const MAX_TEXT_CHARS = 15000;
const PDF_PAGE_MARKER = /^-- \d+ of \d+ --$/gm;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 5MB)" }, { status: 400 });
  }

  const ext = extensionOf(file.name);
  let text: string;

  try {
    if (ext === ".txt" || ext === ".md") {
      text = await file.text();
    } else if (ext === ".docx") {
      const buffer = Buffer.from(await file.arrayBuffer());
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else if (ext === ".pdf") {
      const data = new Uint8Array(await file.arrayBuffer());
      const parser = new PDFParse({ data });
      const result = await parser.getText();
      await parser.destroy();
      text = result.text.replace(PDF_PAGE_MARKER, "");
    } else {
      return NextResponse.json(
        { error: "Unsupported file type. Use .txt, .md, .docx, or .pdf" },
        { status: 400 }
      );
    }
  } catch (err) {
    console.error("extract-text error:", err);
    return NextResponse.json({ error: "Failed to read this file" }, { status: 500 });
  }

  text = text.trim();
  if (!text) {
    return NextResponse.json(
      { error: "No text could be extracted from this file." },
      { status: 422 }
    );
  }

  const truncated = text.length > MAX_TEXT_CHARS;
  if (truncated) text = text.slice(0, MAX_TEXT_CHARS);

  return NextResponse.json({ text, truncated });
}
```

- [ ] **Step 3: Verify the build**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run build
```

Expected: succeeds, `/api/extract-text` appears in the route list as `ƒ` (Dynamic).

- [ ] **Step 4: Generate real test fixtures**

Hand-written/fake `.docx`/`.pdf` files are not reliable test fixtures — use the real macOS conversion tools already confirmed present on this machine to generate genuine files:

```bash
echo "Hello from a test PDF document. This confirms extraction works." > /tmp/sample.txt
textutil -convert docx /tmp/sample.txt -output /tmp/sample.docx
cupsfilter /tmp/sample.txt > /tmp/sample.pdf 2>/dev/null
ls -la /tmp/sample.docx /tmp/sample.pdf
```

Expected: both files exist and are a few KB each.

- [ ] **Step 5: Manual verification against the dev server**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run dev &
sleep 3

echo "hello from a text file" > /tmp/extract-test.txt
curl -s -F "file=@/tmp/extract-test.txt" http://localhost:3000/api/extract-text
# Expected: {"text":"hello from a text file","truncated":false}

curl -s -F "file=@/tmp/sample.docx" http://localhost:3000/api/extract-text
# Expected: {"text":"Hello from a test PDF document. This confirms extraction works.","truncated":false}
# (mammoth may include trailing blank lines in the text — that's fine)

curl -s -F "file=@/tmp/sample.pdf" http://localhost:3000/api/extract-text
# Expected: {"text":"Hello from a test PDF document. This confirms extraction works.","truncated":false}
# (confirms the page-marker strip worked — there should be no "-- 1 of 1 --" in the response)

curl -s -F "file=@/tmp/extract-test.txt;filename=notes.exe" http://localhost:3000/api/extract-text
# Expected: {"error":"Unsupported file type. Use .txt, .md, .docx, or .pdf"}

dd if=/dev/zero of=/tmp/extract-big.txt bs=1M count=6 2>/dev/null
curl -s -F "file=@/tmp/extract-big.txt" http://localhost:3000/api/extract-text
# Expected: {"error":"File is too large (max 5MB)"}

rm -f /tmp/extract-test.txt /tmp/extract-big.txt /tmp/sample.txt /tmp/sample.docx /tmp/sample.pdf
kill %1
```

- [ ] **Step 6: Commit**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
git add package.json package-lock.json src/app/api/extract-text/route.ts
git commit -m "feat: add /api/extract-text for notes/docx/pdf text extraction"
```

---

## Task 2: Switch `/api/ai/route.ts` to OpenRouter

**Files:**
- Modify: `src/app/api/ai/route.ts:1-9` (imports/interface), `:229-306` (GET/POST)
- Modify: `README.md:47,87,97`
- Modify: `CONTEXT.md:31,119,159`

**Interfaces:**
- Consumes: none (self-contained change to an existing route).
- Produces: `GET /api/ai` → `{ mock: boolean }` now keyed off `OPENROUTER_API_KEY`. `POST /api/ai` request body gains optional `styleReference?: string`; Task 3's UI code sends this field.

- [ ] **Step 1: Update the request interface**

In `src/app/api/ai/route.ts`, change:

```typescript
interface AiRequestBody {
  action?: string;
  context?: string;
  prompt?: string;
}
```

to:

```typescript
interface AiRequestBody {
  action?: string;
  context?: string;
  prompt?: string;
  styleReference?: string;
}
```

- [ ] **Step 2: Update the GET handler**

Change:

```typescript
export async function GET() {
  return NextResponse.json({ mock: !process.env.OPENAI_API_KEY });
}
```

to:

```typescript
export async function GET() {
  return NextResponse.json({ mock: !process.env.OPENROUTER_API_KEY });
}
```

- [ ] **Step 3: Update the POST handler**

Change the whole function body from:

```typescript
export async function POST(request: Request) {
  let body: AiRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "draft_email";
  const context = body.context ?? "";
  const prompt = body.prompt ?? "";

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    // Simulate a small delay so the UI feels realistic
    await new Promise((r) => setTimeout(r, 900));
    return NextResponse.json({
      text: mockResponse(action, context, prompt),
      mock: true,
    });
  }

  try {
    const systemPrompt = `You are an AI assistant for a Head of Department at a school. You help draft professional documents, communications, feedback, agendas, and plans. Be concise, professional, and practical. Output only the requested content.`;

    const userPrompt = [
      `Action: ${labelFor(action)}`,
      context ? `Context: ${context}` : null,
      prompt ? `Request: ${prompt}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenAI API error:", res.status, errText);
      return NextResponse.json(
        { error: `OpenAI request failed (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text =
      data.choices?.[0]?.message?.content?.trim() ??
      "No response generated.";

    return NextResponse.json({ text, mock: false });
  } catch (err) {
    console.error("AI route error:", err);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
```

to:

```typescript
export async function POST(request: Request) {
  let body: AiRequestBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const action = body.action ?? "draft_email";
  const context = body.context ?? "";
  const prompt = body.prompt ?? "";
  const styleReference = body.styleReference ?? "";

  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    // Simulate a small delay so the UI feels realistic
    await new Promise((r) => setTimeout(r, 900));
    const baseText = mockResponse(action, context, prompt);
    const text = styleReference
      ? `${baseText}\n\n(Style reference considered: matched tone/format from your uploaded sample.)`
      : baseText;
    return NextResponse.json({ text, mock: true });
  }

  try {
    const systemPrompt = `You are an AI assistant for a Head of Department at a school. You help draft professional documents, communications, feedback, agendas, and plans. Be concise, professional, and practical. Output only the requested content.`;

    const userPrompt = [
      `Action: ${labelFor(action)}`,
      styleReference ? `Style/format reference — match this tone and structure:\n${styleReference}` : null,
      context ? `Context: ${context}` : null,
      prompt ? `Request: ${prompt}` : null,
    ]
      .filter(Boolean)
      .join("\n\n");

    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "https://hod-platform.vercel.app",
        "X-Title": "HoD Productivity Platform",
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || "google/gemini-3.5-flash-lite",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 1500,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("OpenRouter API error:", res.status, errText);
      return NextResponse.json(
        { error: `OpenRouter request failed (${res.status})` },
        { status: 502 }
      );
    }

    const data = await res.json();
    const text =
      data.choices?.[0]?.message?.content?.trim() ??
      "No response generated.";

    return NextResponse.json({ text, mock: false });
  } catch (err) {
    console.error("AI route error:", err);
    return NextResponse.json(
      { error: "Failed to generate response" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Update docs to match**

In `README.md`:
- Line 47: `- \`OPENAI_API_KEY\` — (Optional) OpenAI API key for AI features` → `- \`OPENROUTER_API_KEY\` — (Optional) OpenRouter API key for AI features`
- Line 87: `Set \`OPENAI_API_KEY\` in your \`.env.local\` file. The AI assistant will use GPT-4 for:` → `Set \`OPENROUTER_API_KEY\` in your \`.env.local\` file (get one at [openrouter.ai](https://openrouter.ai)). The AI assistant will use \`OPENROUTER_MODEL\` (defaults to \`google/gemini-3.5-flash-lite\`) for:`
- Line 97: `If no \`OPENAI_API_KEY\` is set, the platform runs in Mock AI Mode.` → `If no \`OPENROUTER_API_KEY\` is set, the platform runs in Mock AI Mode.`

In `CONTEXT.md`:
- Line 31: `| AI | Mock mode (default) or OpenAI | \`OPENAI_API_KEY\` env var enables real AI |` → `| AI | Mock mode (default) or OpenRouter | \`OPENROUTER_API_KEY\` env var enables real AI |`
- Line 119: `6. **Real OpenAI integration** — Add \`OPENAI_API_KEY\` env var, remove mock mode banner` → `6. **Real AI integration** — Add \`OPENROUTER_API_KEY\` env var, remove mock mode banner`
- Line 159: `OPENAI_API_KEY=sk-... (optional — enables real AI, omit for mock mode)` → `OPENROUTER_API_KEY=sk-or-... (optional — enables real AI, omit for mock mode)`

- [ ] **Step 5: Verify the build**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run build
```

Expected: succeeds, no new errors.

- [ ] **Step 6: Manual verification against the dev server**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run dev &
sleep 3

curl -s http://localhost:3000/api/ai
# Expected: {"mock":false} since OPENROUTER_API_KEY is already in .env.local

curl -s -X POST http://localhost:3000/api/ai \
  -H "Content-Type: application/json" \
  -d '{"action":"draft_email","prompt":"Say hi to the team about the fire drill on Friday"}'
# Expected: {"text":"...", "mock":false} with real generated text from OpenRouter

kill %1
```

If this returns a 502 with an OpenRouter error, read the error message — it'll typically mean the model string is wrong or the key is invalid. Double check `google/gemini-3.5-flash-lite` is still a valid OpenRouter model slug (models occasionally get renamed/deprecated) via `curl https://openrouter.ai/api/v1/models | grep gemini-3.5-flash-lite` and adjust `OPENROUTER_MODEL` in `.env.local` if needed.

- [ ] **Step 7: Commit**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
git add src/app/api/ai/route.ts README.md CONTEXT.md
git commit -m "feat: switch AI backend from OpenAI to OpenRouter, thread styleReference"
```

---

## Task 3: Upload UI on the AI Assistant page

**Files:**
- Modify: `src/app/(app)/ai-assistant/page.tsx`

**Interfaces:**
- Consumes: `POST /api/extract-text` (Task 1) → `{ text, truncated }` or `{ error }`. `POST /api/ai` (Task 2) now accepts `styleReference?: string` in its body.

- [ ] **Step 1: Update imports**

Change:

```typescript
import { useEffect, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Compass,
  Eye,
  FileText,
  ListChecks,
  ListTodo,
  Loader2,
  Mail,
  PenLine,
  Sparkles,
  Trash2,
  Users,
  Workflow,
} from "lucide-react";
```

to:

```typescript
import { useEffect, useRef, useState } from "react";
import {
  Award,
  CalendarDays,
  CheckCircle2,
  Compass,
  Eye,
  FileText,
  ListChecks,
  ListTodo,
  Loader2,
  Mail,
  PenLine,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Workflow,
  X,
} from "lucide-react";
```

- [ ] **Step 2: Add upload state and refs**

In `AiAssistantPage`, change:

```typescript
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [action, setAction] = useState(ACTIONS[0].id);
  const [contextId, setContextId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<AiDraft[]>([]);
```

to:

```typescript
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [action, setAction] = useState(ACTIONS[0].id);
  const [contextId, setContextId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [history, setHistory] = useState<AiDraft[]>([]);
  const [extractingNotes, setExtractingNotes] = useState(false);
  const [extractingStyle, setExtractingStyle] = useState(false);
  const [notesTruncated, setNotesTruncated] = useState(false);
  const [styleTruncated, setStyleTruncated] = useState(false);
  const [styleReference, setStyleReference] = useState("");
  const [styleReferenceFileName, setStyleReferenceFileName] = useState<string | null>(null);
  const notesFileInputRef = useRef<HTMLInputElement>(null);
  const styleFileInputRef = useRef<HTMLInputElement>(null);
```

- [ ] **Step 3: Add the extraction helper and upload handlers**

After the `generate` function (which ends right before `function pushToHistory`), insert:

```typescript
  async function extractFileText(file: File): Promise<{ text: string; truncated: boolean }> {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/extract-text", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Failed to read file");
    return { text: data.text as string, truncated: Boolean(data.truncated) };
  }

  async function handleNotesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtractingNotes(true);
    setError(null);
    setNotesTruncated(false);
    try {
      const { text, truncated } = await extractFileText(file);
      setPrompt((p) => (p ? `${p}\n\n${text}` : text));
      setNotesTruncated(truncated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setExtractingNotes(false);
    }
  }

  async function handleStyleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setExtractingStyle(true);
    setError(null);
    setStyleTruncated(false);
    try {
      const { text, truncated } = await extractFileText(file);
      setStyleReference(text);
      setStyleReferenceFileName(file.name);
      setStyleTruncated(truncated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read file");
    } finally {
      setExtractingStyle(false);
    }
  }
```

- [ ] **Step 4: Include `styleReference` in the generate request**

Change:

```typescript
        body: JSON.stringify({ action, context: contextId ? contextLabel : "", prompt }),
```

to:

```typescript
        body: JSON.stringify({ action, context: contextId ? contextLabel : "", prompt, styleReference: styleReference || undefined }),
```

- [ ] **Step 5: Update the mock-mode banner copy**

Change:

```tsx
          <div className="text-sm">
            <strong>Mock AI Mode.</strong> No <code>OPENAI_API_KEY</code> is configured, so
            responses are generated locally as realistic samples. Add the key to enable live AI.
          </div>
```

to:

```tsx
          <div className="text-sm">
            <strong>Mock AI Mode.</strong> No <code>OPENROUTER_API_KEY</code> is configured, so
            responses are generated locally as realistic samples. Add the key to enable live AI.
          </div>
```

- [ ] **Step 6: Add the upload controls to the JSX**

Change:

```tsx
            <label className="form-label" htmlFor="ai-prompt">
              Your request <span className="text-muted font-normal">(optional — add detail for better results)</span>
            </label>
            <textarea
              id="ai-prompt"
              className="form-input mb-4 min-h-28 resize-y"
              placeholder={`e.g. "Email the team about Thursday's moderation deadline…"`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <div className="flex-between">
```

to:

```tsx
            <label className="form-label" htmlFor="ai-prompt">
              Your request <span className="text-muted font-normal">(optional — add detail for better results)</span>
            </label>
            <textarea
              id="ai-prompt"
              className="form-input mb-2 min-h-28 resize-y"
              placeholder={`e.g. "Email the team about Thursday's moderation deadline…"`}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />

            <input
              ref={notesFileInputRef}
              type="file"
              accept=".txt,.md,.docx,.pdf"
              className="hidden"
              onChange={handleNotesUpload}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm mb-4"
              onClick={() => notesFileInputRef.current?.click()}
              disabled={extractingNotes}
            >
              {extractingNotes ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading file…
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" aria-hidden /> Upload notes (.txt, .md, .docx, .pdf)
                </>
              )}
            </button>
            {notesTruncated && (
              <p className="text-muted -mt-3 mb-4 text-xs">
                File was long — only the first 15,000 characters were used.
              </p>
            )}

            <div className="mb-4">
              <label className="form-label" htmlFor="ai-style-upload">
                Style reference <span className="text-muted font-normal">(optional — upload a sample to match its tone/format)</span>
              </label>
              <input
                id="ai-style-upload"
                ref={styleFileInputRef}
                type="file"
                accept=".txt,.md,.docx,.pdf"
                className="hidden"
                onChange={handleStyleUpload}
              />
              {styleReferenceFileName ? (
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="h-4 w-4 text-muted" aria-hidden />
                  <span>{styleReferenceFileName}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    aria-label="Remove style reference"
                    onClick={() => { setStyleReference(""); setStyleReferenceFileName(null); }}
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => styleFileInputRef.current?.click()}
                  disabled={extractingStyle}
                >
                  {extractingStyle ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Reading file…
                    </>
                  ) : (
                    <>
                      <Upload className="h-4 w-4" aria-hidden /> Upload a sample
                    </>
                  )}
                </button>
              )}
              {styleTruncated && (
                <p className="text-muted mt-1 text-xs">
                  File was long — only the first 15,000 characters were used.
                </p>
              )}
            </div>

            <div className="flex-between">
```

- [ ] **Step 7: Verify the build**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run build
```

Expected: succeeds, no new TS/ESLint errors introduced (this page already has pre-existing unrelated lint warnings — don't fix those here, out of scope for this task).

- [ ] **Step 8: Commit**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
git add "src/app/(app)/ai-assistant/page.tsx"
git commit -m "feat: add notes/style-reference file upload to AI Assistant page"
```

---

## Task 4: End-to-end live verification

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null
npm run dev > /tmp/hod-dev.log 2>&1 &
for i in $(seq 1 40); do curl -sf http://localhost:3000 >/dev/null 2>&1 && break; sleep 1; done
```

- [ ] **Step 2: Drive the full upload + generate flow in a headless browser**

Use Playwright (already used elsewhere in this project's manual verification during this session — install into a scratch directory if not already available: `npm install playwright` and ensure a Chromium build is cached). Script:

```javascript
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });

  await page.goto('http://localhost:3000/ai-assistant', { waitUntil: 'networkidle' });

  // Upload a .txt notes file
  const fs = require('fs');
  fs.writeFileSync('/tmp/notes.txt', 'Observed strong questioning technique, needs more independent practice time.');
  await page.setInputFiles('input[type="file"]:not(#ai-style-upload)', '/tmp/notes.txt');
  await page.waitForTimeout(1500);
  const promptValue = await page.inputValue('#ai-prompt');
  console.log('prompt after notes upload:', JSON.stringify(promptValue));
  if (!promptValue.includes('independent practice')) throw new Error('notes upload did not populate prompt');

  // Upload a style reference file
  fs.writeFileSync('/tmp/style.txt', 'Dear team, — brief, warm, bulleted. Best, HoD');
  await page.setInputFiles('#ai-style-upload', '/tmp/style.txt');
  await page.waitForTimeout(1500);
  const chipVisible = await page.locator('text=style.txt').isVisible();
  console.log('style reference chip visible:', chipVisible);
  if (!chipVisible) throw new Error('style reference chip did not appear');

  // Generate
  await page.click('button:has-text("Generate")');
  await page.waitForTimeout(4000);
  const output = await page.locator('.whitespace-pre-wrap').first().textContent();
  console.log('generated output (first 200 chars):', output?.slice(0, 200));
  if (!output) throw new Error('no output generated');

  // Unsupported file type
  fs.writeFileSync('/tmp/bad.exe', 'not a real exe');
  await page.setInputFiles('input[type="file"]:not(#ai-style-upload)', '/tmp/bad.exe');
  await page.waitForTimeout(1000);
  const errorVisible = await page.locator('[role="alert"]').isVisible();
  console.log('error banner visible for bad file type:', errorVisible);
  if (!errorVisible) throw new Error('expected an error for unsupported file type');

  console.log('CONSOLE ERRORS:', consoleErrors.length ? JSON.stringify(consoleErrors) : 'none');
  await browser.close();
})();
```

Expected: all `console.log` assertions pass without throwing, `CONSOLE ERRORS: none`.

- [ ] **Step 3: Confirm mock-mode fallback still works**

Temporarily rename `OPENROUTER_API_KEY` in `.env.local` (e.g. to `OPENROUTER_API_KEY_DISABLED`), restart the dev server, repeat the "Generate" part of Step 2, and confirm:
- `GET /api/ai` reports `{"mock":true}`
- The output includes the canned mock text for the selected action
- If a style reference was uploaded, the output ends with the "(Style reference considered: ...)" line

Then rename the env var back to `OPENROUTER_API_KEY` and restart the dev server before continuing.

- [ ] **Step 4: Run build and lint one more time**

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
npm run build
npm run lint
```

Expected: build succeeds. Lint may show the same pre-existing warnings/errors this repo already had before this feature (do not attempt to fix unrelated pre-existing lint issues as part of this task) — confirm no *new* errors were introduced by this feature's files (`api/extract-text/route.ts`, `api/ai/route.ts`, `ai-assistant/page.tsx`).

- [ ] **Step 5: Clean up scratch files and stop the dev server**

```bash
rm -f /tmp/notes.txt /tmp/style.txt /tmp/bad.exe /tmp/hod-dev.log
lsof -ti:3000 -sTCP:LISTEN | xargs -r kill 2>/dev/null
```

- [ ] **Step 6: Final commit (only if Steps 1-4 required any fixes)**

If verification uncovered and required fixing any issues in the feature files, commit them:

```bash
cd "/Users/willardwells/Documents/Hod School/hod-platform"
git add -A
git status --short  # review before committing — should only show this feature's files
git commit -m "fix: address issues found during end-to-end verification"
```

If no fixes were needed, skip this step — Tasks 1-3 already committed clean, working code.
