import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ServiceForm, SUGGESTIONS, blankDraft, draftFromService, type ServiceDraft } from "@/components/service-form";
import { formatDuration, formatPrice, friendlyDbError, servicesQuery } from "@/lib/workshop";

type Editing = { id?: string; draft: ServiceDraft } | null;

export function ServicesManager({ workshopId }: { workshopId: string }) {
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useQuery(servicesQuery(workshopId));
  const [editing, setEditing] = useState<Editing>(null);
  const [err, setErr] = useState<string | null>(null);
  const refresh = () => { qc.invalidateQueries({ queryKey: ["services", workshopId] }); qc.invalidateQueries({ queryKey: ["my-workshop"] }); };

  async function patch(id: string, row: { active?: boolean; deleted_at?: string }) {
    setErr(null);
    const { error } = await supabase.from("services").update(row).eq("id", id);
    if (error) setErr(friendlyDbError(error));
    refresh();
  }

  const usedNames = new Set(services.map((s) => s.name.toLowerCase()));
  const suggestions = SUGGESTIONS.filter((s) => !usedNames.has(s.name.toLowerCase()));

  if (editing) {
    return (
      <ServiceForm key={editing.id ?? editing.draft.name} workshopId={workshopId} serviceId={editing.id} initial={editing.draft}
        onDone={() => { setEditing(null); refresh(); }} onCancel={() => setEditing(null)} />
    );
  }

  return (
    <div className="space-y-6">
      {isLoading ? <p className="text-body">Cargando…</p> : services.length === 0 ? (
        <p className="rounded-xl bg-band p-4 text-[15px] text-body">Aún no tienes servicios. Elige una sugerencia o crea uno nuevo.</p>
      ) : (
        <ul className="space-y-3">
          {services.map((s) => (
            <li key={s.id} className="rounded-xl border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className={s.active ? "text-base font-medium" : "text-base font-medium text-muted-foreground"}>{s.name}</p>
                  <p className="text-sm text-body">
                    {formatPrice(s.price_type, s.price_from)}
                    {s.duration_minutes > 0 && ` · ${formatDuration(s.duration_minutes)}`}
                    {` · ${s.booking_mode === "instant" ? "Reserva automática" : "Solicitud de cita"}`}
                  </p>
                </div>
                <label className="flex min-h-11 shrink-0 items-center gap-2 text-sm text-body">
                  <input type="checkbox" className="size-5 accent-primary" checked={s.active} onChange={(e) => patch(s.id, { active: e.target.checked })} />
                  {s.active ? "Activo" : "Desactivado"}
                </label>
              </div>
              <div className="mt-2 flex gap-2">
                <button className="min-h-11 rounded-lg border border-border px-3 text-sm font-medium hover:bg-hover-surface" onClick={() => setEditing({ id: s.id, draft: draftFromService(s) })}>Editar</button>
                <button className="min-h-11 rounded-lg px-3 text-sm font-medium text-destructive hover:bg-hover-surface"
                  onClick={() => { if (confirm(`¿Eliminar "${s.name}"? Las citas ya reservadas no cambian.`)) patch(s.id, { deleted_at: new Date().toISOString(), active: false }); }}>
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {err && <p role="alert" className="text-sm text-destructive">{err}</p>}

      {suggestions.length > 0 && (
        <section>
          <h2 className="text-[15px] font-medium">Sugerencias</h2>
          <p className="text-sm text-body">Toca una para revisarla y añadirla. Nada se crea sin tu confirmación.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button key={s.name} className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border px-3 text-sm font-medium hover:bg-hover-surface"
                onClick={() => setEditing({ draft: { ...s } })}>
                <Plus className="size-4" /> {s.name}
              </button>
            ))}
          </div>
        </section>
      )}
      <button className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border text-[15px] font-medium hover:bg-hover-surface"
        onClick={() => setEditing({ draft: blankDraft() })}>
        <Plus className="size-5" /> Crear servicio nuevo
      </button>
    </div>
  );
}
