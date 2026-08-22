import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

type SlotKind =
  | "class"
  | "registration"
  | "break"
  | "lunch"
  | "assembly"
  | "meeting"
  | "clubs"
  | "free";

interface SlotRow {
  day_of_week: number;
  period_label: string;
  start_time: string | null;
  end_time: string | null;
  content: string;
  kind: SlotKind;
  sort_order: number;
}

function classify(text: string): SlotKind {
  const t = text.trim().toLowerCase();
  if (!t) return "free";
  if (t.startsWith("reg")) return "registration";
  if (t === "break") return "break";
  if (t === "lunch") return "lunch";
  if (t.includes("assembly")) return "assembly";
  if (t.includes("mtg") || t.includes("meeting")) return "meeting";
  if (t.includes("club")) return "clubs";
  return "class";
}

/** Parse "7:45-8:00" or "8:05 – 8:50" into TIME strings. */
function parseTimeRange(label: string): { start_time: string | null; end_time: string | null } {
  const m = label.match(/(\d{1,2})[:.](\d{2})\s*(?:-|–|—)\s*(\d{1,2})[:.](\d{2})/);
  if (!m) return { start_time: null, end_time: null };
  const pad = (h: string, mm: string) => `${h.padStart(2, "0")}:${mm}:00`;
  return { start_time: pad(m[1], m[2]), end_time: pad(m[3], m[4]) };
}

function dayIndex(label: string): number {
  const i = DAYS.findIndex((d) => label.trim().toLowerCase().startsWith(d.toLowerCase().slice(0, 3)));
  return i >= 0 ? i + 1 : 0;
}

function rowsToSlots(rows: string[][]): SlotRow[] {
  const slots: SlotRow[] = [];
  // Find header row: a row whose cells mostly contain time ranges
  let headerIdx = -1;
  for (let r = 0; r < Math.min(rows.length, 6); r++) {
    const timeCells = rows[r].filter((c) => /\d{1,2}[:.]\d{2}\s*(?:-|–|—)\s*\d{1,2}[:.]\d{2}/.test(c)).length;
    if (timeCells >= Math.max(2, Math.floor(rows[r].length / 2))) {
      headerIdx = r;
      break;
    }
  }
  if (headerIdx === -1) return slots;

  const header = rows[headerIdx];
  // Period columns = header cells with time ranges
  const periods: { idx: number; label: string; start_time: string | null; end_time: string | null }[] = [];
  header.forEach((cell, idx) => {
    if (/\d{1,2}[:.]\d{2}/.test(cell) && (/-|–|—/.test(cell))) {
      const { start_time, end_time } = parseTimeRange(cell);
      periods.push({ idx, label: cell.trim(), start_time, end_time });
    }
  });

  for (let r = headerIdx + 1; r < rows.length; r++) {
    const row = rows[r];
    const d = row.length ? dayIndex(row[0]) : 0;
    if (!d) continue;
    periods.forEach((p, order) => {
      const cell = (row[p.idx] ?? "").trim();
      slots.push({
        day_of_week: d,
        period_label: p.label,
        start_time: p.start_time,
        end_time: p.end_time,
        content: cell.replace(/\s*\n\s*/g, "\n").trim(),
        kind: classify(cell),
        sort_order: order,
      });
    });
  }
  return slots;
}

async function parseCsv(file: File): Promise<{ slots: SlotRow[] }> {
  const text = await file.text();
  // Simple CSV parsing handling quoted cells with embedded newlines
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((c) => c.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((c) => c.trim() !== "")) rows.push(row);
  return { slots: rowsToSlots(rows) };
}

async function parseXlsx(file: File): Promise<{ slots: SlotRow[] }> {
  const XLSX = await import("xlsx");
  const buf = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, blankrows: false, defval: "" });
  return { slots: rowsToSlots(rows.map((r) => r.map((c) => String(c ?? "")))) };
}

async function parseImageWithOpenAI(base64: string, mime: string): Promise<SlotRow[] | null> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o",
        max_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              'You extract school timetables from images. Return JSON: {"periods":[{"label":"7:45-8:00"}],"rows":[{"day":"Monday","cells":["ELL 1\\n13\\nRm 23","REG",...]}]}. Cells in the same order as the periods array. Preserve multi-line cell text.',
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Extract this timetable." },
              { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(90_000),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? "{}");
    const periods: { label: string }[] = parsed.periods ?? [];
    const rows: { day: string; cells: string[] }[] = parsed.rows ?? [];
    const slots: SlotRow[] = [];
    rows.forEach((r) => {
      const d = dayIndex(r.day);
      if (!d) return;
      periods.forEach((p, order) => {
        const cell = (r.cells?.[order] ?? "").toString().trim();
        const { start_time, end_time } = parseTimeRange(p.label);
        slots.push({
          day_of_week: d,
          period_label: p.label,
          start_time,
          end_time,
          content: cell,
          kind: classify(cell),
          sort_order: order,
        });
      });
    });
    return slots.length ? slots : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: "File exceeds the 10MB limit" }, { status: 413 });
    }

    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    let fileType: "csv" | "xlsx" | "image";
    if (ext === "csv" || ext === "txt") fileType = "csv";
    else if (ext === "xlsx" || ext === "xls") fileType = "xlsx";
    else if (["png", "jpg", "jpeg", "webp"].includes(ext)) fileType = "image";
    else return NextResponse.json({ error: `Unsupported file type: .${ext}` }, { status: 415 });

    // Resolve user's school
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile?.school_id) {
      return NextResponse.json({ error: "No school found on your profile. Complete onboarding first." }, { status: 400 });
    }

    // Upload original to storage
    const storagePath = `${user.id}/${crypto.randomUUID()}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("timetables")
      .upload(storagePath, file, { contentType: file.type || "application/octet-stream" });
    if (upErr) {
      return NextResponse.json({ error: `Storage upload failed: ${upErr.message}` }, { status: 500 });
    }

    // Create import row
    const { data: imp, error: impErr } = await supabase
      .from("timetable_imports")
      .insert({
        school_id: profile.school_id,
        uploaded_by: user.id,
        file_name: file.name,
        storage_path: storagePath,
        file_type: fileType,
        status: "processing",
      })
      .select("id")
      .single();
    if (impErr || !imp) {
      await supabase.storage.from("timetables").remove([storagePath]);
      return NextResponse.json({ error: impErr?.message ?? "Failed to create import" }, { status: 500 });
    }

    try {
      let slots: SlotRow[] = [];
      if (fileType === "csv") slots = (await parseCsv(file)).slots;
      else if (fileType === "xlsx") slots = (await parseXlsx(file)).slots;
      else {
        const buf = Buffer.from(await file.arrayBuffer());
        slots = (await parseImageWithOpenAI(buf.toString("base64"), file.type || "image/png")) ?? [];
      }

      if (!slots.length && fileType !== "image") throw new Error("Could not find a timetable grid (day rows + period time-range columns) in this file.");

      if (slots.length) {
        const { error: slotErr } = await supabase.from("timetable_slots").insert(
          slots.map((s) => ({ ...s, import_id: imp.id }))
        );
        if (slotErr) throw new Error(slotErr.message);
      }

      const status = slots.length ? "completed" : "pending";
      const errorMessage = slots.length ? null
        : fileType === "image"
          ? "Image saved. AI parsing is unavailable (no OPENAI_API_KEY configured) — the original is stored and can be reprocessed later."
          : "No timetable grid detected.";
      await supabase
        .from("timetable_imports")
        .update({ status, error_message: errorMessage })
        .eq("id", imp.id);

      return NextResponse.json({ id: imp.id, status, slots: slots.length });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Parsing failed";
      await supabase
        .from("timetable_imports")
        .update({ status: "failed", error_message: message })
        .eq("id", imp.id);
      return NextResponse.json({ id: imp.id, status: "failed", error: message }, { status: 200 });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
