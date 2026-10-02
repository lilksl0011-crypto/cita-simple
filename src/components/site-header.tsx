import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-background">
      <div className="container-app flex h-[60px] items-center justify-between">
        <Link to="/" className="flex min-h-12 items-center gap-2 text-base font-medium text-foreground" aria-label="CitaMotor, inicio">
          <span aria-hidden className="grid size-[26px] place-items-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">C</span>
          CitaMotor
        </Link>
        <Link
          to="/auth"
          className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors duration-150 hover:bg-hover-surface"
        >
          Soy un taller
        </Link>
      </div>
    </header>
  );
}
