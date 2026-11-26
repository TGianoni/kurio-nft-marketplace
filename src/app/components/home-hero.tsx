import { Link } from "@tanstack/react-router";

import { Button } from "@/components/ui/button";

export default function HomeHero() {
  return (
    <section className="mx-auto grid w-full max-w-[1200px] items-center gap-12 px-8 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:py-20">
      <div className="flex max-w-[600px] flex-col">
        <p className="mb-4 text-sm font-medium text-primary">
          Bem-vindo à Kurio
        </p>
        <h1 className="font-display w-full max-w-[600px] text-[56px] leading-[0.95] font-normal tracking-wide text-foreground uppercase">
          Seja dono do futuro
          <br />
          da arte digital
        </h1>
        <p className="mt-6 max-w-[460px] text-sm leading-6 text-muted-foreground">
          Descubra NFTs selecionados de artistas emergentes e consagrados.
          Colecione arte digital e torne-se uma parte da cultura da internet.
        </p>
        <Button
          nativeButton={false}
          render={<Link to="/mercado" />}
          className="mt-8 h-11 w-fit rounded-full px-8 text-sm font-semibold tracking-wide uppercase"
        >
          Explorar
        </Button>
        <div className="mt-6 flex gap-2 justify-end">
          <span className="size-2 rounded-full bg-primary" />
          <span className="size-2 rounded-full bg-foreground/25" />
          <span className="size-2 rounded-full bg-foreground/25" />
        </div>
      </div>

      <div className="relative">
        <img
          src="/hero-ape.jpg"
          alt="Retrato de um colecionável digital da Kurio"
          className="aspect-square w-full rounded-[28px] object-cover"
        />
      </div>
    </section>
  );
}
