import { Wrench, Disc3, Droplet, ClipboardCheck, BatteryCharging, OctagonAlert, BadgeCheck, Stethoscope, type LucideIcon } from "lucide-react";

/** Controlled service categories. Shared by UI and (later) AI classification. */
export const SERVICE_CATEGORIES = [
  "tyres",
  "oil_change",
  "inspection",
  "battery",
  "brakes",
  "itv",
  "diagnosis",
  "other",
] as const;
export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export const CATEGORY_META: Record<ServiceCategory, { label: string; icon: LucideIcon }> = {
  tyres: { label: "Neumáticos", icon: Disc3 },
  oil_change: { label: "Cambio de aceite", icon: Droplet },
  inspection: { label: "Revisión", icon: ClipboardCheck },
  battery: { label: "Batería", icon: BatteryCharging },
  brakes: { label: "Frenos", icon: OctagonAlert },
  itv: { label: "ITV", icon: BadgeCheck },
  diagnosis: { label: "Diagnóstico", icon: Stethoscope },
  other: { label: "Otro", icon: Wrench },
};

export function isCategory(v: unknown): v is ServiceCategory {
  return typeof v === "string" && (SERVICE_CATEGORIES as readonly string[]).includes(v);
}
