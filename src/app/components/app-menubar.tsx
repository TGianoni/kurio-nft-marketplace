"use client";

import { Link, useRouterState } from "@tanstack/react-router";
import { LogInIcon, SearchIcon, ShoppingCartIcon } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Menubar, MenubarMenu, MenubarTrigger } from "@/components/ui/menubar";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Início" },
  { to: "/mercado", label: "Mercado" },
  { to: "/criadores", label: "Criadores" },
  { to: "/aprenda", label: "Aprenda" },
] as const;

export default function AppMenubar() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-background/95 backdrop-blur-sm">
      <div className="mx-auto flex h-20 w-full max-w-[1200px] items-center justify-between px-8">
        <Link
          to="/"
          search={{
            category: "all",
            edition: "all",
            sort: "featured",
            page: 1,
          }}
          className="font-brand text-lg tracking-[0.28em] text-foreground uppercase"
        >
          Kurio
        </Link>

        <Menubar className="h-auto gap-7 border-0 bg-transparent p-0 shadow-none">
          {navItems.map((item) => {
            const isActive = pathname === item.to;

            return (
              <MenubarMenu key={item.to}>
                <MenubarTrigger
                  nativeButton={false}
                  render={
                    <Link
                      to={item.to}
                      className={cn(
                        "relative rounded-none bg-transparent px-0 py-2 text-sm font-medium text-muted-foreground shadow-none hover:bg-transparent hover:text-foreground data-popup-open:bg-transparent",
                        isActive && "text-primary",
                      )}
                    />
                  }
                >
                  {item.label}
                  {isActive ? (
                    <span className="absolute inset-x-0 -bottom-1 h-px bg-primary" />
                  ) : null}
                </MenubarTrigger>
              </MenubarMenu>
            );
          })}
        </Menubar>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-transparent hover:text-primary"
            aria-label="Buscar"
          >
            <SearchIcon className="size-5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="relative text-foreground hover:bg-transparent hover:text-primary"
            aria-label="Carrinho"
          >
            <ShoppingCartIcon className="size-5" />
            <Badge className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full border-0 bg-[#e36a1a] p-0" />
          </Button>

          <Button
            variant="outline"
            className="h-9 gap-2 rounded-full border-primary px-4 text-primary hover:bg-primary/10 hover:text-primary"
            nativeButton={false}
            render={<Link to="/entrar" />}
          >
            <LogInIcon className="size-4" />
            Entrar
          </Button>
        </div>
      </div>
    </header>
  );
}
