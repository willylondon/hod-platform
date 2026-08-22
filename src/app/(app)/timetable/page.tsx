"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Upload, CalendarClock, Trash2, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import type { TimetableImport, TimetableSlot } from "@/lib/types";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

const KIND_STYLES: Record<string, string> = {
  class: "bg-info-bg text-info border border-info/20",
  registration: "bg-surface-alt text-text-muted",
  break: "bg-warning-bg text-warning",
  lunch: "bg-warning-bg text-warning",
  assembly: "bg-success-bg text-success",
  meeting: "bg-error-bg text-error",
  clubs: "bg-accent-light/30 text-primary",
  free: "bg-surface-alt text-text-muted/50",
};

const STATUS_BADGE: Record<string, string> = {
  completed: "badge badge-success",
  pending: "badge badge-medium",
  processing: "badge badge-medium",
  failed: "badge badge-urgent",
};

function timeLabel(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  return `${h}:${m}`;
}

export default function TimetablePage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [imports, setImports] = useState<TimetableImport[]>([]);
  const [slots, setSlots] = useState<TimetableSlot[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadSlots = useCallback(
    async (importId: string) => {
      setSelected(importId);
      setSlots([]);
      const { data } = await supabase
        .from("timetable_slots")
        .select("*")
        .eq("import_id", importId)
        .order("sort_order");
      setSlots((data as TimetableSlot[]) ?? []);
    },
    [supabase]
  );

  const loadImports = useCallback(async () => {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: profile } = await supabase
      .from("profiles")
      .select("school_id")
      .eq("id", userData.user.id)
      .maybeSingle();
    if (!profile?.school_id) {
      setError("Complete onboarding to set your school before uploading timetables.");
      setLoading(false);
      return;
    }
    const { data, error: err } = await supabase
      .from("timetable_imports")
      .select("*")
      .eq("school_id", profile.school_id)
      .order("uploaded_at", { ascending: false });
    if (err) setError(err.message);
    const list = (data as TimetableImport[]) ?? [];
    setImports(list);
    const firstCompleted = list.find((i) => i.status === "completed");
    if (firstCompleted) await loadSlots(firstCompleted.id);
    setLoading(false);
  }, [supabase, loadSlots]);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  const uploadFile = async (file: File) => {
    setError(null);
    setUploading(true);
    try {
      const res = await fetch("/api/timetable/upload", { method: "POST", body: (() => { const fd = new FormData(); fd.append("file", file); return fd; })() });
      const json = await res.json();
      if (!res.ok && !json.id) throw new Error(json.error ?? `Upload failed (${res.status})`);
      if (json.error || json.status === "failed" || json.status === "pending") {
        setError(json.error ?? json.errorMessage ?? null);
      }
      await loadImports();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deleteImport = async (id: string) => {
    await supabase.from("timetable_imports").delete().eq("id", id);
    if (selected === id) { setSelected(null); setSlots([]); }
    setImports((prev) => prev.filter((i) => i.id !== id));
  };

  // Build grid
  const periods: { label: string; start_time: string | null; end_time: string | null }[] = [];
  slots.forEach((s) => {
    if (!periods.some((p) => p.label === s.period_label))
      periods.push({ label: s.period_label, start_time: s.start_time, end_time: s.end_time });
  });
  periods.sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));
  const cellFor = (day: number, period: string) =>
    slots.find((s) => s.day_of_week === day && s.period_label === period);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <CalendarClock className="w-7 h-7 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Timetable</h1>
          <p className="text-sm text-muted">Upload and view department timetables — CSV, XLSX or image.</p>
        </div>
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload timetable file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) uploadFile(f);
        }}
        className={`card mb-6 flex flex-col items-center justify-center gap-2 py-10 cursor-pointer text-center transition-colors ${
          dragging ? "border-primary bg-surface-alt" : ""
        }`}
      >
        <Upload className={`w-8 h-8 ${uploading ? "animate-pulse text-primary" : "text-muted"}`} />
        {uploading ? (
          <p className="text-sm font-medium">Uploading &amp; parsing…</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop a timetable file here, or click to browse</p>
            <p className="text-xs text-muted">CSV, XLSX or image (PNG/JPG) · max 10MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadFile(f);
            e.target.value = "";
          }}
        />
      </div>

      {error && (
        <div className="card p-4 mb-6 border-l-4 border-l-error bg-error-bg/10 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error shrink-0 mt-0.5" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          <div className="skeleton h-16 w-full" />
          <div className="skeleton h-64 w-full" />
        </div>
      ) : imports.length === 0 ? (
        <div className="text-center py-12">
          <CalendarClock className="w-12 h-12 text-muted mx-auto mb-3" />
          <p className="font-medium mb-1">No timetables uploaded yet</p>
          <p className="text-sm text-muted">Upload a CSV, XLSX export or a photo of your timetable above.</p>
        </div>
      ) : (
        <>
          {/* Imports list */}
          <div className="card mb-6 divide-y divide-border">
            {imports.map((imp) => (
              <div key={imp.id} className="flex items-center gap-3 p-3">
                <button
                  onClick={() => imp.status === "completed" && loadSlots(imp.id)}
                  className="flex-1 text-left min-w-0"
                  disabled={imp.status !== "completed"}
                >
                  <p className="text-sm font-medium truncate">{imp.file_name}</p>
                  <p className="text-xs text-muted">
                    {new Date(imp.uploaded_at).toLocaleString()} · {(imp.file_type ?? "?").toUpperCase()}
                    {imp.error_message ? ` · ${imp.error_message}` : ""}
                  </p>
                </button>
                <span className={`${STATUS_BADGE[imp.status] ?? "badge badge-low"} text-xs capitalize shrink-0`}>
                  {imp.status === "completed" && <CheckCircle2 className="w-3 h-3" />}
                  {imp.status === "processing" && <Clock className="w-3 h-3 animate-spin" />}
                  {(imp.status === "failed" || imp.status === "pending") && <AlertCircle className="w-3 h-3" />}
                  {imp.status}
                </span>
                <button
                  onClick={() => deleteImport(imp.id)}
                  className="btn btn-secondary btn-sm shrink-0"
                  aria-label={`Delete ${imp.file_name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Weekly grid */}
          {selected && (
            <div className="card overflow-x-auto">
              <h2 className="text-lg font-semibold mb-4 px-4 pt-4">Weekly Timetable</h2>
              {periods.length === 0 ? (
                <p className="px-4 pb-4 text-sm text-muted">No parsed periods for this import.</p>
              ) : (
                <table className="w-full text-xs border-collapse min-w-[720px]">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-surface p-2 text-left border-b border-border">Day</th>
                      {periods.map((p) => (
                        <th key={p.label} className="p-2 border-b border-l border-border text-left align-bottom">
                          <span className="block font-semibold whitespace-nowrap">{timeLabel(p.start_time)}–{timeLabel(p.end_time)}</span>
                          <span className="block font-normal text-muted whitespace-nowrap">{p.label}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {DAYS.map((dayName, di) => (
                      <tr key={dayName}>
                        <td className="sticky left-0 bg-surface p-2 font-medium border-b border-border">{dayName}</td>
                        {periods.map((p) => {
                          const cell = cellFor(di + 1, p.label);
                          const kind = cell?.kind ?? "free";
                          return (
                            <td key={p.label} className="border-b border-l border-border p-1 align-top">
                              <div className={`rounded-md p-2 min-h-[48px] whitespace-pre-line ${KIND_STYLES[kind]}`}>
                                {cell?.content || ""}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
