import { createFileRoute } from "@tanstack/react-router";

function EntrarPage() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-8 py-16">
      <h1 className="font-display text-4xl uppercase">Entrar</h1>
    </section>
  );
}

export const Route = createFileRoute("/entrar")({
  component: EntrarPage,
});
