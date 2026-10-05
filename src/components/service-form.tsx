import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CATEGORY_META, SERVICE_CATEGORIES, type ServiceCategory } from "@/lib/catalog";
import { friendlyDbError, type BookingMode, type PriceType, type Service } from "@/lib/workshop";
import { cn } from "@/lib/utils";

export type ServiceDraft = {
  name: string; category: ServiceCategory; description: string; price_type: PriceType; price: string;
  duration: number; buffer: number; booking_mode: BookingMode;
};

/** Selectable suggestions for new talleres. Nothing is created until the owner confirms the form. */
export const SUGGESTIONS: ServiceDraft[] = [
  { name: "Cambio de aceite y filtro", category: "oil_change", description: "", price_type: "from", price: "", duration: 45, buffer: 15, booking_mode: "instant" },
  { name: "Cambio de neumáticos", category: "tyres", description: "", price_type: "quote", price: "", duration: 60, buffer: 15, booking_mode: "instant" },
  { name: "Revisión general", category: "inspection", description: "", price_type: "from", price: "", duration: 60, buffer: 15, booking_mode: "instant" },
  { name: "Cambio de batería", category: "battery", description: "", price_type: "from", price: "", duration: 30, buffer: 10, booking_mode: "instant" },
  { name: "Frenos", category: "brakes", description: "", price_type: "quote", price: "", duration: 90, buffer: 15, booking_mode: "request" },
  { name: "Diagnóstico de avería", category: "diagnosis", description: "", price_type: "quote", price: "", duration: 60, buffer: 15, booking_mode: "request" },
];

export const blankDraft = (): ServiceDraft => ({ name: "", category: "other", description: "", price_type: "quote", price: "", duration: 60, buffer: 0, booking_mode: "request" });

export function draftFromService(s: Service): ServiceDraft {
  return {
    name: s.name, category: s.category as ServiceCategory, description: s.description ?? "", price_type: s.price_type,
    price: s.price_from == null ? "" : String(s.price_from), duration: s.duration_minutes, buffer: s.buffer_minutes, booking_mode: s.booking_mode,
  };
}

const schema = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del servicio").max(120),
  description: z.string().trim().max(1000),
}).passthrough();

const DURATIONS = [15, 30, 45, 60, 90, 120, 180];
const BUFFERS = [0, 10, 15, 30];
const inputCls = "h-12 w-full rounded-[10px] border border-border bg-background px-3 text-base text-foreground outline-none focus:border-foreground";
const chip = (on: boolean) => cn("min-h-11 rounded-lg border px-3 text-sm font-medium", on ? "border-foreground bg-foreground text-background" : "border-border bg-background text-foreground hover:bg-hover-surface");

function Choice({ on, title, text, onClick }: { on: boolean; title: string; text: string; onClick: () => void }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick}
      className={cn("w-full rounded-xl border p-3 text-left", on ? "border-foreground ring-1 ring-foreground" : "border-border hover:bg-hover-surface")}>
      <span className="block text-[15px] font-medium text-foreground">{title}</span>
      <span className="block text-sm text-body">{text}</span>
    </button>
  );
}

export function ServiceForm({ workshopId, serviceId, initial, onDone, onCancel }: {
  workshopId: string; serviceId?: string | undefined; initial: ServiceDraft; onDone: () => void; onCancel: () => void;
}) {
  const [f, setF] = useState<ServiceDraft>(initial);
  const [custom, setCustom] = useState(!DURATIONS.includes(initial.duration));
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof ServiceDraft>(k: K, v: ServiceDraft[K]) => setF((p) => ({ ...p, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const p = schema.safeParse(f);
    if (!p.success) return setErr(p.error.issues[0]?.message ?? "Revisa los datos");
    const price = f.price_type === "quote" ? null : Number(f.price.replace(",", "."));
    if (price !== null && (!Number.isFinite(price) || price < 0 || price > 100000)) return setErr("Escribe un precio válido.");
    if (!Number.isInteger(f.duration) || f.duration < 0 || f.duration > 1440) return setErr("Escribe una duración válida en minutos.");
    if (f.booking_mode === "instant" && f.duration < 5) return setErr("La reserva automática necesita saber cuánto dura el trabajo.");
    const row = {
      name: f.name.trim(), category: f.category, description: f.description.trim() || null, price_type: f.price_type,
      price_from: price, duration_minutes: f.duration, buffer_minutes: f.buffer, booking_mode: f.booking_mode,
    };
    setBusy(true);
    const { error } = serviceId
      ? await supabase.from("services").update(row).eq("id", serviceId)
      : await supabase.from("services").insert({ ...row, workshop_id: workshopId });
    setBusy(false);
    if (error) return setErr(friendlyDbError(error));
    onDone();
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 rounded-xl border border-border p-4">
      <label className="block text-sm font-medium text-body">Nombre del servicio
        <input className={`${inputCls} mt-1`} value={f.name} onChange={(e) => set("name", e.target.value)} />
      </label>
      <label className="block text-sm font-medium text-body">Categoría
        <select className={`${inputCls} mt-1`} value={f.category} onChange={(e) => set("category", e.target.value as ServiceCategory)}>
          {SERVICE_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
        </select>
      </label>
      <label className="block text-sm font-medium text-body">Descripción (opcional)
        <textarea rows={2} className="mt-1 w-full rounded-[10px] border border-border bg-background p-3 text-base outline-none focus:border-foreground"
          value={f.description} onChange={(e) => set("description", e.target.value)} />
      </label>

      <fieldset>
        <legend className="text-sm font-medium text-body">Precio</legend>
        <div role="radiogroup" className="mt-1 flex flex-wrap gap-2">
          {([["fixed", "Precio fijo"], ["from", "Desde"], ["quote", "A consultar"]] as const).map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={f.price_type === v} className={chip(f.price_type === v)} onClick={() => set("price_type", v)}>{l}</button>
          ))}
        </div>
        {f.price_type !== "quote" ? (
          <div className="mt-2 flex items-center gap-2">
            {f.price_type === "from" && <span className="text-base text-body">Desde</span>}
            <input aria-label="Precio en euros" inputMode="decimal" className={`${inputCls} max-w-[9rem]`} value={f.price} onChange={(e) => set("price", e.target.value)} placeholder="49" />
            <span className="text-base text-body">€</span>
          </div>
        ) : <p className="mt-2 text-sm text-body">El cliente verá "Consultar precio".</p>}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-body">¿Cuánto suele durar este trabajo?</legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {DURATIONS.map((m) => (
            <button key={m} type="button" className={chip(!custom && f.duration === m)} onClick={() => { setCustom(false); set("duration", m); }}>
              {m < 60 ? `${m} min` : `${m / 60} h`.replace(".5", ",5")}
            </button>
          ))}
          <button type="button" className={chip(custom)} onClick={() => setCustom(true)}>Otro</button>
        </div>
        {custom && (
          <div className="mt-2 flex items-center gap-2">
            <input aria-label="Duración en minutos" inputMode="numeric" className={`${inputCls} max-w-[7rem]`} value={f.duration || ""}
              onChange={(e) => set("duration", parseInt(e.target.value.replace(/\D/g, "") || "0", 10))} />
            <span className="text-base text-body">minutos</span>
          </div>
        )}
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-body">Tiempo extra entre coches</legend>
        <p className="text-sm text-body">Tiempo adicional que necesitas para preparar el siguiente trabajo.</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {BUFFERS.map((m) => <button key={m} type="button" className={chip(f.buffer === m)} onClick={() => set("buffer", m)}>{m === 0 ? "Nada" : `${m} min`}</button>)}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-medium text-body">¿Cómo quieres recibir estas citas?</legend>
        <div role="radiogroup" className="mt-1 grid gap-2">
          <Choice on={f.booking_mode === "instant"} title="Reserva automática" text="El cliente puede reservar una hora directamente. Ideal para trabajos rutinarios, como un cambio de aceite." onClick={() => set("booking_mode", "instant")} />
          <Choice on={f.booking_mode === "request"} title="Solicitud de cita" text="El cliente solicita una hora y tú la confirmas. Mejor si necesitas ver el coche antes, como un diagnóstico." onClick={() => set("booking_mode", "request")} />
        </div>
      </fieldset>

      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="xl" className="flex-1" disabled={busy}>{serviceId ? "Guardar cambios" : "Añadir servicio"}</Button>
        <Button type="button" variant="ghost" size="xl" onClick={onCancel}>Cancelar</Button>
      </div>
    </form>
  );
}
