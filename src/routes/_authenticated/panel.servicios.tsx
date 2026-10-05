import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PanelShell } from "@/components/panel-shell";
import { ServicesManager } from "@/components/services-manager";
import { myWorkshopQuery } from "@/lib/workshop";

export const Route = createFileRoute("/_authenticated/panel/servicios")({
  head: () => ({
    meta: [
      { title: "Servicios del taller — CitaMotor" },
      { name: "description", content: "Crea y edita los servicios que tus clientes pueden reservar." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Servicios del taller — CitaMotor" },
      { property: "og:description", content: "Crea y edita los servicios de tu taller." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Servicios,
});

function Servicios() {
  const { data, isLoading, error } = useQuery(myWorkshopQuery);
  return (
    <PanelShell>
      <h1 className="text-2xl font-semibold">Servicios</h1>
      <p className="mt-1 text-body">Los cambios no afectan a las citas ya reservadas.</p>
      <div className="mt-5">
        {isLoading ? <p className="text-body">Cargando…</p>
          : error ? <p role="alert" className="text-destructive">No se pudo cargar tu taller. Recarga la página.</p>
          : data?.workshop ? <ServicesManager workshopId={data.workshop.id} />
          : <p className="text-body">No tienes taller propio.</p>}
      </div>
    </PanelShell>
  );
}
