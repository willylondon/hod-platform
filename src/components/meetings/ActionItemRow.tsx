"use client";

import { ArrowRightCircle, CheckCircle2, Circle, User } from "lucide-react";
import type { MeetingAction } from "@/lib/types";
import { cn, formatDate } from "@/lib/utils";

interface ActionItemRowProps {
  action: MeetingAction;
  assigneeName?: string | null;
  converting?: boolean;
  onToggle: (action: MeetingAction) => void;
  onConvert: (action: MeetingAction) => void;
}

export default function ActionItemRow({
  action,
  assigneeName,
  converting,
  onToggle,
  onConvert,
}: ActionItemRowProps) {
  const converted = Boolean(action.converted_to_task_id);

  return (
    <li className="flex items-start gap-3 rounded-md px-2 py-2 hover:bg-surface-alt">
      <button
        type="button"
        onClick={() => onToggle(action)}
        className="mt-0.5 shrink-0"
        aria-label={action.completed ? "Mark as not completed" : "Mark as completed"}
      >
        {action.completed ? (
          <CheckCircle2 className="h-5 w-5 text-success" />
        ) : (
          <Circle className="h-5 w-5 text-text-muted" />
        )}
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-medium",
            action.completed && "text-muted line-through"
          )}
        >
          {action.title}
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
          {assigneeName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {assigneeName}
            </span>
          )}
          {action.deadline && <span>Due {formatDate(action.deadline)}</span>}
        </div>
      </div>

      {converted ? (
        <span className="badge badge-success shrink-0">Task created</span>
      ) : (
        <button
          type="button"
          className="btn btn-secondary btn-sm shrink-0"
          disabled={converting}
          onClick={() => onConvert(action)}
          title="Create a task from this action item"
        >
          <ArrowRightCircle className="h-3.5 w-3.5" />
          {converting ? "Converting…" : "Convert to Task"}
        </button>
      )}
    </li>
  );
}
