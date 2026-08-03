"use client";
export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Observation, ObservationStatus, StaffMember } from "@/lib/types";
import { cn } from "@/lib/utils";
import ObservationCard, {
  OBSERVATION_STATUS_META,
  type ObservationWithTeacher,
} from "@/components/observations/ObservationCard";

type StatusFilter = ObservationStatus | "all";

export default function ObservationsPage() {
  const [observations, setObservations] = useState<ObservationWithTeacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [obsRes, staffRes] = await Promise.all([
        supabase
          .from("observations")
          .select("*")
          .order("scheduled_date", { ascending: false, nullsFirst: false }),
        supabase.from("staff").select("*"),
      ]);

      if (obsRes.error) {
        setError(obsRes.error.message);
        setLoading(false);
        return;
      }

      const staffById = new Map<string, StaffMember>(
        ((staffRes.data ?? []) as StaffMember[]).map((s) => [s.id, s])
      );

      const rows = ((obsRes.data ?? []) as Observation[]).map((o) => ({
        ...o,
        teacher: staffById.get(o.teacher_id) ?? null,
      }));

      setObservations(rows);
      setLoading(false);
    }
    load();
  }, []);

  const stats = useMemo(() => {
    const count = (s: ObservationStatus) =>
      observations.filter((o) => o.status === s).length;
    return [
      { label: "Total", value: observations.length, className: "bg-surface-alt text-text" },
      { label: "Planned", value: count("planned"), className: "bg-info-bg text-info" },
      { label: "Completed", value: count("completed"), className: "bg-success-bg text-success" },
      {
        label: "Feedback Pending",
        value: count("feedback_pending"),
        className: "bg-warning-bg text-warning",
      },
      {
        label: "Coaching Pending",
        value: count("coaching_pending"),
        className: "bg-accent-light/40 text-text",
      },
    ];
  }, [observations]);

  const filtered = useMemo(
    () =>
      statusFilter === "all"
        ? observations
        : observations.filter((o) => o.status === statusFilter),
    [observations, statusFilter]
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex-between flex-wrap gap-4">
        <div>
          <h1>Teacher Observations</h1>
          <p className="text-sm text-muted mt-1">
            Plan, record and follow up on classroom observations across your department.
          </p>
        </div>
        <Link href="/observations/new" className="btn btn-primary">
          <Plus className="h-4 w-4" />
          New Observation
        </Link>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.label} className="card flex items-center gap-3 !p-4">
            <span
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full text-base font-bold",
                s.className
              )}
            >
              {s.value}
            </span>
            <span className="text-sm font-medium text-muted">{s.label}</span>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3">
        <label htmlFor="status-filter" className="text-sm font-medium text-muted">
          Status
        </label>
        <select
          id="status-filter"
          className="form-select w-auto"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          {(Object.keys(OBSERVATION_STATUS_META) as ObservationStatus[]).map((s) => (
            <option key={s} value={s}>
              {OBSERVATION_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
      ) : error ? (
        <div className="card text-center text-error">
          Failed to load observations: {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-surface-alt text-text-muted">
            <ClipboardCheck className="h-7 w-7" />
          </div>
          <div>
            <p className="font-semibold text-text">No observations yet</p>
            <p className="text-sm text-muted mt-1">
              {statusFilter === "all"
                ? "Schedule your first classroom observation to get started."
                : "No observations match this status filter."}
            </p>
          </div>
          <Link href="/observations/new" className="btn btn-primary btn-sm mt-2">
            <Plus className="h-4 w-4" />
            New Observation
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => (
            <ObservationCard key={o.id} observation={o} />
          ))}
        </div>
      )}
    </div>
  );
}
