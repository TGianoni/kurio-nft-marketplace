import { createFileRoute } from "@tanstack/react-router";

function CriadoresPage() {
  return (
    <section className="mx-auto w-full max-w-[1200px] px-8 py-16">
      <h1 className="font-display text-4xl uppercase">Criadores</h1>
    </section>
  );
}

export const Route = createFileRoute("/criadores")({
  component: CriadoresPage,
});
