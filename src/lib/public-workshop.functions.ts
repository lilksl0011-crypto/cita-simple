import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

/** Public read of an active workshop. Uses the publishable key; RLS only exposes active workshops/services. */
export const getPublicWorkshop = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(80).regex(/^[a-z0-9-]+$/) }).parse(d))
  .handler(async ({ data }) => {
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"]!;
    const sb = createClient<Database>(process.env["SUPABASE_URL"]!, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const h = new Headers(init?.headers);
          if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
          h.set("apikey", key);
          return fetch(input, { ...init, headers: h });
        },
      },
    });
    const { data: w, error } = await sb
      .from("workshops")
      .select("id,slug,name,description,phone,email,address,city,postal_code,region,is_demo")
      .eq("slug", data.slug).eq("active", true).maybeSingle();
    if (error) throw new Error("No se pudo cargar el taller");
    if (!w) return null;
    const [{ data: services }, { data: hours }] = await Promise.all([
      sb.from("services").select("id,name,category,description,price_type,price_from,duration_minutes,booking_mode").eq("workshop_id", w.id).order("created_at"),
      sb.from("workshop_hours").select("weekday,opens,closes").eq("workshop_id", w.id).order("opens"),
    ]);
    const { id: _id, ...pub } = w;
    return { workshop: pub, services: services ?? [], hours: hours ?? [] };
  });
