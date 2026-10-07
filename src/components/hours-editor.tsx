import { useState } from "react";
import { Plus, Trash2, Copy } from "lucide-react";
import { WEEKDAYS } from "@/lib/workshop";

export type Interval = { opens: string; closes: string };
export type WeekHours = Record<number, Interval[]>;

export function emptyWeek(): WeekHours {
  return { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
}

/** Returns an error message per day (or null). */
export function validateWeek(w: WeekHours): Record<number, string | null> {
  const out: Record<number, string | null> = {};
  for (const { d } of WEEKDAYS) {
    const list = w[d] ?? [];
    let err: string | null = null;
    for (const i of list) {
      if (!i.opens || !i.closes) err = "Completa las dos horas.";
      else if (i.opens >= i.closes) err = "La hora de apertura debe ser anterior a la de cierre.";
    }
    if (!err) {
      const s = [...list].sort((a, b) => a.opens.localeCompare(b.opens));
      for (let k = 1; k < s.length; k++) if (s[k]!.opens < s[k - 1]!.closes) err = "Los tramos se solapan.";
    }
    out[d] = err;
  }
  return out;
}

const timeCls = "h-12 w-[7.5rem] rounded-[10px] border border-border bg-background px-3 text-base text-foreground outline-none focus:border-foreground";

export function HoursEditor({ value, onChange, showErrors }: { value: WeekHours; onChange: (w: WeekHours) => void; showErrors: boolean }) {
  const [copyFrom, setCopyFrom] = useState<number | null>(null);
  const [targets, setTargets] = useState<number[]>([]);
  const errors = validateWeek(value);

  const setDay = (d: number, list: Interval[]) => onChange({ ...value, [d]: list });

  return (
    <div className="divide-y divide-hairline rounded-xl border border-border">
      {WEEKDAYS.map(({ d, label }) => {
        const list = value[d] ?? [];
        const closed = list.length === 0;
        return (
          <div key={d} className="p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-base font-medium">{label}</p>
              <label className="flex min-h-12 items-center gap-2 text-sm text-body">
                <input
                  type="checkbox"
                  className="size-5 accent-primary"
                  checked={!closed}
                  onChange={(e) => setDay(d, e.target.checked ? [{ opens: "09:00", closes: "18:00" }] : [])}
                />
                {closed ? "Cerrado" : "Abierto"}
              </label>
            </div>
            {list.map((iv, idx) => (
              <div key={idx} className="mt-2 flex flex-wrap items-center gap-2">
                <input aria-label={`${label}, apertura tramo ${idx + 1}`} type="time" step={900} className={timeCls} value={iv.opens}
                  onChange={(e) => setDay(d, list.map((x, j) => (j === idx ? { ...x, opens: e.target.value } : x)))} />
                <span className="text-sm text-body">a</span>
                <input aria-label={`${label}, cierre tramo ${idx + 1}`} type="time" step={900} className={timeCls} value={iv.closes}
                  onChange={(e) => setDay(d, list.map((x, j) => (j === idx ? { ...x, closes: e.target.value } : x)))} />
                <button type="button" aria-label="Eliminar tramo" className="grid size-12 place-items-center rounded-lg text-muted-foreground hover:bg-hover-surface"
                  onClick={() => setDay(d, list.filter((_, j) => j !== idx))}>
                  <Trash2 className="size-5" />
                </button>
              </div>
            ))}
            {showErrors && errors[d] && <p role="alert" className="mt-2 text-sm text-destructive">{errors[d]}</p>}
            {!closed && (
              <div className="mt-2 flex flex-wrap gap-2">
                {list.length < 4 && (
                  <button type="button" className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-hover-surface"
                    onClick={() => setDay(d, [...list, { opens: list.at(-1)?.closes && list.at(-1)!.closes < "20:00" ? "15:00" : "16:00", closes: "19:00" }])}>
                    <Plus className="size-4" /> Añadir tramo
                  </button>
                )}
                <button type="button" className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-foreground hover:bg-hover-surface"
                  onClick={() => { setCopyFrom(copyFrom === d ? null : d); setTargets([]); }}>
                  <Copy className="size-4" /> Copiar a otros días
                </button>
              </div>
            )}
            {copyFrom === d && (
              <div className="mt-3 rounded-lg bg-band p-3">
                <p className="text-sm text-body">Copiar el horario del {label.toLowerCase()} a:</p>
                <div className="mt-2 flex flex-wrap gap-x-4">
                  {WEEKDAYS.filter((x) => x.d !== d).map((x) => (
                    <label key={x.d} className="flex min-h-11 items-center gap-2 text-sm">
                      <input type="checkbox" className="size-5 accent-primary" checked={targets.includes(x.d)}
                        onChange={(e) => setTargets(e.target.checked ? [...targets, x.d] : targets.filter((t) => t !== x.d))} />
                      {x.label}
                    </label>
                  ))}
                </div>
                <button type="button" disabled={!targets.length}
                  className="mt-2 min-h-11 rounded-lg border border-border bg-background px-4 text-sm font-medium disabled:opacity-50"
                  onClick={() => {
                    const next = { ...value };
                    for (const t of targets) next[t] = list.map((x) => ({ ...x }));
                    onChange(next); setCopyFrom(null);
                  }}>
                  Copiar
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
