import { createFileRoute } from "@tanstack/react-router";

function AprendaPage() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-8 py-16">
      <h1 className="font-display text-4xl uppercase">Aprenda</h1>
    </section>
  );
}

export const Route = createFileRoute("/aprenda")({
  component: AprendaPage,
});
