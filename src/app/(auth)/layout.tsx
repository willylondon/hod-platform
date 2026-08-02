import { GraduationCap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10 relative overflow-hidden">
      {/* Decorative background accents */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 h-96 w-96 rounded-full opacity-[0.06]"
        style={{ background: "var(--color-primary)" }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-32 h-[28rem] w-[28rem] rounded-full opacity-[0.05]"
        style={{ background: "var(--color-accent)" }}
      />

      {/* Brand mark */}
      <div className="flex items-center gap-3 mb-8 animate-fade-in">
        <div
          className="flex items-center justify-center h-11 w-11 rounded-xl shadow-sm"
          style={{ background: "var(--color-primary)" }}
        >
          <GraduationCap className="h-6 w-6" style={{ color: "var(--color-text-inverse)" }} />
        </div>
        <div>
          <p className="font-semibold leading-tight" style={{ color: "var(--color-primary)" }}>
            HoD Productivity Platform
          </p>
          <p className="text-xs text-muted">Leadership, organised.</p>
        </div>
      </div>

      {/* Centered auth card */}
      <main
        id="main-content"
        className="w-full max-w-md card shadow-md animate-fade-in"
        style={{ padding: "2rem" }}
      >
        {children}
      </main>

      <p className="mt-8 text-xs text-muted text-center max-w-sm">
        Built for Heads of Department — plan observations, meetings, tasks and goals in one calm
        place.
      </p>
    </div>
  );
}
