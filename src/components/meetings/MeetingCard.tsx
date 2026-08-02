"use client";

import Link from "next/link";
import { Calendar, ChevronRight, Clock, ListChecks, MapPin, Users } from "lucide-react";
import type { Meeting, MeetingType } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

export type MeetingWithCounts = Meeting & {
  attendee_count?: number;
  action_count?: number;
  open_action_count?: number;
};

export const MEETING_TYPE_META: Record<
  MeetingType,
  { label: string; badgeClass: string }
> = {
  department: { label: "Department", badgeClass: "bg-info-bg text-info" },
  parent: { label: "Parent", badgeClass: "bg-warning-bg text-warning" },
  coaching: { label: "Coaching", badgeClass: "bg-accent-light/40 text-text" },
  one_to_one: { label: "1:1", badgeClass: "bg-success-bg text-success" },
  standardization: { label: "Standardization", badgeClass: "bg-info-bg text-info" },
  professional_development: { label: "Prof. Development", badgeClass: "bg-success-bg text-success" },
  senior_leadership: { label: "Senior Leadership", badgeClass: "bg-error-bg text-error" },
  other: { label: "Other", badgeClass: "bg-surface-alt text-text-muted" },
};

export function MeetingTypeBadge({ type }: { type: MeetingType }) {
  const meta = MEETING_TYPE_META[type] ?? MEETING_TYPE_META.other;
  return <span className={cn("badge", meta.badgeClass)}>{meta.label}</span>;
}

interface MeetingCardProps {
  meeting: MeetingWithCounts;
}

export default function MeetingCard({ meeting }: MeetingCardProps) {
  return (
    <Link
      href={`/meetings/${meeting.id}`}
      className="card card-hover block animate-fade-in transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate font-semibold text-text">{meeting.title}</p>
            <MeetingTypeBadge type={meeting.meeting_type} />
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              {formatDate(meeting.date)}
            </span>
            <span className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              {meeting.start_time?.slice(0, 5)}
              {meeting.end_time ? `–${meeting.end_time.slice(0, 5)}` : ""}
            </span>
            {meeting.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {meeting.location}
              </span>
            )}
            {meeting.attendee_count != null && (
              <span className="flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />
                {meeting.attendee_count}{" "}
                {meeting.attendee_count === 1 ? "attendee" : "attendees"}
              </span>
            )}
            {meeting.action_count != null && meeting.action_count > 0 && (
              <span className="flex items-center gap-1.5">
                <ListChecks className="h-3.5 w-3.5" />
                {meeting.open_action_count ?? 0}/{meeting.action_count} actions open
              </span>
            )}
          </div>
        </div>

        <ChevronRight className="h-4 w-4 shrink-0 text-text-muted" />
      </div>
    </Link>
  );
}
