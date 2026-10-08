import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";

// Las RPC de bloqueos (migración 0005) aún no están en types.ts (se genera desde la base real),
// por eso se llaman con un tipo local. Las horas viajan SIEMPRE en hora local del taller:
// la conversión a instante la hace la base de datos con workshops.timezone.
type RpcResult<T> = PromiseLike<{ data: T | null; error: { message: string } | null }>;
function rpc<T = unknown>(fn: string, args?: Record<string, unknown>): RpcResult<T> {
  const call = supabase.rpc as unknown as (f: string, a?: Record<string, unknown>) => RpcResult<T>;
  return call.call(supabase, fn, args);
}

type Block = { id: string; starts_local: string; ends_local: string; reason: string | null };
type FormState = { id: string | null; sd: string; st: string; ed: string; et: string; reason: string };

const EMPTY: FormState = { id: null, sd: "", st: "09:00", ed: "", et: "10:00", reason: "" };

// "2026-11-03T10:00:00" (sin zona) → texto legible; se interpreta como reloj de pared, sin convertir.
const wall = new Intl.DateTimeFormat("es-ES", {
  timeZone: "UTC", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
});
const showLocal = (s: string) => wall.format(new Date(`${s.slice(0, 19)}Z`));

function todayIn(tz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(new Date());
  }
}

function friendly(message: string): string {
  if (/could not find the function|schema cache/i.test(message)) {
    return "Falta aplicar la migración 0005 en la base de datos.";
  }
  if (message.startsWith("Bloqueo")) return message;
  return "No se pudo guardar el bloqueo. Inténtalo de nuevo.";
}

export function BlockedTimes({ workshopId, timezone }: { workshopId: string; timezone: string }) {
  const qc = useQueryClient();
  const key = ["my-blocks", workshopId];
  const [form, setForm] = useState<FormState | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await rpc<Block[]>("list_my_blocks");
      if (error) throw new Error(error.message);
      return data ?? [];
    },
  });

  const today = todayIn(timezone);

  function startNew() {
    setErr(null);
    setForm({ ...EMPTY, sd: today, ed: today });
  }

  function startEdit(b: Block) {
    setErr(null);
    setForm({
      id: b.id,
      sd: b.starts_local.slice(0, 10),
      st: b.starts_local.slice(11, 16),
      ed: b.ends_local.slice(0, 10),
      et: b.ends_local.slice(11, 16),
      reason: b.reason ?? "",
    });
  }

  async function save() {
    if (!form) return;
    setErr(null);
    if (!form.sd || !form.st || !form.ed || !form.et) {
      setErr("Indica fecha y hora de inicio y de fin.");
      return;
    }
    if (`${form.ed}T${form.et}` <= `${form.sd}T${form.st}`) {
      setErr("El fin debe ser posterior al inicio.");
      return;
    }
    setBusy(true);
    const { error } = await rpc("save_my_block", {
      _id: form.id,
      _starts_local: `${form.sd}T${form.st}:00`,
      _ends_local: `${form.ed}T${form.et}:00`,
      _reason: form.reason,
    });
    setBusy(false);
    if (error) {
      setErr(friendly(error.message));
      return;
    }
    setForm(null);
    qc.invalidateQueries({ queryKey: key });
    // La disponibilidad pública depende de los bloqueos.
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  async function remove(b: Block) {
    if (!confirm("¿Eliminar este bloqueo? Esas horas volverán a poder reservarse.")) return;
    setErr(null);
    const { error } = await rpc("delete_my_block", { _id: b.id });
    if (error) {
      setErr(friendly(error.message));
      return;
    }
    if (form?.id === b.id) setForm(null);
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["availability"] });
  }

  const field = "mt-1 min-h-12";

  return (
    <section className="mt-10" aria-labelledby="bloqueos-title">
      <h2 id="bloqueos-title" className="text-lg font-semibold">Bloqueos de horas</h2>
      <p className="mt-1 text-sm text-body">
        Bloquea un tramo concreto (formación, avería, vacaciones…). Los clientes no podrán reservar en esas horas.
        Usa la hora de tu taller ({timezone}).
      </p>

      {isLoading && <p className="mt-3 text-body">Cargando…</p>}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
          {friendly((error as Error).message).startsWith("Falta")
            ? "Falta aplicar la migración 0005 en la base de datos."
            : "No se pudieron cargar los bloqueos."}
        </p>
      )}

      {data && data.length === 0 && !form && <p className="mt-3 text-sm text-muted-foreground">No tienes bloqueos próximos.</p>}

      {data && data.length > 0 && (
        <ul className="mt-3 space-y-2">
          {data.map((b) => (
            <li key={b.id} className="tile flex flex-wrap items-center justify-between gap-2 p-3">
              <div>
                <p className="font-medium">{showLocal(b.starts_local)} → {showLocal(b.ends_local)}</p>
                {b.reason && <p className="text-sm text-muted-foreground">{b.reason}</p>}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => startEdit(b)}>Editar</Button>
                <Button type="button" variant="outline" onClick={() => remove(b)}>Eliminar</Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {form ? (
        <form
          className="tile mt-4 grid gap-3 p-4"
          onSubmit={(e) => { e.preventDefault(); void save(); }}
          aria-label={form.id ? "Editar bloqueo" : "Nuevo bloqueo"}
        >
          <div className="grid grid-cols-2 gap-3">
            <label className="text-sm font-medium">Inicio (fecha)
              <Input className={field} type="date" min={form.id ? undefined : today} value={form.sd}
                onChange={(e) => setForm({ ...form, sd: e.target.value })} required />
            </label>
            <label className="text-sm font-medium">Inicio (hora)
              <Input className={field} type="time" step={900} value={form.st}
                onChange={(e) => setForm({ ...form, st: e.target.value })} required />
            </label>
            <label className="text-sm font-medium">Fin (fecha)
              <Input className={field} type="date" min={form.sd || undefined} value={form.ed}
                onChange={(e) => setForm({ ...form, ed: e.target.value })} required />
            </label>
            <label className="text-sm font-medium">Fin (hora)
              <Input className={field} type="time" step={900} value={form.et}
                onChange={(e) => setForm({ ...form, et: e.target.value })} required />
            </label>
          </div>
          <label className="text-sm font-medium">Motivo (opcional)
            <Input className={field} type="text" maxLength={200} value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </label>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy}>{busy ? "Guardando…" : "Guardar bloqueo"}</Button>
            <Button type="button" variant="outline" onClick={() => { setForm(null); setErr(null); }}>Cancelar</Button>
          </div>
        </form>
      ) : (
        <Button type="button" variant="outline" size="xl" className="mt-4 w-full" onClick={startNew}>Añadir bloqueo</Button>
      )}

      {err && <p role="alert" className="mt-3 text-sm text-destructive">{err}</p>}
    </section>
  );
}
