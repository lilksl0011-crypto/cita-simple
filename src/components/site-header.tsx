import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-background/90 backdrop-blur">
      <div className="container-app flex h-[60px] items-center justify-between">
        <Link to="/" className="flex min-h-12 items-center gap-2 text-base font-semibold tracking-tight text-foreground" aria-label="CitaMotor, inicio">
          <span aria-hidden className="grid size-[26px] place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground shadow-cta">C</span>
          CitaMotor
        </Link>
        <Link
          to="/auth"
          className="rounded-xl border border-border bg-background px-3.5 py-2 text-sm font-medium text-foreground shadow-soft transition-colors duration-150 hover:bg-hover-surface"
        >
          Para talleres
        </Link>
      </div>
    </header>
  );
}
