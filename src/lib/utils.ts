import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function timeAgo(date: string | Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export function isOverdue(deadline: string | Date): boolean {
  return new Date(deadline) < new Date();
}

export function daysUntil(date: string | Date): number {
  return Math.ceil((new Date(date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function countdownUrgency(days: number): string {
  if (days < 0) return "critical";
  if (days < 3) return "urgent";
  if (days < 7) return "important";
  if (days < 14) return "approaching";
  return "normal";
}

export function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function getPriorityColor(priority: string): string {
  const map: Record<string, string> = {
    urgent: "var(--color-error)",
    high: "var(--color-warning)",
    medium: "var(--color-info)",
    low: "var(--color-text-muted)",
  };
  return map[priority] || "var(--color-text-muted)";
}

export function getStatusColor(status: string): string {
  if (status === "completed" || status === "closed" || status === "achieved") return "var(--color-success)";
  if (status === "cancelled") return "var(--color-text-muted)";
  if (status === "at_risk" || status === "overdue") return "var(--color-error)";
  if (status === "in_progress" || status === "active") return "var(--color-info)";
  return "var(--color-text-muted)";
}
