import { useEffect, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso talleres — CitaMotor" },
      { name: "description", content: "Accede al panel de tu taller en CitaMotor." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Acceso talleres — CitaMotor" },
      { property: "og:description", content: "Menos llamadas. Menos citas perdidas. Más control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const signUpSchema = z.object({
  workshopName: z.string().trim().min(2, "Escribe el nombre del taller").max(120),
  email: z.string().trim().email("Email no válido").max(255),
  password: z.string().min(8, "Mínimo 8 caracteres").max(72),
});
const signInSchema = signUpSchema.pick({ email: true, password: true });

const inputCls =
  "h-12 w-full rounded-[10px] border border-border bg-background px-3 text-base text-foreground outline-none focus:border-foreground";

function AuthPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState<string | null>(null);
  const [form, setForm] = useState({ workshopName: "", email: "", password: "" });
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setEmail(s?.user.email ?? null));
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = (mode === "signup" ? signUpSchema : signInSchema).safeParse(form);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Revisa los datos");
    setBusy(true);
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email: form.email.trim(),
        password: form.password,
        options: { emailRedirectTo: `${window.location.origin}/panel`, data: { workshop_name: form.workshopName.trim() } },
      });
      setBusy(false);
      if (error) return setError(error.message.includes("registered") ? "Ese email ya tiene cuenta." : "No se pudo crear la cuenta. Inténtalo de nuevo.");
      if (data.session) return navigate({ to: "/panel" });
      setInfo("Te hemos enviado un email. Confirma tu cuenta para entrar.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
      setBusy(false);
      if (error) return setError("Email o contraseña incorrectos.");
      navigate({ to: "/panel" });
    }
  }

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app max-w-md py-12">
        <h1 className="text-3xl font-bold">Menos llamadas. Más control.</h1>
        {email ? (
          <div className="mt-6 space-y-3">
            <p className="text-body">Has iniciado sesión como <strong className="text-foreground">{email}</strong>.</p>
            <Button asChild size="xl" className="w-full"><Link to="/panel">Ir al panel</Link></Button>
            <Button variant="outline" size="xl" className="w-full" onClick={signOut}>Cerrar sesión</Button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-3" noValidate>
            {mode === "signup" && (
              <label className="block text-sm font-medium text-body">Nombre del taller
                <input className={`${inputCls} mt-1`} value={form.workshopName} onChange={(e) => setForm({ ...form, workshopName: e.target.value })} autoComplete="organization" />
              </label>
            )}
            <label className="block text-sm font-medium text-body">Email
              <input type="email" className={`${inputCls} mt-1`} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} autoComplete="email" />
            </label>
            <label className="block text-sm font-medium text-body">Contraseña
              <input type="password" className={`${inputCls} mt-1`} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </label>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
            {info && <p role="status" className="text-sm text-success">{info}</p>}
            <Button type="submit" size="xl" className="w-full" disabled={busy}>
              {mode === "signup" ? "Crear cuenta de taller" : "Iniciar sesión"}
            </Button>
            <button type="button" className="min-h-12 w-full text-sm font-medium text-body hover:text-foreground"
              onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); setInfo(null); }}>
              {mode === "signin" ? "¿Taller nuevo? Crear cuenta" : "¿Ya tienes cuenta? Iniciar sesión"}
            </button>
          </form>
        )}
      </main>
    </div>
  );
}
