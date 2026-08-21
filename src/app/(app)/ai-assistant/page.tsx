"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
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

type ContextType = "observation" | "meeting" | "task" | "goal" | "staff";

interface ContextOption {
  type: ContextType;
  id: string;
  label: string;
}

interface GeneratedTask {
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  deadline: string | null;
}

const ACTION_QUERY_PARAM_MAP: Record<string, string> = {
  feedback: "observation_feedback",
};

function AiAssistantContent() {
  const searchParams = useSearchParams();
  const requestedAction = ACTION_QUERY_PARAM_MAP[searchParams.get("action") ?? ""];
  const requestedContextType = searchParams.get("context");
  const requestedContextId = searchParams.get("id");
  const [mockMode, setMockMode] = useState<boolean | null>(null);
  const [selectedActionId, setSelectedActionId] = useState<string | null>(null);
  const [contextKey, setContextKey] = useState("");
  const [contextOptions, setContextOptions] = useState<ContextOption[]>([]);
  const [contextsLoading, setContextsLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [approving, setApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [output, setOutput] = useState<string | null>(null);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTask[]>([]);
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
      .then((d) => {
        const contexts = Array.isArray(d.contexts) ? (d.contexts as ContextOption[]) : [];
        setMockMode(Boolean(d.mock));
        setContextOptions(contexts);
        const requestedContext = contexts.find(
          (option) =>
            option.type === requestedContextType && option.id === requestedContextId
        );
        if (requestedContext) {
          setContextKey(`${requestedContext.type}:${requestedContext.id}`);
        }
      })
      .catch(() => setMockMode(true))
      .finally(() => setContextsLoading(false));
  }, [requestedContextId, requestedContextType]);

  const action = selectedActionId ?? requestedAction ?? ACTIONS[0].id;
  const selectedAction = ACTIONS.find((a) => a.id === action)!;
  const selectedContext = contextOptions.find(
    (option) => `${option.type}:${option.id}` === contextKey
  );
  const contextLabel = selectedContext?.label ?? "";

  async function generate() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setOutput(null);
    setGeneratedTasks([]);
    setEditing(false);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          context: selectedContext ? contextLabel : "",
          contextRef: selectedContext
            ? { type: selectedContext.type, id: selectedContext.id }
            : undefined,
          prompt,
          styleReference: styleReference || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setOutput(data.text);
      setGeneratedTasks(
        Array.isArray(data.tasks) ? (data.tasks as GeneratedTask[]) : []
      );
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
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Failed to read file (${res.status})`);
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
      context_type: selectedContext?.type,
      context_id: selectedContext?.id,
      input_prompt: prompt || undefined,
      output_text: text,
      is_approved: approved,
      is_discarded: discarded,
      created_at: new Date().toISOString(),
    };
    setHistory((h) => [draft, ...h]);
  }

  async function handleApprove() {
    if (!output) return;
    setApproving(true);
    setError(null);
    try {
      if (action === "observation_feedback" && selectedContext?.type === "observation") {
        const response = await fetch(
          `/api/observations/${selectedContext.id}/feedback`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ feedback: output }),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Feedback could not be saved");
        }
      }
      if (action === "notes_to_tasks") {
        if (generatedTasks.length === 0) {
          throw new Error("No validated tasks are ready to create");
        }
        const response = await fetch("/api/ai/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tasks: generatedTasks }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(data.error || "Tasks could not be created");
        }
        setNotice(
          `${data.count} ${data.count === 1 ? "task" : "tasks"} created. They are now available on the Tasks page.`
        );
      }

      pushToHistory(output, true, false);
      setOutput(null);
      setGeneratedTasks([]);
      setPrompt("");
      setNotesTruncated(false);
    } catch (approveError) {
      setError(
        approveError instanceof Error
          ? approveError.message
          : "The draft could not be approved"
      );
    } finally {
      setApproving(false);
    }
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
                  onClick={() => setSelectedActionId(a.id)}
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
              value={contextKey}
              onChange={(e) => setContextKey(e.target.value)}
              disabled={contextsLoading}
            >
              <option value="">
                {contextsLoading
                  ? "Loading workspace context…"
                  : "No context selected — general assistant mode"}
              </option>
              {contextOptions.map((contextOption) => (
                <option
                  key={`${contextOption.type}:${contextOption.id}`}
                  value={`${contextOption.type}:${contextOption.id}`}
                >
                  {contextOption.label}
                </option>
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
                    onClick={() => { setStyleReference(""); setStyleReferenceFileName(null); setStyleTruncated(false); }}
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
                {selectedContext ? contextLabel : "No context selected — general assistant mode"}
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

          {notice && (
            <div
              className="rounded-lg border px-4 py-3 text-sm"
              style={{
                background: "var(--color-success-bg)",
                borderColor: "var(--color-success)",
                color: "var(--color-success)",
              }}
              role="status"
            >
              {notice}
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
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={handleApprove}
                      disabled={approving}
                    >
                      {approving ? (
                        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" aria-hidden />
                      )}
                      {approving
                        ? "Saving…"
                        : action === "notes_to_tasks" && generatedTasks.length > 0
                          ? `Create ${generatedTasks.length} ${generatedTasks.length === 1 ? "task" : "tasks"}`
                          : "Approve"}
                    </button>
                    {action !== "notes_to_tasks" && (
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => { setEditText(output); setEditing(true); }}
                      >
                        <PenLine className="h-4 w-4" aria-hidden /> Edit
                      </button>
                    )}
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

export default function AiAssistantPage() {
  return (
    <Suspense fallback={<div className="skeleton h-96 rounded-lg" />}>
      <AiAssistantContent />
    </Suspense>
  );
}
