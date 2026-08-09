"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  ListChecks,
  Workflow,
  ClipboardCheck,
  Users,
  Calendar,
  Sparkles,
  Target,
  GraduationCap,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import NotificationCenter from "@/components/layout/NotificationCenter";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/workflows", label: "Workflows", icon: Workflow },
  { href: "/observations", label: "Observations", icon: ClipboardCheck },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/assistant", label: "AI Assistant", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/staff", label: "Staff", icon: GraduationCap },
  { href: "/settings", label: "Settings", icon: Settings },
];

const MOBILE_NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/observations", label: "Observe", icon: ClipboardCheck },
  { href: "/meetings", label: "Meetings", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
];

function initialsFor(name: string | null): string {
  if (!name) return "H";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user || cancelled) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, avatar_url, role")
          .eq("id", user.id)
          .maybeSingle();
        if (cancelled) return;
        setDisplayName(
          profile?.full_name ?? user.user_metadata?.full_name ?? user.email ?? null
        );
        setAvatarUrl(profile?.avatar_url ?? null);
        setRole(profile?.role ? profile.role.replace(/_/g, " ") : null);
      } catch {
        // Supabase not configured or offline — shell still renders.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <div className="min-h-screen bg-background">
      {/* ===== Desktop sidebar ===== */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-primary text-text-inverse md:flex">
        {/* Logo */}
        <Link
          href="/dashboard"
          className="flex items-center gap-3 border-b border-white/10 px-5 py-5"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-primary">
            <GraduationCap className="h-5 w-5" aria-hidden />
          </span>
          <span className="leading-tight">
            <span className="block text-sm font-bold tracking-tight">
              HoD Platform
            </span>
            <span className="block text-xs text-white/60">
              Leadership Assistant
            </span>
          </span>
        </Link>

        {/* Nav */}
        <nav
          aria-label="Primary"
          className="flex-1 space-y-1 overflow-y-auto px-3 py-4"
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-accent bg-white/10 text-white"
                    : "border-transparent text-white/70 hover:bg-white/5 hover:text-white"
                )}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User */}
        <div className="border-t border-white/10 p-4">
          <Link
            href="/settings"
            className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-white/5"
          >
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarUrl}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
            ) : (
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">
                {initialsFor(displayName)}
              </span>
            )}
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-white">
                {displayName ?? "Head of Department"}
              </span>
              <span className="block truncate text-xs capitalize text-white/60">
                {role ?? "head of department"}
              </span>
            </span>
          </Link>
        </div>
      </aside>

      {/* ===== Main content ===== */}
      <div className="md:pl-60">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-surface/95 px-4 backdrop-blur md:justify-end md:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold text-primary md:hidden">
            <GraduationCap className="h-5 w-5" aria-hidden />
            HoD Platform
          </Link>
          <NotificationCenter />
        </header>
        <main
          id="main-content"
          className="min-h-[calc(100vh-3.5rem)] p-4 pb-24 md:p-8 md:pb-8"
        >
          {children}
        </main>
      </div>

      {/* ===== Mobile bottom nav ===== */}
      <nav
        aria-label="Mobile"
        className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-surface md:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {MOBILE_NAV_ITEMS.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[0.6875rem] font-medium",
                active ? "text-primary" : "text-text-muted hover:text-text"
              )}
            >
              <Icon
                className={cn("h-5 w-5", active && "text-primary")}
                aria-hidden
              />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
