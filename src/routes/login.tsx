import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useEffect } from "react";
import { Film } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({ component: LoginPage });

function LoginPage() {
  const nav = useNavigate();
  const { session, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session) nav({ to: "/admin" });
  }, [loading, session, nav]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        toast.success("Akkaunt yaratildi. Endi tizimga kiring.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav({ to: "/admin" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Xatolik");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center px-4">
      <div className="glass-card w-full max-w-md rounded-2xl p-8">
        <Link to="/" className="flex items-center gap-2 text-lg font-bold mb-6">
          <Film className="h-6 w-6 text-primary" /> CineBot Admin
        </Link>
        <h1 className="text-2xl font-bold">{mode === "signin" ? "Kirish" : "Ro'yxatdan o'tish"}</h1>
        <p className="text-sm text-muted-foreground mt-1">Birinchi yaratilgan akkaunt super-admin bo'ladi.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label className="text-sm">Email</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="text-sm">Parol</label>
            <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          </div>
          <button disabled={busy} className="w-full rounded-md bg-primary py-2.5 font-medium text-primary-foreground disabled:opacity-60">
            {busy ? "..." : mode === "signin" ? "Kirish" : "Ro'yxatdan o'tish"}
          </button>
        </form>
        <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="mt-4 w-full text-sm text-muted-foreground hover:text-foreground">
          {mode === "signin" ? "Akkaunt yo'qmi? Ro'yxatdan o'ting" : "Akkauntingiz bormi? Kiring"}
        </button>
      </div>
    </div>
  );
}
