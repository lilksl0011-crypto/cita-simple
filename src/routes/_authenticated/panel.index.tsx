import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PanelShell } from "@/components/panel-shell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { STATUS_LABEL, friendlyDbError, myWorkshopQuery, workshopStatus } from "@/lib/workshop";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/panel/")({
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
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery(myWorkshopQuery);
  const [err, setErr] = useState<string | null>(null);
  const w = data?.workshop;

  async function setActive(active: boolean) {
    if (!w) return;
    setErr(null);
    const { error } = await supabase.from("workshops").update(active ? { active, onboarding_completed_at: w.onboarding_completed_at ?? new Date().toISOString() } : { active }).eq("id", w.id);
    if (error) setErr(friendlyDbError(error));
    qc.invalidateQueries({ queryKey: ["my-workshop"] });
  }

  return (
    <PanelShell>
      {isLoading && <p className="text-body">Cargando…</p>}
      {error && <p role="alert" className="text-destructive">No se pudo cargar tu cuenta. Recarga la página.</p>}
      {data?.isAdmin && <p className="rounded-xl border border-border p-4 font-medium">Cuenta de administrador.</p>}
      {w && (() => {
        const st = workshopStatus(w);
        return (
          <section>
            <h1 className="text-2xl font-semibold">{w.name}</h1>
            <p className="mt-2">
              <span className={cn("inline-block rounded-full px-3 py-1 text-sm font-medium",
                st === "ready" ? "bg-success text-success-foreground" : "bg-band text-foreground")}>{STATUS_LABEL[st]}</span>
            </p>
            {st === "draft" || st === "incomplete" ? (
              <div className="mt-6 space-y-3">
                <p className="text-body">Configura tu taller en unos 2 minutos para empezar a recibir citas.</p>
                <Button asChild size="xl" className="w-full"><Link to="/panel/onboarding">{st === "draft" ? "Empezar configuración" : "Continuar configuración"}</Link></Button>
              </div>
            ) : (
              <div className="mt-6 grid gap-3">
                {st === "ready" && <Button asChild size="xl"><Link to="/taller/$slug" params={{ slug: w.slug }}>Ver mi página</Link></Button>}
                {st === "inactive" && <Button size="xl" onClick={() => setActive(true)}>Publicar mi página</Button>}
                <Button asChild variant="outline" size="xl"><Link to="/panel/onboarding" search={{ paso: 1 }}>Editar configuración</Link></Button>
                <Button asChild variant="outline" size="xl"><Link to="/panel/servicios">Servicios</Link></Button>
                {st === "ready" && (
                  <button className="min-h-12 text-sm font-medium text-body underline" onClick={() => { if (confirm("Tu página dejará de aceptar citas. ¿Continuar?")) setActive(false); }}>
                    Pausar mi página
                  </button>
                )}
              </div>
            )}
            {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
          </section>
        );
      })()}
    </PanelShell>
  );
}
