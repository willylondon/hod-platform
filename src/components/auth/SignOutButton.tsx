"use client";

import { useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton({ className = "btn btn-secondary" }: { className?: string }) {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setSigningOut(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (signOutError) throw signOutError;

      router.replace("/sign-in");
      router.refresh();
    } catch {
      setError("Could not log out. Please try again.");
      setSigningOut(false);
    }
  }

  return (
    <div>
      <button type="button" className={className} onClick={signOut} disabled={signingOut}>
        {signingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <LogOut className="h-4 w-4" aria-hidden />}
        {signingOut ? "Logging out…" : "Log out"}
      </button>
      {error && <p className="mt-2 text-xs text-error" role="alert">{error}</p>}
    </div>
  );
}
