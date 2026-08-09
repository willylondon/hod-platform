"use client";
export const dynamic = "force-dynamic";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isOverdue } from "@/lib/utils";
import type { ChecklistItem, Priority, Task, TaskAttachment, TaskStatus } from "@/lib/types";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  Download,
  FileText,
  Layers,
  LayoutGrid,
  LayoutList,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const STATUSES: TaskStatus[] = ["not_started", "in_progress", "waiting", "completed", "cancelled"];
const PRIORITIES: Priority[] = ["low", "medium", "high", "urgent"];
const STATUS_LABELS: Record<TaskStatus, string> = {
  not_started: "Not Started",
  in_progress: "In Progress",
  waiting: "Waiting",
  completed: "Completed",
  cancelled: "Cancelled",
};
const MAX_FILES = 5;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const FILE_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.jpg,.jpeg,.png";

function priorityBadge(priority: Priority): string {
  if (priority === "urgent") return "badge-urgent";
  if (priority === "high") return "badge-high";
  if (priority === "medium") return "badge-medium";
  return "badge-low";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDeadline(deadline: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(deadline));
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [checklistItems, setChecklistItems] = useState<ChecklistItem[]>([]);
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", priority: "", search: "" });
  const [view, setView] = useState<"list" | "board" | "grouped">("list");
  const [showForm, setShowForm] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [uploadingTaskId, setUploadingTaskId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("medium");
  const [newDeadlineDate, setNewDeadlineDate] = useState("");
  const [newDeadlineTime, setNewDeadlineTime] = useState("16:00");
  const [newChecklist, setNewChecklist] = useState<string[]>([""]);
  const [newFiles, setNewFiles] = useState<File[]>([]);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    Promise.all([
      supabase.from("tasks").select("*").order("deadline", { ascending: true }),
      supabase.from("checklist_items").select("*").eq("parent_type", "task").order("sort_order"),
      supabase.from("task_attachments").select("*").order("created_at"),
    ]).then(([taskResult, checklistResult, attachmentResult]) => {
      if (!active) return;
      if (taskResult.error) setError(taskResult.error.message);
      setTasks((taskResult.data as Task[]) || []);
      setChecklistItems((checklistResult.data as ChecklistItem[]) || []);
      setAttachments((attachmentResult.data as TaskAttachment[]) || []);
      setLoading(false);
    });

    return () => { active = false; };
  }, []);

  function itemsFor(taskId: string): ChecklistItem[] {
    return checklistItems.filter((item) => item.parent_id === taskId);
  }

  function filesFor(taskId: string): TaskAttachment[] {
    return attachments.filter((attachment) => attachment.task_id === taskId);
  }

  function resetForm() {
    setNewTitle("");
    setNewDescription("");
    setNewPriority("medium");
    setNewDeadlineDate("");
    setNewDeadlineTime("16:00");
    setNewChecklist([""]);
    setNewFiles([]);
  }

  function cancelForm() {
    resetForm();
    setShowForm(false);
    setError(null);
  }

  function selectFiles(fileList: FileList | null) {
    if (!fileList) return;
    const incoming = Array.from(fileList);
    const oversized = incoming.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than the 10 MB document limit.`);
      return;
    }
    if (newFiles.length + incoming.length > MAX_FILES) {
      setError(`You can attach up to ${MAX_FILES} documents to a task.`);
      return;
    }
    setError(null);
    setNewFiles((files) => [...files, ...incoming]);
  }

  async function uploadDocuments(taskId: string, userId: string, files: File[]): Promise<TaskAttachment[]> {
    const supabase = createClient();
    const uploaded: TaskAttachment[] = [];

    for (const file of files) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${userId}/${taskId}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("task-documents")
        .upload(filePath, file, { contentType: file.type || undefined, upsert: false });
      if (uploadError) throw uploadError;

      const { data, error: metadataError } = await supabase
        .from("task_attachments")
        .insert({
          task_id: taskId,
          uploaded_by: userId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || null,
        })
        .select()
        .single();

      if (metadataError) {
        await supabase.storage.from("task-documents").remove([filePath]);
        throw metadataError;
      }
      uploaded.push(data as TaskAttachment);
    }

    return uploaded;
  }

  async function createTask(event: React.FormEvent) {
    event.preventDefault();
    const title = newTitle.trim();
    if (!title || creating) return;

    setCreating(true);
    setError(null);
    const supabase = createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      setError("Your session has expired. Please sign in again before adding a task.");
      setCreating(false);
      return;
    }

    const deadline = newDeadlineDate
      ? new Date(`${newDeadlineDate}T${newDeadlineTime || "16:00"}`).toISOString()
      : null;
    const { data, error: insertError } = await supabase
      .from("tasks")
      .insert({
        title,
        description: newDescription.trim() || null,
        priority: newPriority,
        deadline,
        status: "not_started",
        is_recurring: false,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      setError(insertError.message);
      setCreating(false);
      return;
    }

    const task = data as Task;
    const miniSteps = newChecklist.map((title) => title.trim()).filter(Boolean);
    let createdItems: ChecklistItem[] = [];
    let createdAttachments: TaskAttachment[] = [];
    let additionError: string | null = null;

    if (miniSteps.length > 0) {
      const { data: rows, error: checklistError } = await supabase
        .from("checklist_items")
        .insert(miniSteps.map((step, index) => ({
          parent_type: "task",
          parent_id: task.id,
          title: step,
          completed: false,
          sort_order: index,
        })))
        .select();
      if (checklistError) additionError = "the mini-checklist could not be saved";
      else createdItems = (rows as ChecklistItem[]) || [];
    }

    if (newFiles.length > 0) {
      try {
        createdAttachments = await uploadDocuments(task.id, user.id, newFiles);
      } catch (uploadError) {
        additionError = additionError
          ? `${additionError}, and one or more documents could not be uploaded`
          : "one or more documents could not be uploaded";
        console.error("Task document upload failed:", uploadError);
      }
    }

    setTasks((current) => [task, ...current]);
    setChecklistItems((current) => [...current, ...createdItems]);
    setAttachments((current) => [...current, ...createdAttachments]);
    setExpandedTaskId(task.id);
    resetForm();
    setShowForm(false);
    setCreating(false);
    if (additionError) setError(`Task created, but ${additionError}.`);
  }

  async function toggleStatus(task: Task) {
    const supabase = createClient();
    const next: TaskStatus = task.status === "completed" ? "not_started" : "completed";
    const completedAt = next === "completed" ? new Date().toISOString() : null;
    const { error: updateError } = await supabase.from("tasks").update({ status: next, completed_at: completedAt }).eq("id", task.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setTasks((current) => current.map((item) => item.id === task.id ? {
      ...item,
      status: next,
      completed_at: completedAt || undefined,
    } : item));
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    const supabase = createClient();
    const { error: updateError } = await supabase.from("checklist_items").update({ completed: !item.completed }).eq("id", item.id);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setChecklistItems((current) => current.map((row) => row.id === item.id ? { ...row, completed: !row.completed } : row));
  }

  async function addDocumentsToTask(task: Task, fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);
    if (files.length + filesFor(task.id).length > MAX_FILES) {
      setError(`A task can have up to ${MAX_FILES} documents.`);
      return;
    }
    const oversized = files.find((file) => file.size > MAX_FILE_BYTES);
    if (oversized) {
      setError(`${oversized.name} is larger than the 10 MB document limit.`);
      return;
    }

    setUploadingTaskId(task.id);
    setError(null);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setError("Your session has expired. Please sign in again.");
      setUploadingTaskId(null);
      return;
    }
    try {
      const uploaded = await uploadDocuments(task.id, user.id, files);
      setAttachments((current) => [...current, ...uploaded]);
    } catch (uploadError) {
      console.error("Task document upload failed:", uploadError);
      setError("The document could not be uploaded. Please try again.");
    } finally {
      setUploadingTaskId(null);
    }
  }

  async function downloadDocument(attachment: TaskAttachment) {
    setDownloadingId(attachment.id);
    setError(null);
    const supabase = createClient();
    const { data, error: downloadError } = await supabase.storage.from("task-documents").download(attachment.file_path);
    if (downloadError || !data) {
      setError(downloadError?.message || "The document could not be downloaded.");
      setDownloadingId(null);
      return;
    }
    const url = URL.createObjectURL(data);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = attachment.file_name;
    anchor.click();
    URL.revokeObjectURL(url);
    setDownloadingId(null);
  }

  const filtered = tasks.filter((task) => {
    if (filter.status && task.status !== filter.status) return false;
    if (filter.priority && task.priority !== filter.priority) return false;
    if (filter.search && !task.title.toLowerCase().includes(filter.search.toLowerCase())) return false;
    return true;
  });

  const grouped = STATUSES.map((status) => ({
    key: status,
    tasks: filtered.filter((task) => task.status === status),
  }));

  function checklistSummary(taskId: string) {
    const items = itemsFor(taskId);
    const completed = items.filter((item) => item.completed).length;
    return { items, completed, percent: items.length ? Math.round((completed / items.length) * 100) : 0 };
  }

  function taskDetails(task: Task) {
    const checklist = checklistSummary(task.id);
    const documents = filesFor(task.id);
    return (
      <div className="border-t border-border bg-surface-alt/50 px-4 py-4 md:px-12">
        {task.description && <p className="mb-4 text-sm leading-6 text-muted">{task.description}</p>}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <section aria-labelledby={`checklist-${task.id}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 id={`checklist-${task.id}`} className="text-sm font-semibold">Mini-checklist</h3>
                <p className="text-xs text-muted">
                  {checklist.items.length ? `${checklist.completed} of ${checklist.items.length} mini-steps complete` : "No mini-steps added"}
                </p>
              </div>
              {checklist.items.length > 0 && <span className="text-xs font-semibold text-primary">{checklist.percent}%</span>}
            </div>
            {checklist.items.length > 0 && (
              <>
                <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-border" aria-hidden>
                  <div className="h-full rounded-full bg-success transition-all" style={{ width: `${checklist.percent}%` }} />
                </div>
                <div className="space-y-1.5">
                  {checklist.items.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleChecklistItem(item)}
                      className="flex w-full items-start gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-surface"
                    >
                      {item.completed
                        ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden />
                        : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" aria-hidden />}
                      <span className={item.completed ? "text-muted line-through" : ""}>{item.title}</span>
                    </button>
                  ))}
                </div>
                {checklist.completed === checklist.items.length && task.status !== "completed" && (
                  <button type="button" onClick={() => toggleStatus(task)} className="btn btn-primary btn-sm mt-3">
                    <Check className="h-3.5 w-3.5" aria-hidden /> Mark task complete
                  </button>
                )}
              </>
            )}
          </section>

          <section aria-labelledby={`documents-${task.id}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 id={`documents-${task.id}`} className="text-sm font-semibold">Documents</h3>
                <p className="text-xs text-muted">PDF, Office, text, CSV or image · 10 MB each</p>
              </div>
              <label className="btn btn-secondary btn-sm cursor-pointer">
                {uploadingTaskId === task.id
                  ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  : <Upload className="h-3.5 w-3.5" aria-hidden />}
                {uploadingTaskId === task.id ? "Uploading…" : "Add"}
                <input
                  type="file"
                  multiple
                  accept={FILE_ACCEPT}
                  className="sr-only"
                  disabled={uploadingTaskId === task.id || documents.length >= MAX_FILES}
                  onChange={(event) => {
                    addDocumentsToTask(task, event.target.files);
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            {documents.length === 0 ? (
              <div className="rounded-md border border-dashed border-border px-4 py-5 text-center text-xs text-muted">
                <FileText className="mx-auto mb-2 h-5 w-5" aria-hidden />
                Keep supporting documents with this task.
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map((attachment) => (
                  <div key={attachment.id} className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
                    <FileText className="h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{attachment.file_name}</p>
                      <p className="text-[0.6875rem] text-muted">{formatFileSize(attachment.file_size)}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => downloadDocument(attachment)}
                      className="btn btn-ghost btn-icon"
                      aria-label={`Download ${attachment.file_name}`}
                    >
                      {downloadingId === attachment.id
                        ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                        : <Download className="h-4 w-4" aria-hidden />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    );
  }

  function taskRow(task: Task) {
    const checklist = checklistSummary(task.id);
    const documentCount = filesFor(task.id).length;
    const expanded = expandedTaskId === task.id;
    return (
      <div key={task.id} className={`card overflow-hidden p-0 ${task.status === "completed" ? "opacity-70" : ""}`}>
        <div className="flex flex-wrap items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => toggleStatus(task)} className="shrink-0" aria-label={task.status === "completed" ? `Reopen ${task.title}` : `Complete ${task.title}`}>
            {task.status === "completed"
              ? <CheckCircle2 className="h-5 w-5 text-success" aria-hidden />
              : <Circle className="h-5 w-5 text-muted" aria-hidden />}
          </button>
          <button type="button" onClick={() => setExpandedTaskId(expanded ? null : task.id)} className="min-w-[12rem] flex-1 text-left">
            <span className={`block text-sm font-medium ${task.status === "completed" ? "text-muted line-through" : ""}`}>{task.title}</span>
            {(checklist.items.length > 0 || documentCount > 0) && (
              <span className="mt-1 flex items-center gap-3 text-xs text-muted">
                {checklist.items.length > 0 && <span>{checklist.completed}/{checklist.items.length} mini-steps</span>}
                {documentCount > 0 && <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" aria-hidden />{documentCount}</span>}
              </span>
            )}
          </button>
          <span className={`badge shrink-0 capitalize ${priorityBadge(task.priority)}`}>{task.priority}</span>
          {task.deadline && (
            <span className={`flex shrink-0 items-center gap-1 text-xs ${isOverdue(task.deadline) && task.status !== "completed" ? "font-medium text-error" : "text-muted"}`}>
              <CalendarClock className="h-3.5 w-3.5" aria-hidden />
              {isOverdue(task.deadline) && task.status !== "completed" ? "Overdue · " : ""}{formatDeadline(task.deadline)}
            </span>
          )}
          <span className={`badge shrink-0 text-xs ${task.status === "completed" ? "badge-success" : task.status === "in_progress" ? "badge-medium" : "badge-low"}`}>
            {STATUS_LABELS[task.status]}
          </span>
          <button type="button" onClick={() => setExpandedTaskId(expanded ? null : task.id)} className="btn btn-ghost btn-icon" aria-expanded={expanded} aria-label={`${expanded ? "Hide" : "Show"} task details`}>
            {expanded ? <ChevronUp className="h-4 w-4" aria-hidden /> : <ChevronDown className="h-4 w-4" aria-hidden />}
          </button>
        </div>
        {expanded && taskDetails(task)}
      </div>
    );
  }

  if (loading) return <div className="p-6"><div className="skeleton mb-4 h-8 w-32" /><div className="space-y-3">{[1,2,3].map((item) => <div key={item} className="skeleton h-16" />)}</div></div>;

  return (
    <div className="mx-auto max-w-7xl p-4 animate-fade-in md:p-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tasks</h1>
          <p className="text-sm text-muted">{filtered.length} task{filtered.length !== 1 ? "s" : ""}</p>
        </div>
        <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden /> New Task
        </button>
      </div>

      {showForm && (
        <form className="card mb-6" onSubmit={createTask}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold">Create a task</h2>
              <p className="text-sm text-muted">Set the priority, exact deadline, mini-steps and supporting documents.</p>
            </div>
            <button type="button" onClick={cancelForm} className="btn btn-ghost btn-icon" aria-label="Cancel new task"><X className="h-4 w-4" /></button>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6">
            <div className="md:col-span-4">
              <label htmlFor="task-title" className="form-label">Task title</label>
              <input id="task-title" className="form-input" placeholder="e.g. Complete Year 11 moderation" value={newTitle} onChange={(event) => setNewTitle(event.target.value)} autoFocus required />
            </div>
            <div className="md:col-span-2">
              <label htmlFor="task-priority" className="form-label">Priority</label>
              <select id="task-priority" className="form-select" value={newPriority} onChange={(event) => setNewPriority(event.target.value as Priority)}>
                {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
              </select>
            </div>
            <div className="md:col-span-6">
              <label htmlFor="task-description" className="form-label">Description <span className="font-normal text-muted">(optional)</span></label>
              <textarea id="task-description" className="form-input min-h-20 resize-y" placeholder="Add context, expected outcome or notes…" value={newDescription} onChange={(event) => setNewDescription(event.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="task-deadline-date" className="form-label">Deadline date <span className="font-normal text-muted">(optional)</span></label>
              <input id="task-deadline-date" type="date" className="form-input" value={newDeadlineDate} onChange={(event) => setNewDeadlineDate(event.target.value)} />
            </div>
            <div className="md:col-span-3">
              <label htmlFor="task-deadline-time" className="form-label">Deadline time</label>
              <input id="task-deadline-time" type="time" className="form-input" value={newDeadlineTime} onChange={(event) => setNewDeadlineTime(event.target.value)} disabled={!newDeadlineDate} />
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            <section>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Mini-checklist</h3>
                  <p className="text-xs text-muted">Break the task into small, achievable steps.</p>
                </div>
                <button type="button" onClick={() => setNewChecklist((items) => [...items, ""])} className="btn btn-secondary btn-sm">
                  <Plus className="h-3.5 w-3.5" aria-hidden /> Add step
                </button>
              </div>
              <div className="space-y-2">
                {newChecklist.map((item, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-alt text-xs font-semibold text-muted">{index + 1}</span>
                    <input
                      className="form-input"
                      aria-label={`Mini-step ${index + 1}`}
                      placeholder={index === 0 ? "e.g. Gather teachers’ marked samples" : "Next mini-step…"}
                      value={item}
                      onChange={(event) => setNewChecklist((items) => items.map((value, itemIndex) => itemIndex === index ? event.target.value : value))}
                    />
                    {newChecklist.length > 1 && (
                      <button type="button" onClick={() => setNewChecklist((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="btn btn-ghost btn-icon" aria-label={`Remove mini-step ${index + 1}`}>
                        <Trash2 className="h-4 w-4 text-muted" aria-hidden />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-3">
                <h3 className="text-sm font-semibold">Documents</h3>
                <p className="text-xs text-muted">Attach up to {MAX_FILES} files, 10 MB each.</p>
              </div>
              <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-surface-alt/50 px-4 py-6 text-center transition-colors hover:border-primary-light hover:bg-info-bg/30">
                <Upload className="mb-2 h-6 w-6 text-primary" aria-hidden />
                <span className="text-sm font-medium">Choose documents</span>
                <span className="mt-1 text-xs text-muted">PDF, Office, text, CSV or images</span>
                <input type="file" multiple accept={FILE_ACCEPT} className="sr-only" onChange={(event) => { selectFiles(event.target.files); event.target.value = ""; }} />
              </label>
              {newFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {newFiles.map((file, index) => (
                    <div key={`${file.name}-${file.lastModified}`} className="flex items-center gap-2 rounded-md border border-border px-3 py-2">
                      <Paperclip className="h-4 w-4 shrink-0 text-muted" aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-xs">{file.name}</span>
                      <span className="text-[0.6875rem] text-muted">{formatFileSize(file.size)}</span>
                      <button type="button" onClick={() => setNewFiles((files) => files.filter((_, fileIndex) => fileIndex !== index))} className="btn btn-ghost btn-icon" aria-label={`Remove ${file.name}`}>
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancelForm} className="btn btn-secondary">Cancel</button>
            <button type="submit" disabled={creating || !newTitle.trim()} className="btn btn-primary">
              {creating ? <><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Creating task…</> : <><Plus className="h-4 w-4" aria-hidden /> Create task</>}
            </button>
          </div>
        </form>
      )}

      {error && <div className="mb-4 rounded-md border border-error/30 bg-error-bg px-4 py-3 text-sm text-error" role="alert">{error}</div>}

      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input className="form-input pl-9" placeholder="Search tasks…" value={filter.search} onChange={(event) => setFilter((current) => ({ ...current, search: event.target.value }))} />
        </div>
        <select className="form-select w-auto" value={filter.status} onChange={(event) => setFilter((current) => ({ ...current, status: event.target.value }))} aria-label="Filter by status">
          <option value="">All statuses</option>
          {STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
        </select>
        <select className="form-select w-auto capitalize" value={filter.priority} onChange={(event) => setFilter((current) => ({ ...current, priority: event.target.value }))} aria-label="Filter by priority">
          <option value="">All priorities</option>
          {PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
        </select>
        <div className="flex overflow-hidden rounded-md border border-border" aria-label="Task view">
          {(["list", "board", "grouped"] as const).map((viewOption) => (
            <button key={viewOption} type="button" onClick={() => setView(viewOption)} className={`btn btn-ghost btn-sm rounded-none ${view === viewOption ? "bg-surface-alt" : ""}`} aria-label={`${viewOption} view`} aria-pressed={view === viewOption}>
              {viewOption === "list" ? <LayoutList className="h-4 w-4" /> : viewOption === "board" ? <LayoutGrid className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="mb-2 text-muted">No tasks found</p>
          <button type="button" onClick={() => setShowForm(true)} className="btn btn-primary btn-sm"><Plus className="h-4 w-4" /> Create your first task</button>
        </div>
      ) : view === "list" ? (
        <div className="space-y-2">{filtered.map(taskRow)}</div>
      ) : view === "board" ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
          {STATUSES.map((status) => (
            <section key={status} className="space-y-2" aria-labelledby={`status-${status}`}>
              <h2 id={`status-${status}`} className="mb-2 text-sm font-semibold">{STATUS_LABELS[status]} ({filtered.filter((task) => task.status === status).length})</h2>
              {filtered.filter((task) => task.status === status).map((task) => {
                const checklist = checklistSummary(task.id);
                return (
                  <div key={task.id} className="card p-3 text-sm">
                    <div className="mb-2 flex items-start justify-between gap-2"><span className="font-medium">{task.title}</span><span className={`priority-dot priority-${task.priority} mt-1.5 shrink-0`} /></div>
                    {task.deadline && <p className={`flex items-center gap-1 text-xs ${isOverdue(task.deadline) && task.status !== "completed" ? "text-error" : "text-muted"}`}><Clock className="h-3 w-3" />{formatDeadline(task.deadline)}</p>}
                    {checklist.items.length > 0 && <p className="mt-2 text-xs text-muted">{checklist.completed}/{checklist.items.length} mini-steps</p>}
                    {filesFor(task.id).length > 0 && <p className="mt-1 flex items-center gap-1 text-xs text-muted"><Paperclip className="h-3 w-3" />{filesFor(task.id).length} document{filesFor(task.id).length === 1 ? "" : "s"}</p>}
                  </div>
                );
              })}
            </section>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.filter((group) => group.tasks.length > 0).map((group) => (
            <section key={group.key}>
              <h2 className="mb-3 text-sm font-semibold">{STATUS_LABELS[group.key]}</h2>
              <div className="space-y-2">{group.tasks.map(taskRow)}</div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
