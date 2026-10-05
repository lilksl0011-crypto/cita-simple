import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { Check, Minus, Plus, Trash2 } from "lucide-react";
import { PanelShell, StickyActions } from "@/components/panel-shell";
import { HoursEditor, emptyWeek, validateWeek, type WeekHours } from "@/components/hours-editor";
import { ServicesManager } from "@/components/services-manager";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  ONBOARDING_STEPS, friendlyDbError, hhmm, hoursQuery, myWorkshopQuery, servicesQuery, type Workshop,
} from "@/lib/workshop";
import { cn } from "@/lib/utils";

const search = z.object({ paso: z.coerce.number().int().min(1).max(5).optional().catch(undefined) });

export const Route = createFileRoute("/_authenticated/panel/onboarding")({
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Configura tu taller — CitaMotor" },
      { name: "description", content: "Configura tu taller en CitaMotor en unos 2 minutos." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Configura tu taller — CitaMotor" },
      { property: "og:description", content: "Información, horario, capacidad y servicios." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const inputCls = "h-12 w-full rounded-[10px] border border-border bg-background px-3 text-base text-foreground outline-none focus:border-foreground";
const chip = (on: boolean) => cn("min-h-12 rounded-lg border px-4 text-[15px] font-medium", on ? "border-foreground bg-foreground text-background" : "border-border bg-background hover:bg-hover-surface");

function Onboarding() {
  const { paso } = Route.useSearch();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery(myWorkshopQuery);
  const w = data?.workshop;

  if (isLoading) return <PanelShell><p className="text-body">Cargando…</p></PanelShell>;
  if (error) return <PanelShell><p role="alert" className="text-destructive">No se pudo cargar tu taller. Recarga la página.</p></PanelShell>;
  if (!w) return <PanelShell><p className="text-body">{data?.isAdmin ? "Las cuentas de administrador no tienen taller propio." : "No encontramos tu taller."}</p></PanelShell>;

  const step = paso ?? Math.min(w.onboarding_step + 1, 5);
  const go = (n: number) => navigate({ to: "/panel/onboarding", search: { paso: n } });

  return (
    <PanelShell>
      <ol className="flex gap-1.5" aria-label="Progreso">
        {ONBOARDING_STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <span className={cn("block h-1 rounded-full", i < step ? "bg-primary" : "bg-hairline")} />
            <span className="sr-only">{s}{i + 1 === step ? " (paso actual)" : ""}</span>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-sm text-body">Paso {step} de 5 · {ONBOARDING_STEPS[step - 1]}</p>
      {step === 1 && <InfoStep w={w} next={() => go(2)} />}
      {step === 2 && <HoursStep w={w} back={() => go(1)} next={() => go(3)} />}
      {step === 3 && <CapacityStep w={w} back={() => go(2)} next={() => go(4)} />}
      {step === 4 && <ServicesStep w={w} back={() => go(3)} next={() => go(5)} />}
      {step === 5 && <DoneStep w={w} />}
    </PanelShell>
  );
}

/** Persist progress: onboarding_step only moves forward. */
async function saveStep(w: Workshop, n: number, extra: Partial<Workshop> = {}) {
  return supabase.from("workshops").update({ ...extra, onboarding_step: Math.max(w.onboarding_step, n) }).eq("id", w.id);
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["my-workshop"] });
}

function Actions({ back, busy, label = "Continuar", onNext }: { back?: () => void; busy: boolean; label?: string; onNext: () => void }) {
  return (
    <StickyActions>
      {back && <Button variant="outline" size="xl" onClick={back} type="button">Atrás</Button>}
      <Button size="xl" className="flex-1" disabled={busy} onClick={onNext} type="button">{busy ? "Guardando…" : label}</Button>
    </StickyActions>
  );
}

const infoSchema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del taller").max(120),
  phone: z.string().trim().min(6, "Escribe un teléfono de contacto").max(30).regex(/^[+\d\s()-]+$/, "Teléfono no válido"),
  email: z.union([z.literal(""), z.string().trim().email("Email no válido").max(255)]),
  address: z.string().trim().min(3, "Escribe la dirección").max(200),
  city: z.string().trim().min(2, "Escribe la ciudad o localidad").max(80),
  postal_code: z.string().trim().max(12),
  region: z.string().trim().max(80),
  country: z.string().length(2),
});

function InfoStep({ w, next }: { w: Workshop; next: () => void }) {
  const invalidate = useInvalidate();
  const [f, setF] = useState({
    name: w.name, phone: w.phone ?? "", email: w.email ?? "", address: w.address ?? "", city: w.city ?? "",
    postal_code: w.postal_code ?? "", region: w.region ?? "", country: w.country || "ES",
  });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof typeof f, label: string, props: Record<string, string> = {}) => (
    <label className="block text-sm font-medium text-body">{label}
      <input className={`${inputCls} mt-1`} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...props} />
    </label>
  );
  async function onNext() {
    setErr(null);
    const p = infoSchema.safeParse(f);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Revisa los datos");
    setBusy(true);
    const v = p.data;
    const { error } = await saveStep(w, 1, {
      name: v.name, phone: v.phone, email: v.email || null, address: v.address, city: v.city,
      postal_code: v.postal_code || null, region: v.region || null, country: v.country, timezone: "Europe/Madrid",
    });
    setBusy(false);
    if (error) return setErr(friendlyDbError(error));
    await invalidate();
    next();
  }
  return (
    <section className="mt-4 space-y-3">
      <h1 className="text-2xl font-semibold">Información del taller</h1>
      <p className="text-body">Así te verán tus clientes.</p>
      {field("name", "Nombre del taller", { autoComplete: "organization" })}
      {field("phone", "Teléfono", { type: "tel", autoComplete: "tel", inputMode: "tel" })}
      {field("email", "Email de contacto (opcional)", { type: "email", autoComplete: "email" })}
      {field("address", "Dirección", { autoComplete: "street-address", placeholder: "Calle y número" })}
      <div className="grid grid-cols-2 gap-3">
        {field("city", "Ciudad o localidad", { placeholder: "Ibiza" })}
        {field("postal_code", "Código postal", { inputMode: "numeric", autoComplete: "postal-code" })}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {field("region", "Provincia o isla (opcional)", { placeholder: "Illes Balears" })}
        <label className="block text-sm font-medium text-body">País
          <select className={`${inputCls} mt-1`} value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>
            <option value="ES">España</option>
            <option value="AD">Andorra</option>
            <option value="PT">Portugal</option>
          </select>
        </label>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Actions busy={busy} onNext={onNext} />
    </section>
  );
}

function HoursStep({ w, back, next }: { w: Workshop; back: () => void; next: () => void }) {
  const invalidate = useInvalidate();
  const qc = useQueryClient();
  const { data: hours, isLoading } = useQuery(hoursQuery(w.id));
  const [week, setWeek] = useState<WeekHours | null>(null);
  const [showErrors, setShowErrors] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!hours || week) return;
    const wk = emptyWeek();
    if (hours.length === 0) {
      for (const d of [1, 2, 3, 4, 5]) wk[d] = [{ opens: "08:00", closes: "13:00" }, { opens: "15:00", closes: "19:00" }];
    } else for (const h of hours) wk[h.weekday]!.push({ opens: hhmm(h.opens), closes: hhmm(h.closes) });
    setWeek(wk);
  }, [hours, week]);

  async function onNext() {
    if (!week) return;
    setErr(null); setShowErrors(true);
    if (Object.values(validateWeek(week)).some(Boolean)) return setErr("Revisa los días marcados en rojo.");
    const intervals = Object.entries(week).flatMap(([d, list]) => list.map((i) => ({ weekday: Number(d), opens: i.opens, closes: i.closes })));
    if (!intervals.length) return setErr("Abre al menos un día para poder recibir citas.");
    setBusy(true);
    const { error } = await supabase.rpc("save_my_hours", { _intervals: intervals });
    const r2 = error ? null : await saveStep(w, 2);
    setBusy(false);
    if (error || r2?.error) return setErr(friendlyDbError(error ?? r2?.error));
    qc.invalidateQueries({ queryKey: ["hours", w.id] });
    await invalidate();
    next();
  }

  return (
    <section className="mt-4 space-y-4">
      <h1 className="text-2xl font-semibold">Horario</h1>
      <p className="text-body">Indica cuándo está abierto el taller. Si cierras a mediodía, añade un segundo tramo.</p>
      {isLoading || !week ? <p className="text-body">Cargando…</p> : <HoursEditor value={week} onChange={setWeek} showErrors={showErrors} />}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Closures workshopId={w.id} />
      <Actions back={back} busy={busy} onNext={onNext} />
    </section>
  );
}

const dateFmt = new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
function todayMadrid() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
}

function Closures({ workshopId }: { workshopId: string }) {
  const qc = useQueryClient();
  const key = ["closures", workshopId];
  const { data = [] } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase.from("workshop_closures").select("id,date,reason").eq("workshop_id", workshopId).gte("date", todayMadrid()).order("date");
      if (error) throw error;
      return data;
    },
  });
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    setErr(null);
    if (!date || date < todayMadrid()) return setErr("Elige una fecha de hoy en adelante.");
    if (data.some((c) => c.date === date)) return setErr("Ese día ya está marcado como cerrado.");
    const { error } = await supabase.from("workshop_closures").insert({ workshop_id: workshopId, date, reason: reason.trim().slice(0, 120) || null });
    if (error) return setErr(friendlyDbError(error));
    setDate(""); setReason("");
    qc.invalidateQueries({ queryKey: key });
  }
  async function remove(id: string) {
    await supabase.from("workshop_closures").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: key });
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <h2 className="text-base font-medium">Días cerrados</h2>
      <p className="text-sm text-body">Vacaciones, festivos o cierres puntuales. Ese día no se ofrecerán citas.</p>
      {data.length > 0 && (
        <ul className="mt-3 divide-y divide-hairline">
          {data.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-[15px]"><span className="first-letter:uppercase inline-block">{dateFmt.format(new Date(`${c.date}T00:00:00Z`))}</span> — Cerrado{c.reason ? ` (${c.reason})` : ""}</span>
              <button aria-label="Quitar día cerrado" className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-hover-surface" onClick={() => remove(c.id)}>
                <Trash2 className="size-5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <input aria-label="Fecha" type="date" min={todayMadrid()} className={`${inputCls} w-auto`} value={date} onChange={(e) => setDate(e.target.value)} />
        <input aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" className={`${inputCls} min-w-0 flex-1`} value={reason} onChange={(e) => setReason(e.target.value)} />
        <button type="button" className="min-h-12 rounded-lg border border-border px-4 text-[15px] font-medium hover:bg-hover-surface" onClick={add}>Añadir</button>
      </div>
      {err && <p role="alert" className="mt-2 text-sm text-destructive">{err}</p>}
    </div>
  );
}

function CapacityStep({ w, back, next }: { w: Workshop; back: () => void; next: () => void }) {
  const invalidate = useInvalidate();
  const [cap, setCap] = useState(w.capacity_per_slot);
  const [interval, setInterval] = useState(w.slot_interval_minutes);
  const [lead, setLead] = useState(w.min_lead_time_minutes);
  const [horizon, setHorizon] = useState(w.max_booking_horizon_days);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const example = Array.from({ length: 3 }, (_, i) => {
    const m = 9 * 60 + i * interval;
    return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  }).join(", ");

  async function onNext() {
    setErr(null); setBusy(true);
    const { error } = await saveStep(w, 3, {
      capacity_per_slot: cap, slot_interval_minutes: interval, min_lead_time_minutes: lead, max_booking_horizon_days: horizon,
    });
    setBusy(false);
    if (error) return setErr(friendlyDbError(error));
    await invalidate();
    next();
  }

  return (
    <section className="mt-4 space-y-7">
      <div>
        <h1 className="text-2xl font-semibold">¿Cuántos coches podéis atender al mismo tiempo?</h1>
        <p className="mt-1 text-body">Puedes cambiarlo más adelante.</p>
        <div className="mt-3 flex items-center gap-4">
          <button type="button" aria-label="Uno menos" disabled={cap <= 1} className="grid size-12 place-items-center rounded-xl border border-border disabled:opacity-40" onClick={() => setCap(cap - 1)}><Minus className="size-5" /></button>
          <output aria-live="polite" className="w-16 text-center text-3xl font-semibold">{cap}</output>
          <button type="button" aria-label="Uno más" disabled={cap >= 10} className="grid size-12 place-items-center rounded-xl border border-border disabled:opacity-40" onClick={() => setCap(cap + 1)}><Plus className="size-5" /></button>
          <span className="text-body">{cap === 1 ? "coche" : "coches"}</span>
        </div>
      </div>
      <div>
        <h2 className="text-lg font-semibold">¿Cada cuánto quieres que podamos ofrecer una nueva hora de entrada?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[15, 30, 60].map((m) => <button key={m} type="button" className={chip(interval === m)} onClick={() => setInterval(m)}>{m} minutos</button>)}
        </div>
        <p className="mt-2 text-sm text-body">Con {interval} minutos, podemos ofrecer citas a las {example}…</p>
      </div>
      <div>
        <h2 className="text-lg font-semibold">¿Con cuánta antelación quieres recibir una nueva cita?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {([[30, "30 min"], [60, "1 hora"], [120, "2 horas"], [1440, "1 día"]] as const).map(([m, l]) => (
            <button key={m} type="button" className={chip(lead === m)} onClick={() => setLead(m)}>{l}</button>
          ))}
        </div>
        <p className="mt-2 text-sm text-body">Nadie podrá reservar con menos tiempo que este.</p>
      </div>
      <div>
        <h2 className="text-lg font-semibold">¿Con cuántos días de antelación quieres permitir reservas?</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {[7, 14, 30, 60, 90].map((d) => <button key={d} type="button" className={chip(horizon === d)} onClick={() => setHorizon(d)}>{d} días</button>)}
        </div>
      </div>
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Actions back={back} busy={busy} onNext={onNext} />
    </section>
  );
}

function ServicesStep({ w, back, next }: { w: Workshop; back: () => void; next: () => void }) {
  const invalidate = useInvalidate();
  const { data: services = [] } = useQuery(servicesQuery(w.id));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onNext() {
    setErr(null);
    if (!services.some((s) => s.active)) return setErr("Añade al menos un servicio activo para continuar.");
    setBusy(true);
    // Publishing is re-validated in the database: it refuses if anything required is missing.
    const { error } = await saveStep(w, 5, { active: true, onboarding_completed_at: w.onboarding_completed_at ?? new Date().toISOString() });
    setBusy(false);
    if (error) return setErr(friendlyDbError(error));
    await invalidate();
    next();
  }

  return (
    <section className="mt-4 space-y-4">
      <h1 className="text-2xl font-semibold">Servicios</h1>
      <p className="text-body">¿Qué trabajos quieres que tus clientes puedan reservar?</p>
      <ServicesManager workshopId={w.id} />
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <Actions back={back} busy={busy} label="Terminar" onNext={onNext} />
    </section>
  );
}

function DoneStep({ w }: { w: Workshop }) {
  const { data: hours = [] } = useQuery(hoursQuery(w.id));
  const { data: services = [] } = useQuery(servicesQuery(w.id));
  const invalidate = useInvalidate();
  const [err, setErr] = useState<string | null>(null);
  const items = [
    { label: "Información", ok: !!(w.name && w.address && w.city), paso: 1 },
    { label: "Horarios", ok: hours.length > 0, paso: 2 },
    { label: "Capacidad", ok: w.onboarding_step >= 3, paso: 3 },
    { label: "Servicios", ok: services.some((s) => s.active), paso: 4 },
  ];
  const allOk = items.every((i) => i.ok);

  async function publish() {
    setErr(null);
    const { error } = await supabase.from("workshops").update({ active: true, onboarding_completed_at: w.onboarding_completed_at ?? new Date().toISOString() }).eq("id", w.id);
    if (error) return setErr(friendlyDbError(error));
    invalidate();
  }

  return (
    <section className="mt-4">
      <h1 className="text-3xl font-semibold">{w.active ? "Tu taller está listo." : allOk ? "Tu taller está configurado." : "Falta algún paso."}</h1>
      <ul className="mt-5 space-y-2">
        {items.map((i) => (
          <li key={i.label} className="flex items-center justify-between rounded-xl border border-border p-4">
            <span className="flex items-center gap-3 text-base font-medium">
              <span className={cn("grid size-7 place-items-center rounded-full", i.ok ? "bg-success text-success-foreground" : "bg-band text-muted-foreground")}>
                {i.ok ? <Check className="size-4" /> : <Minus className="size-4" />}
              </span>
              {i.label}
            </span>
            {!i.ok && <Link to="/panel/onboarding" search={{ paso: i.paso }} className="text-sm font-medium underline">Completar</Link>}
          </li>
        ))}
      </ul>
      {w.active ? (
        <p className="mt-5 text-lg">Tu página de reservas está lista.</p>
      ) : allOk ? (
        <p className="mt-5 text-body">Tu página no está publicada. Publícala cuando quieras empezar a recibir citas.</p>
      ) : null}
      {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
      <div className="mt-6 grid gap-3">
        {w.active ? (
          <Button asChild size="xl"><Link to="/taller/$slug" params={{ slug: w.slug }}>Ver mi página</Link></Button>
        ) : allOk ? (
          <Button size="xl" onClick={publish}>Publicar mi página</Button>
        ) : null}
        <Button asChild variant="outline" size="xl"><Link to="/panel/onboarding" search={{ paso: 1 }}>Editar configuración</Link></Button>
      </div>
    </section>
  );
}
