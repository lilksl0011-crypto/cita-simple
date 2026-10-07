import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type Workshop = Database["public"]["Tables"]["workshops"]["Row"];
export type Service = Database["public"]["Tables"]["services"]["Row"];
export type PriceType = Database["public"]["Enums"]["price_type"];
export type BookingMode = Database["public"]["Enums"]["booking_mode"];

/** Weekday convention matches Postgres ISO extract(isodow): 7 = domingo. Displayed Monday first. */
export const WEEKDAYS: { d: number; label: string }[] = [
  { d: 1, label: "Lunes" },
  { d: 2, label: "Martes" },
  { d: 3, label: "Miércoles" },
  { d: 4, label: "Jueves" },
  { d: 5, label: "Viernes" },
  { d: 6, label: "Sábado" },
  { d: 7, label: "Domingo" },
];

export const ONBOARDING_STEPS = ["Información", "Horario", "Capacidad", "Servicios", "Listo"] as const;

/** Loads (and on first visit creates) the signed-in user's own workshop. Ownership comes from the session. */
export const myWorkshopQuery = queryOptions({
  queryKey: ["my-workshop"],
  queryFn: async () => {
    const { error: bErr } = await supabase.rpc("bootstrap_workshop_account");
    if (bErr) throw bErr;
    const { data: u } = await supabase.auth.getUser();
    const uid = u.user!.id;
    const [{ data: roles }, { data: ws, error }] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", uid),
      supabase.from("workshops").select("*").eq("owner_id", uid).maybeSingle(),
    ]);
    if (error) throw error;
    return { isAdmin: (roles ?? []).some((r) => r.role === "admin"), workshop: ws as Workshop | null };
  },
});

export const hoursQuery = (wid: string) =>
  queryOptions({
    queryKey: ["hours", wid],
    queryFn: async () => {
      const { data, error } = await supabase.from("workshop_hours").select("weekday,opens,closes").eq("workshop_id", wid).order("opens");
      if (error) throw error;
      return data;
    },
  });

export const servicesQuery = (wid: string) =>
  queryOptions({
    queryKey: ["services", wid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("services").select("*").eq("workshop_id", wid).is("deleted_at", null).order("created_at");
      if (error) throw error;
      return data as Service[];
    },
  });

export type WorkshopStatus = "draft" | "incomplete" | "ready" | "inactive";
export function workshopStatus(w: Pick<Workshop, "active" | "onboarding_step" | "onboarding_completed_at">): WorkshopStatus {
  if (w.active) return "ready";
  if (w.onboarding_completed_at) return "inactive";
  if (w.onboarding_step === 0) return "draft";
  return "incomplete";
}
export const STATUS_LABEL: Record<WorkshopStatus, string> = {
  draft: "Borrador",
  incomplete: "Configuración incompleta",
  ready: "Listo para reservar",
  inactive: "Inactivo",
};

const eur = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export function formatPrice(type: PriceType, price: number | null): string {
  if (type === "quote" || price == null) return "Consultar precio";
  return type === "from" ? `Desde ${eur.format(price)}` : eur.format(price);
}

export function formatDuration(min: number): string {
  if (min <= 0) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} h${m ? ` ${m} min` : ""}` : `${m} min`;
}

export const hhmm = (t: string) => t.slice(0, 5);

export function friendlyDbError(e: unknown): string {
  const msg = e && typeof e === "object" && "message" in e ? String((e as { message: unknown }).message) : "";
  if (msg.startsWith("Faltan datos") || msg.startsWith("Horario no válido") || msg.startsWith("Hay tramos")) return msg;
  return "No se pudo guardar. Revisa tu conexión e inténtalo de nuevo.";
}
