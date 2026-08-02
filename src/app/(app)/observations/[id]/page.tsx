"use client";
export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  ListChecks,
  Plus,
  Sparkles,
  User,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type {
  ChecklistItem,
  Observation,
  ObservationStatus,
  StaffMember,
} from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";
import { ObservationStatusBadge } from "@/components/observations/ObservationCard";

const TIMELINE: { status: ObservationStatus; label: string }[] = [
  { status: "planned", label: "Planned" },
  { status: "scheduled", label: "Scheduled" },
  { status: "completed", label: "Completed" },
  { status: "feedback_pending", label: "Feedback" },
  { status: "coaching_pending", label: "Coaching" },
  { status: "follow_up_pending", label: "Follow-up" },
  { status: "closed", label: "Closed" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

export default function ObservationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const isNew = id === "new";

  const [observation, setObservation] = useState<Observation | null>(null);
  const [teacher, setTeacher] = useState<StaffMember | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newItemTitle, setNewItemTitle] = useState("");
  const [loading, setLoading] = useState(!isNew);
  const [error, setError] = useState<string | null>(null);
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});

  const load = useCallback(async () => {
    if (isNew) { setLoading(false); return; }
    const supabase = createClient();
    const { data, error: obsError } = await supabase
      .from("observations")
      .select("*")
      .eq("id", id)
      .single();

    if (obsError || !data) {
      setError(obsError?.message ?? "Observation not found");
      setLoading(false);
      return;
    }

    const obs = data as Observation;
    setObservation(obs);

    const [teacherRes, checklistRes] = await Promise.all([
      supabase.from("staff_members").select("*").eq("id", obs.teacher_id).single(),
      supabase
        .from("checklist_items")
        .select("*")
        .eq("parent_type", "observation")
        .eq("parent_id", obs.id)
        .order("sort_order"),
    ]);

    setTeacher((teacherRes.data as StaffMember) ?? null);
    setChecklist((checklistRes.data as ChecklistItem[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveField(field: keyof Observation, value: string | boolean | null) {
    if (!observation) return;
    setSaveStates((s) => ({ ...s, [field]: "saving" }));
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("observations")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", observation.id);

    if (updateError) {
      setSaveStates((s) => ({ ...s, [field]: "error" }));
      return;
    }
    setObservation({ ...observation, [field]: value });
    setSaveStates((s) => ({ ...s, [field]: "saved" }));
    setTimeout(
      () => setSaveStates((s) => ({ ...s, [field]: "idle" })),
      2000
    );
  }

  async function toggleChecklistItem(item: ChecklistItem) {
    const supabase = createClient();
    setChecklist((items) =>
      items.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i))
    );
    await supabase
      .from("checklist_items")
      .update({ completed: !item.completed })
      .eq("id", item.id);
  }

  async function addChecklistItem() {
    const title = newItemTitle.trim();
    if (!title || !observation) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("checklist_items")
      .insert({
        parent_type: "observation",
        parent_id: observation.id,
        title,
        completed: false,
        sort_order: checklist.length,
      })
      .select()
      .single();
    if (data) setChecklist((items) => [...items, data as ChecklistItem]);
    setNewItemTitle("");
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="skeleton h-8 w-64" />
        <div className="skeleton h-24 w-full" />
        <div className="skeleton h-64 w-full" />
      </div>
    );
  }

  if (error || (!isNew && !observation)) {
    return (
      <div className="space-y-4">
        <Link href="/observations" className="btn btn-ghost btn-sm">
          <ArrowLeft className="h-4 w-4" /> Back to observations
        </Link>
        <div className="card text-center text-error">
          {error ?? "Observation not found"}
        </div>
      </div>
    );
  }

  // New observation form
  if (isNew) {
    return (
      <div className="space-y-6">
        <Link href="/observations" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text">
          <ArrowLeft className="h-4 w-4" /> Back to observations
        </Link>
        <h1>New Observation</h1>
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><label className="form-label">Teacher</label><select className="form-select"><option>Select a teacher</option><option>Dr. Andrea Williams</option><option>Mr. David Chen</option><option>Ms. Sarah Thompson</option><option>Mr. James McDonald</option><option>Mrs. Patricia James</option><option>Ms. Rachel Foster</option></select></div>
            <div><label className="form-label">Observation Type</label><select className="form-select"><option>Formal</option><option>Informal</option><option>Drop-in</option><option>Peer</option></select></div>
            <div><label className="form-label">Subject</label><input className="form-input" placeholder="e.g. English Literature" /></div>
            <div><label className="form-label">Year Group / Grade</label><input className="form-input" placeholder="e.g. Year 10" /></div>
            <div><label className="form-label">Date</label><input type="date" className="form-input" /></div>
            <div><label className="form-label">Time</label><input type="time" className="form-input" /></div>
            <div><label className="form-label">Duration (minutes)</label><input type="number" className="form-input" placeholder="60" /></div>
            <div><label className="form-label">Focus</label><input className="form-input" placeholder="e.g. Classroom management" /></div>
          </div>
          <div className="mt-4 flex gap-3">
            <button className="btn btn-primary">Save Observation</button>
            <Link href="/observations" className="btn btn-secondary">Cancel</Link>
          </div>
          <p className="text-xs text-muted mt-3">New observations are saved in Planned status.</p>
        </div>
      </div>
    );
  }

  if (!observation) return null;

  const currentStep = TIMELINE.findIndex((t) => t.status === observation.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/observations"
          className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" /> Back to observations
        </Link>
        <div className="flex-between flex-wrap gap-4">
          <div>
            <h1>{teacher?.full_name ?? "Observation"}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
              {observation.subject && (
                <span className="flex items-center gap-1.5">
                  <BookOpen className="h-4 w-4" />
                  {observation.subject}
                  {observation.year_group ? ` · ${observation.year_group}` : ""}
                </span>
              )}
              {observation.scheduled_date && (
                <span className="flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(observation.scheduled_date)}
                  {observation.scheduled_time ? ` at ${observation.scheduled_time}` : ""}
                </span>
              )}
              {observation.duration_minutes != null && (
                <span className="flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {observation.duration_minutes} minutes
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {observation.observation_type}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ObservationStatusBadge status={observation.status} />
            <Link
              href={`/assistant?context=observation&id=${observation.id}&action=feedback`}
              className="btn btn-accent"
            >
              <Sparkles className="h-4 w-4" />
              Generate Feedback with AI
            </Link>
          </div>
        </div>
      </div>

      {/* Status timeline */}
      <div className="card overflow-x-auto">
        <ol className="flex min-w-[640px] items-center">
          {TIMELINE.map((step, idx) => {
            const done = idx < currentStep;
            const current = idx === currentStep;
            return (
              <li key={step.status} className="flex flex-1 items-center last:flex-none">
                <div className="flex flex-col items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full border-2",
                      done && "border-primary bg-primary text-text-inverse",
                      current && "border-accent bg-accent/15 text-accent",
                      !done && !current && "border-border bg-surface-alt text-text-muted"
                    )}
                  >
                    {done ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-semibold">{idx + 1}</span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "whitespace-nowrap text-xs",
                      current ? "font-semibold text-text" : "text-muted"
                    )}
                  >
                    {step.label}
                  </span>
                </div>
                {idx < TIMELINE.length - 1 && (
                  <div
                    className={cn(
                      "mx-2 mb-5 h-0.5 flex-1",
                      idx < currentStep ? "bg-primary" : "bg-border"
                    )}
                  />
                )}
              </li>
            );
          })}
        </ol>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          {/* Pre-observation checklist */}
          <section className="card">
            <h3 className="mb-4 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-primary" />
              Pre-observation checklist
            </h3>
            {checklist.length === 0 ? (
              <p className="text-sm text-muted">No checklist items yet.</p>
            ) : (
              <ul className="space-y-2">
                {checklist.map((item) => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggleChecklistItem(item)}
                      className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-alt"
                    >
                      {item.completed ? (
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-success" />
                      ) : (
                        <Circle className="h-4.5 w-4.5 shrink-0 text-text-muted" />
                      )}
                      <span
                        className={cn(
                          item.completed && "text-muted line-through"
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex gap-2">
              <input
                className="form-input"
                placeholder="Add a checklist item…"
                value={newItemTitle}
                onChange={(e) => setNewItemTitle(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
              />
              <button
                type="button"
                className="btn btn-secondary btn-icon shrink-0"
                onClick={addChecklistItem}
                aria-label="Add checklist item"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </section>

          <EditableSection
            title="Raw notes"
            value={observation.raw_notes ?? ""}
            placeholder="Notes captured during the lesson…"
            state={saveStates.raw_notes ?? "idle"}
            onSave={(v) => saveField("raw_notes", v)}
          />
          <EditableSection
            title="Strengths"
            value={observation.strengths ?? ""}
            placeholder="What went well in this lesson…"
            state={saveStates.strengths ?? "idle"}
            onSave={(v) => saveField("strengths", v)}
          />
          <EditableSection
            title="Areas for development"
            value={observation.areas_for_development ?? ""}
            placeholder="Growth points to discuss with the teacher…"
            state={saveStates.areas_for_development ?? "idle"}
            onSave={(v) => saveField("areas_for_development", v)}
          />
          <EditableSection
            title="Agreed actions"
            value={observation.agreed_actions ?? ""}
            placeholder="Actions agreed with the teacher after feedback…"
            state={saveStates.agreed_actions ?? "idle"}
            onSave={(v) => saveField("agreed_actions", v)}
          />
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {/* Feedback draft */}
          <section className="card">
            <div className="mb-3 flex items-center justify-between">
              <h3>Feedback draft</h3>
              {observation.feedback_approved && (
                <span className="badge badge-success">
                  <Check className="h-3 w-3" /> Approved
                </span>
              )}
            </div>
            {observation.feedback_draft ? (
              <p className="whitespace-pre-wrap rounded-md bg-surface-alt p-3 text-sm">
                {observation.feedback_draft}
              </p>
            ) : (
              <p className="text-sm text-muted">
                No feedback drafted yet. Use the AI assistant to generate a draft from
                your notes.
              </p>
            )}
            {!observation.feedback_approved && observation.feedback_draft && (
              <button
                type="button"
                className="btn btn-primary btn-sm mt-3 w-full"
                disabled={saveStates.feedback_approved === "saving"}
                onClick={() => saveField("feedback_approved", true)}
              >
                <Check className="h-4 w-4" />
                {saveStates.feedback_approved === "saving"
                  ? "Approving…"
                  : "Approve feedback"}
              </button>
            )}
          </section>

          {/* Follow-up dates */}
          <section className="card space-y-4">
            <h3>Follow-up</h3>
            <DateField
              label="Coaching meeting date"
              value={observation.coaching_meeting_date ?? ""}
              onSave={(v) => saveField("coaching_meeting_date", v || null)}
            />
            <DateField
              label="Follow-up date"
              value={observation.follow_up_date ?? ""}
              onSave={(v) => saveField("follow_up_date", v || null)}
            />
          </section>

          {/* Meta */}
          <section className="card space-y-2 text-sm">
            <h3 className="mb-1">Details</h3>
            {observation.observation_focus && (
              <p>
                <span className="text-muted">Focus: </span>
                {observation.observation_focus}
              </p>
            )}
            {teacher?.job_title && (
              <p>
                <span className="text-muted">Teacher role: </span>
                {teacher.job_title}
              </p>
            )}
            <p>
              <span className="text-muted">Created: </span>
              {formatDate(observation.created_at)}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}

function EditableSection({
  title,
  value,
  placeholder,
  state,
  onSave,
}: {
  title: string;
  value: string;
  placeholder: string;
  state: SaveState;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const dirty = draft !== value;

  return (
    <section className="card">
      <div className="mb-3 flex items-center justify-between">
        <h3>{title}</h3>
        {state === "saved" && (
          <span className="text-xs font-medium text-success">Saved</span>
        )}
        {state === "error" && (
          <span className="text-xs font-medium text-error">Save failed</span>
        )}
      </div>
      <textarea
        className="form-input min-h-28 resize-y"
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
      />
      {dirty && (
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setDraft(value)}
          >
            Discard
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={state === "saving"}
            onClick={() => onSave(draft)}
          >
            {state === "saving" ? "Saving…" : "Save"}
          </button>
        </div>
      )}
    </section>
  );
}

function DateField({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const dateValue = value ? value.slice(0, 10) : "";
  return (
    <div>
      <label className="form-label">{label}</label>
      <input
        type="date"
        className="form-input"
        value={dateValue}
        onChange={(e) => onSave(e.target.value)}
      />
      {dateValue && (
        <p className="mt-1 text-xs text-muted">{formatDate(dateValue)}</p>
      )}
    </div>
  );
}
