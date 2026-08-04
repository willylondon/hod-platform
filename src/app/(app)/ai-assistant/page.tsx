"use client";

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
import type { AiDraft } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

const ACTIONS = [
  { id: "draft_email", label: "Draft Email", icon: Mail },
  { id: "meeting_agenda", label: "Create Meeting Agenda", icon: CalendarDays },
  { id: "summarize_notes", label: "Summarize Notes", icon: FileText },
  { id: "observation_feedback", label: "Draft Observation Feedback", icon: Eye },
  { id: "appraisal_comments", label: "Generate Appraisal Comments", icon: Award },
  { id: "parent_communication", label: "Draft Parent Communication", icon: Users },
  { id: "checklist", label: "Generate Checklist", icon: ListChecks },
  { id: "review_workflow", label: "Review Workflow", icon: Workflow },
  { id: "recommend_actions", label: "Recommend Next Actions", icon: Compass },
  { id: "rewrite_professionally", label: "Rewrite Professionally", icon: PenLine },
  { id: "notes_to_tasks", label: "Convert Notes Into Tasks", icon: ListTodo },
];

const CONTEXT_OPTIONS = [
  { id: "", label: "No context selected — general assistant mode" },
  { id: "obs-1", label: "Observation — Jane Smith, Year 10 Maths (feedback pending)" },
  { id: "goal-1", label: "Goal — Raise GCSE attainment in English by 8%" },
  { id: "meeting-1", label: "Meeting — Department Meeting, Wednesday 3:30pm" },
  { id: "task-1", label: "Task — Compile Year 11 intervention list" },
  { id: "staff-1", label: "Staff Member — David Okafor (appraisal due)" },
  { id: "workflow-1", label: "Workflow — End of Term Reporting Process" },
];

const ACTION_QUERY_PARAM_MAP: Record<string, string> = {
  feedback: "observation_feedback",
};

export default function AiAssistantPage() {
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

  useEffect(() => {
    fetch("/api/ai")
      .then((r) => r.json())
      .then((d) => setMockMode(Boolean(d.mock)))
      .catch(() => setMockMode(true));
  }, []);

  useEffect(() => {
    const requestedAction = ACTION_QUERY_PARAM_MAP[new URLSearchParams(window.location.search).get("action") ?? ""];
    if (requestedAction) setAction(requestedAction);
  }, []);

  const selectedAction = ACTIONS.find((a) => a.id === action)!;
  const contextLabel = CONTEXT_OPTIONS.find((c) => c.id === contextId)?.label ?? "";

  async function generate() {
    setLoading(true);
    setError(null);
    setOutput(null);
    setEditing(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, context: contextId ? contextLabel : "", prompt, styleReference: styleReference || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.text);
      setMockMode(Boolean(data.mock));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

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

  function pushToHistory(text: string, approved: boolean, discarded: boolean) {
    const draft: AiDraft = {
      id: crypto.randomUUID(),
      user_id: "local",
      action: selectedAction.label,
      context_type: contextId ? contextLabel.split(" — ")[0] : undefined,
      context_id: contextId || undefined,
      input_prompt: prompt || undefined,
      output_text: text,
      is_approved: approved,
      is_discarded: discarded,
      created_at: new Date().toISOString(),
    };
    setHistory((h) => [draft, ...h]);
  }

  function handleApprove() {
    if (!output) return;
    pushToHistory(output, true, false);
    setOutput(null);
    setPrompt("");
  }

  function handleDiscard() {
    if (!output) return;
    pushToHistory(output, false, true);
    setOutput(null);
  }

  function handleSaveEdit() {
    setOutput(editText);
    setEditing(false);
  }

  const visibleHistory = history.filter((d) => !d.is_discarded);

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="flex-between mb-4">
        <div>
          <h1 className="flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-accent" aria-hidden />
            AI Assistant
          </h1>
          <p className="text-muted mt-1 text-sm">
            Draft communications, feedback, agendas and plans with AI support.
          </p>
        </div>
      </div>

      {/* Mock banner */}
      {mockMode === true && (
        <div
          className="mb-4 flex items-center gap-3 rounded-lg border px-4 py-3"
          style={{
            background: "var(--color-warning-bg)",
            borderColor: "var(--color-warning)",
            color: "var(--color-warning)",
          }}
          role="status"
        >
          <Sparkles className="h-5 w-5 shrink-0" aria-hidden />
          <div className="text-sm">
            <strong>Mock AI Mode.</strong> No <code>OPENROUTER_API_KEY</code> is configured, so
            responses are generated locally as realistic samples. Add the key to enable live AI.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: action selector */}
        <div className="card lg:col-span-1">
          <h3 className="mb-4">Choose an action</h3>
          <div className="flex flex-col gap-1" role="listbox" aria-label="AI actions">
            {ACTIONS.map((a) => {
              const Icon = a.icon;
              const active = a.id === action;
              return (
                <button
                  key={a.id}
                  onClick={() => setAction(a.id)}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors",
                    active
                      ? "bg-primary font-medium"
                      : "hover:bg-surface-alt text-text"
                  )}
                  style={active ? { color: "var(--color-text-inverse)" } : undefined}
                  aria-selected={active}
                  role="option"
                >
                  <Icon className="h-4 w-4 shrink-0" aria-hidden />
                  {a.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: context + prompt + output */}
        <div className="flex flex-col gap-4 lg:col-span-2">
          <div className="card">
            <label className="form-label" htmlFor="ai-context">Context</label>
            <select
              id="ai-context"
              className="form-select mb-4"
              value={contextId}
              onChange={(e) => setContextId(e.target.value)}
            >
              {CONTEXT_OPTIONS.map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>

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
              <span className="text-muted text-xs">
                {contextId ? contextLabel : "No context selected — general assistant mode"}
              </span>
              <button
                className="btn btn-primary"
                onClick={generate}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                    Generating…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" aria-hidden />
                    Generate
                  </>
                )}
              </button>
            </div>
          </div>

          {error && (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                background: "var(--color-error-bg)",
                borderColor: "var(--color-error)",
                color: "var(--color-error)",
              }}
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Output */}
          {output && (
            <div className="card animate-fade-in">
              <div className="flex-between mb-4">
                <h3 className="flex items-center gap-2">
                  <selectedAction.icon className="h-5 w-5 text-primary" aria-hidden />
                  {selectedAction.label} — Draft
                </h3>
                {mockMode && <span className="badge badge-high">Mock</span>}
              </div>

              {editing ? (
                <>
                  <textarea
                    className="form-input mb-4 min-h-64 resize-y font-mono text-sm"
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    aria-label="Edit draft"
                  />
                  <div className="flex gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleSaveEdit}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Save changes
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditing(false)}>
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div
                    className="mb-4 rounded-md p-4 text-sm whitespace-pre-wrap"
                    style={{ background: "var(--color-surface-alt)" }}
                  >
                    {output}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button className="btn btn-primary btn-sm" onClick={handleApprove}>
                      <CheckCircle2 className="h-4 w-4" aria-hidden /> Approve
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setEditText(output); setEditing(true); }}
                    >
                      <PenLine className="h-4 w-4" aria-hidden /> Edit
                    </button>
                    <button className="btn btn-ghost btn-sm" onClick={handleDiscard}>
                      <Trash2 className="h-4 w-4" aria-hidden /> Discard
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* History */}
          {visibleHistory.length > 0 && (
            <div className="card">
              <h3 className="mb-4">Previous drafts</h3>
              <div className="flex flex-col gap-3">
                {visibleHistory.map((d) => (
                  <details
                    key={d.id}
                    className="rounded-md border p-3"
                    style={{ borderColor: "var(--color-border)" }}
                  >
                    <summary className="flex cursor-pointer items-center justify-between gap-2 text-sm font-medium">
                      <span>{d.action}</span>
                      <span className="flex items-center gap-2">
                        {d.is_approved && <span className="badge badge-success">Approved</span>}
                        <span className="text-muted text-xs">{formatDateTime(d.created_at)}</span>
                      </span>
                    </summary>
                    <div className="text-muted mt-2 text-sm whitespace-pre-wrap">
                      {d.output_text}
                    </div>
                  </details>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
