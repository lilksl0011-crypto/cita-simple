import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-header";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Acceso talleres — CitaMotor" },
      { name: "description", content: "Accede al panel de tu taller en CitaMotor." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Acceso talleres — CitaMotor" },
      { property: "og:description", content: "Menos llamadas. Menos citas perdidas. Más control." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="container-app max-w-md py-12">
        <h1 className="text-3xl font-bold">Menos llamadas. Más control.</h1>
        <p className="mt-2 text-muted-foreground">El acceso para talleres se activa en la siguiente fase.</p>
        <Link to="/" className="mt-6 inline-block text-sm font-medium text-primary">Volver al inicio</Link>
      </main>
    </div>
  );
}
