import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

export const dynamic = "force-dynamic";

// Vercel's serverless functions cap request bodies at 4.5MB, so this stays under that
// with headroom for multipart overhead.
const MAX_FILE_BYTES = 4 * 1024 * 1024; // 4MB
const MAX_TEXT_CHARS = 15000;
const PDF_PAGE_MARKER = /^-- \d+ of \d+ --$/gm;

function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf(".");
  return dot === -1 ? "" : fileName.slice(dot).toLowerCase();
}

export async function POST(request: Request) {
  // Cheap pre-check before buffering the full body via formData(): some clients/proxies
  // omit or lie about Content-Length, so this is a best-effort fast path, not a replacement
  // for the post-parse file.size check below.
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_FILE_BYTES) {
    return NextResponse.json({ error: "File is too large (max 4MB)" }, { status: 400 });
  }

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
    return NextResponse.json({ error: "File is too large (max 4MB)" }, { status: 400 });
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
      try {
        const result = await parser.getText();
        text = result.text.replace(PDF_PAGE_MARKER, "");
      } finally {
        await parser.destroy();
      }
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
