import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { MapPin, Phone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { Button } from "@/components/ui/button";
import { getPublicWorkshop } from "@/lib/public-workshop.functions";
import { CATEGORY_META, isCategory } from "@/lib/catalog";
import { WEEKDAYS, formatDuration, formatPrice, hhmm } from "@/lib/workshop";

export const Route = createFileRoute("/taller/$slug")({
  loader: async ({ params }) => {
    const res = await getPublicWorkshop({ data: { slug: params.slug } });
    if (!res) throw notFound();
    return res;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Taller no encontrado — CitaMotor" }, { name: "robots", content: "noindex" }] };
    const w = loaderData.workshop;
    const title = `${w.name} — Reserva cita en ${w.city ?? "tu taller"} | CitaMotor`;
    const desc = `Servicios, horarios y cita online en ${w.name}${w.city ? `, ${w.city}` : ""}. Sin llamadas.`;
    return {
      meta: [
        { title }, { name: "description", content: desc },
        { property: "og:title", content: title }, { property: "og:description", content: desc },
        { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
        ...(w.is_demo ? [{ name: "robots", content: "noindex" }] : []),
      ],
    };
  },
  notFoundComponent: () => (
    <div className="min-h-screen"><SiteHeader />
      <main className="container-app py-12"><h1 className="text-2xl font-semibold">Este taller no está disponible.</h1>
        <Link to="/" className="mt-4 inline-block underline">Volver al inicio</Link></main></div>
  ),
  errorComponent: () => (
    <div className="min-h-screen"><SiteHeader />
      <main className="container-app py-12"><h1 className="text-2xl font-semibold">No se pudo cargar el taller.</h1>
        <p className="mt-2 text-body">Inténtalo de nuevo en unos minutos.</p></main></div>
  ),
  component: TallerPage,
});

function TallerPage() {
  const { workshop: w, services, hours } = Route.useLoaderData();
  const location = [w.address, [w.postal_code, w.city].filter(Boolean).join(" "), w.region].filter(Boolean).join(", ");
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app max-w-2xl py-8 pb-28">
        {w.is_demo && <p className="mb-3 inline-block rounded-full bg-band px-3 py-1 text-sm font-medium">Taller de demostración</p>}
        <h1 className="text-3xl font-semibold leading-tight">{w.name}</h1>
        {location && <p className="mt-2 flex items-start gap-2 text-body"><MapPin className="mt-0.5 size-5 shrink-0" />{location}</p>}
        {w.phone && <p className="mt-1 flex items-center gap-2 text-body"><Phone className="size-5" /><a href={`tel:${w.phone.replace(/\s/g, "")}`} className="underline">{w.phone}</a></p>}
        {w.description && <p className="mt-4 text-body">{w.description}</p>}

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Servicios</h2>
          <ul className="mt-3 divide-y divide-hairline rounded-xl border border-border">
            {services.map((s) => {
              const Icon = isCategory(s.category) ? CATEGORY_META[s.category].icon : null;
              return (
                <li key={s.id} className="flex items-start gap-3 p-4">
                  {Icon && <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-body" />}
                  <div className="flex-1">
                    <p className="text-base font-medium">{s.name}</p>
                    {s.description && <p className="text-sm text-body">{s.description}</p>}
                    <p className="text-sm text-body">
                      {s.duration_minutes > 0 && `${formatDuration(s.duration_minutes)} · `}
                      {s.booking_mode === "instant" ? "Reserva inmediata" : "Solicitud — el taller confirma"}
                    </p>
                  </div>
                  <p className="shrink-0 text-[15px] font-medium">{formatPrice(s.price_type, s.price_from)}</p>
                </li>
              );
            })}
          </ul>
          {services.some((s) => s.price_type !== "fixed") && <p className="mt-2 text-sm text-body">Los precios "desde" son orientativos. El precio final lo confirma el taller.</p>}
        </section>

        <section className="mt-8">
          <h2 className="text-xl font-semibold">Horario</h2>
          <dl className="mt-3 divide-y divide-hairline rounded-xl border border-border">
            {WEEKDAYS.map(({ d, label }) => {
              const list = hours.filter((h) => h.weekday === d);
              return (
                <div key={d} className="flex justify-between gap-4 px-4 py-3">
                  <dt className="text-[15px]">{label}</dt>
                  <dd className="text-right text-[15px] text-body">{list.length ? list.map((h) => `${hhmm(h.opens)}–${hhmm(h.closes)}`).join(" · ") : "Cerrado"}</dd>
                </div>
              );
            })}
          </dl>
        </section>
      </main>
      <div className="fixed inset-x-0 bottom-0 border-t border-hairline bg-background py-3">
        <div className="container-app max-w-2xl">
          <Button asChild size="xl" className="w-full"><Link to="/reservar">Reservar cita</Link></Button>
        </div>
      </div>
    </div>
  );
}
