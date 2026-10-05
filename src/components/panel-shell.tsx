import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

const navCls = "flex min-h-12 items-center border-b-[3px] border-transparent px-1 text-[15px] font-medium text-muted-foreground";
const activeCls = "!border-primary !text-foreground";

export function PanelShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b border-hairline bg-background">
        <div className="container-app flex h-[60px] items-center justify-between">
          <Link to="/" className="flex min-h-12 items-center gap-2 text-base font-medium text-foreground" aria-label="CitaMotor, inicio">
            <span aria-hidden className="grid size-[26px] place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">C</span>
            CitaMotor
          </Link>
          <button onClick={signOut} className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:bg-hover-surface">
            Cerrar sesión
          </button>
        </div>
        <nav aria-label="Panel" className="container-app flex gap-6">
          <Link to="/panel" activeOptions={{ exact: true }} className={navCls} activeProps={{ className: activeCls }}>Inicio</Link>
          <Link to="/panel/servicios" className={navCls} activeProps={{ className: activeCls }}>Servicios</Link>
          <Link to="/panel/onboarding" className={navCls} activeProps={{ className: activeCls }}>Configuración</Link>
        </nav>
      </header>
      <main className="container-app max-w-2xl py-6 pb-32">{children}</main>
    </div>
  );
}

export function StickyActions({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hairline bg-background py-3">
      <div className="container-app flex max-w-2xl gap-3">{children}</div>
    </div>
  );
}
