import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/panel")({
  head: () => ({
    meta: [
      { title: "Panel del taller — CitaMotor" },
      { name: "description", content: "Gestiona tu taller en CitaMotor." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Panel del taller — CitaMotor" },
      { property: "og:description", content: "Gestiona tu taller en CitaMotor." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Panel,
});

function Panel() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["my-account"],
    queryFn: async () => {
      const { error: bErr } = await supabase.rpc("bootstrap_workshop_account");
      if (bErr) throw bErr;
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user!.id;
      const [{ data: roles }, { data: workshops }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid),
        supabase.from("workshops").select("id,name,slug,active,is_demo,onboarding_step").eq("owner_id", uid),
      ]);
      return { roles: (roles ?? []).map((r) => r.role), workshops: workshops ?? [] };
    },
  });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app max-w-xl py-10">
        <h1 className="text-3xl font-bold">Panel</h1>
        {isLoading && <p className="mt-4 text-body">Cargando…</p>}
        {error && <p role="alert" className="mt-4 text-destructive">No se pudo cargar tu cuenta. Recarga la página.</p>}
        {data && (
          <div className="mt-6 space-y-4">
            {data.roles.includes("admin") && <p className="tile p-4 font-medium">Cuenta de administrador.</p>}
            {data.workshops.map((w) => (
              <div key={w.id} className="tile p-4">
                <p className="text-lg font-semibold">{w.name}</p>
                <p className="text-sm text-body">/{w.slug} · {w.active ? "Visible" : "Pendiente de configurar"} · Paso {w.onboarding_step} de 5</p>
              </div>
            ))}
            <p className="text-sm text-body">La configuración del taller llega en la siguiente fase.</p>
          </div>
        )}
        <div className="mt-8 flex gap-3">
          <Button variant="outline" size="xl" onClick={signOut}>Cerrar sesión</Button>
          <Button asChild variant="ghost" size="xl"><Link to="/">Inicio</Link></Button>
        </div>
      </main>
    </div>
  );
}
