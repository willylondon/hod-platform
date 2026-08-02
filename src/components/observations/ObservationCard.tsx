"use client";

import Link from "next/link";
import { BookOpen, Calendar, ChevronRight, Clock, User } from "lucide-react";
import type { Observation, ObservationStatus, StaffMember } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export type ObservationWithTeacher = Observation & {
  teacher?: StaffMember | null;
};

export const OBSERVATION_STATUS_META: Record<
  ObservationStatus,
  { label: string; badgeClass: string; dotClass: string }
> = {
  planned: {
    label: "Planned",
    badgeClass: "bg-surface-alt text-text-muted",
    dotClass: "bg-text-muted",
  },
  scheduled: {
    label: "Scheduled",
    badgeClass: "bg-info-bg text-info",
    dotClass: "bg-info",
  },
  completed: {
    label: "Completed",
    badgeClass: "bg-success-bg text-success",
    dotClass: "bg-success",
  },
  feedback_pending: {
    label: "Feedback Pending",
    badgeClass: "bg-warning-bg text-warning",
    dotClass: "bg-warning",
  },
  coaching_pending: {
    label: "Coaching Pending",
    badgeClass: "bg-accent-light/40 text-text",
    dotClass: "bg-accent",
  },
  follow_up_pending: {
    label: "Follow-up Pending",
    badgeClass: "bg-error-bg text-error",
    dotClass: "bg-error",
  },
  closed: {
    label: "Closed",
    badgeClass: "bg-surface-alt text-text-muted",
    dotClass: "bg-text-muted",
  },
};

export function ObservationStatusBadge({ status }: { status: ObservationStatus }) {
  const meta = OBSERVATION_STATUS_META[status] ?? OBSERVATION_STATUS_META.planned;
  return (
    <span className={cn("badge", meta.badgeClass)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", meta.dotClass)} />
      {meta.label}
    </span>
  );
}

interface ObservationCardProps {
  observation: ObservationWithTeacher;
}

export default function ObservationCard({ observation }: ObservationCardProps) {
  const teacherName = observation.teacher?.full_name ?? "Unknown teacher";
  const subject = observation.subject ?? observation.teacher?.subject;

  return (
    <Link
      href={`/observations/${observation.id}`}
      className="card card-hover block animate-fade-in transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <User className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate font-semibold text-text">{teacherName}</p>
              <p className="text-xs text-muted">{observation.observation_type}</p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            {subject && (
              <span className="flex items-center gap-1.5">
                <BookOpen className="h-3.5 w-3.5" />
                {subject}
                {observation.year_group ? ` · ${observation.year_group}` : ""}
              </span>
            )}
            {observation.scheduled_date && (
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {formatDate(observation.scheduled_date)}
              </span>
            )}
            {observation.duration_minutes != null && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {observation.duration_minutes} min
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <ObservationStatusBadge status={observation.status} />
          <ChevronRight className="h-4 w-4 text-text-muted" />
        </div>
      </div>
    </Link>
  );
}
