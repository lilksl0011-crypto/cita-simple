import { Link } from "@tanstack/react-router";

export function SiteHeader() {
  return (
    <header className="border-b bg-background/90 backdrop-blur sticky top-0 z-20">
      <div className="container-app flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold" aria-label="CitaMotor, inicio">
          <span aria-hidden className="grid size-7 place-items-center rounded-lg bg-primary text-primary-foreground text-sm">C</span>
          CitaMotor
        </Link>
        <Link to="/auth" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Soy un taller
        </Link>
      </div>
    </header>
  );
}
