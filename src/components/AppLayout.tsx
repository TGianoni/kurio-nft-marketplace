import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import {
  LogIn,
  LogOut,
  Menu,
  Search,
  ShoppingCart,
  User,
  Wallet,
  X,
} from "lucide-react";
import { type ReactNode, useState } from "react";
import { getCart } from "@/api/marketplace";
import { useAuth } from "@/features/auth/auth-context";

export function AppLayout({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scopeNotice, setScopeNotice] = useState<string | null>(null);

  const { data: cartData } = useQuery({
    queryKey: ["cart"],
    queryFn: getCart,
  });

  const totalCartItems =
    cartData?.items.reduce((acc, item) => acc + item.quantity, 0) ?? 0;

  async function handleLogout() {
    await logout();
    setMobileMenuOpen(false);

    void navigate({
      to: "/",
      search: {
        category: "all",
        edition: "all",
        sort: "featured",
        page: 1,
      },
    });
  }

  function handleScopeLink(sectionName: string) {
    setMobileMenuOpen(false);
    setScopeNotice(
      `A seção "${sectionName}" é apenas institucional e não faz parte do fluxo principal desta entrega.`,
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#120c06] text-[#f7f3eb]">
      <header className="sticky top-0 z-40 border-b border-[#332415]/80 bg-[#120c06]/95 backdrop-blur">
        <div className="mx-auto flex h-20 max-w-[1280px] items-center justify-between px-4 sm:px-8">
          {/* Logo KURIO */}
          <Link
            to="/"
            search={{
              category: "all",
              edition: "all",
              sort: "featured",
              page: 1,
            }}
            onClick={() => setScopeNotice(null)}
            className="text-lg sm:text-xl font-bold tracking-[0.38em] text-[#f7f3eb] hover:text-[#e0a83e] transition-colors"
          >
            KURIO
          </Link>

          {/* Navegação Desktop */}
          <nav
            aria-label="Navegação principal"
            className="hidden lg:flex items-center gap-8 text-sm"
          >
            <Link
              to="/"
              search={{
                category: "all",
                edition: "all",
                sort: "featured",
                page: 1,
              }}
              onClick={() => setScopeNotice(null)}
              className={`py-1.5 transition-colors ${
                pathname === "/"
                  ? "border-b-2 border-[#e0a83e] font-semibold text-[#e0a83e]"
                  : "text-[#f7f3eb]/85 hover:text-[#e0a83e]"
              }`}
            >
              Início
            </Link>
            <Link
              to="/mercado"
              onClick={() => setScopeNotice(null)}
              className={`py-1.5 transition-colors ${
                pathname === "/mercado"
                  ? "border-b-2 border-[#e0a83e] font-semibold text-[#e0a83e]"
                  : "text-[#f7f3eb]/85 hover:text-[#e0a83e]"
              }`}
            >
              Mercado
            </Link>
            <button
              type="button"
              onClick={() => handleScopeLink("Criadores")}
              className="py-1.5 text-[#f7f3eb]/70 hover:text-[#e0a83e] transition-colors cursor-pointer"
            >
              Criadores
            </button>
            <button
              type="button"
              onClick={() => handleScopeLink("Aprenda")}
              className="py-1.5 text-[#f7f3eb]/70 hover:text-[#e0a83e] transition-colors cursor-pointer"
            >
              Aprenda
            </button>
          </nav>

          {/* Ações à direita */}
          <div className="flex items-center gap-3 sm:gap-4">
            <a
              href="/#catalogo"
              aria-label="Buscar no catálogo"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#f7f3eb]/85 hover:bg-[#24190e] hover:text-[#e0a83e] transition-colors"
            >
              <Search className="h-5 w-5" />
            </a>

            <Link
              to="/cart"
              aria-label={`Carrinho com ${totalCartItems} itens`}
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#f7f3eb]/85 hover:bg-[#24190e] hover:text-[#e0a83e] transition-colors"
            >
              <ShoppingCart className="h-5 w-5" />
              {totalCartItems > 0 && (
                <span
                  data-testid="cart-badge"
                  className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#e0a83e] px-1 text-[11px] font-bold text-[#120c06]"
                >
                  {totalCartItems}
                </span>
              )}
            </Link>

            {isAuthenticated && user ? (
              <div className="hidden lg:flex items-center gap-2">
                <Link
                  to="/wallets"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#332415] bg-[#1b130b] px-3.5 py-2 text-xs font-medium text-[#f7f3eb] hover:border-[#e0a83e] transition-colors"
                >
                  <Wallet className="h-3.5 w-3.5 text-[#e0a83e]" />
                  <span>Carteiras</span>
                </Link>
                <Link
                  to="/profile"
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#e0a83e]/70 bg-[#1b130b] px-3.5 py-2 text-xs font-medium text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06] transition-colors"
                >
                  <User className="h-3.5 w-3.5" />
                  <span>{user.name.split(" ")[0]}</span>
                </Link>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  aria-label="Sair da conta"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#332415] text-[#b5a794] hover:border-red-400 hover:text-red-300 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <Link
                to="/login"
                search={{
                  redirect:
                    pathname === "/login" || pathname === "/register"
                      ? "/"
                      : pathname,
                }}
                className="hidden sm:inline-flex items-center gap-2 rounded-full border border-[#e0a83e] px-5 py-2 text-xs font-semibold text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06] transition-colors"
              >
                <LogIn className="h-3.5 w-3.5" />
                <span>Entrar</span>
              </Link>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
              aria-expanded={mobileMenuOpen}
              className="inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-full border border-[#332415] text-[#f7f3eb]"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Menu Mobile */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-[#332415] bg-[#1b130b] px-4 py-4 space-y-3">
            <div className="flex flex-col gap-2 text-sm">
              <Link
                to="/"
                search={{
                  category: "all",
                  edition: "all",
                  sort: "featured",
                  page: 1,
                }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  setScopeNotice(null);
                }}
                className="rounded-lg px-3 py-2 hover:bg-[#24190e] text-[#f7f3eb]"
              >
                Início
              </Link>
              <a
                href="/#catalogo"
                onClick={() => {
                  setMobileMenuOpen(false);
                  setScopeNotice(null);
                }}
                className="rounded-lg px-3 py-2 hover:bg-[#24190e] text-[#f7f3eb]"
              >
                Mercado
              </a>
              <button
                type="button"
                onClick={() => handleScopeLink("Criadores")}
                className="rounded-lg px-3 py-2 text-left hover:bg-[#24190e] text-[#b5a794]"
              >
                Criadores
              </button>
              <button
                type="button"
                onClick={() => handleScopeLink("Aprenda")}
                className="rounded-lg px-3 py-2 text-left hover:bg-[#24190e] text-[#b5a794]"
              >
                Aprenda
              </button>
            </div>

            <div className="border-t border-[#332415] pt-3 flex flex-col gap-2">
              {isAuthenticated && user ? (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg bg-[#24190e] px-3 py-2.5 text-sm font-medium text-[#e0a83e]"
                  >
                    Perfil ({user.name})
                  </Link>
                  <Link
                    to="/wallets"
                    onClick={() => setMobileMenuOpen(false)}
                    className="rounded-lg bg-[#24190e] px-3 py-2.5 text-sm font-medium text-[#f7f3eb]"
                  >
                    Carteiras
                  </Link>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    className="rounded-lg border border-red-500/40 px-3 py-2.5 text-left text-sm text-red-300"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <Link
                  to="/login"
                  search={{ redirect: "/" }}
                  onClick={() => setMobileMenuOpen(false)}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e0a83e] px-4 py-2.5 text-sm font-semibold text-[#120c06]"
                >
                  <LogIn className="h-4 w-4" />
                  <span>Entrar</span>
                </Link>
              )}
            </div>
          </div>
        )}
      </header>

      {scopeNotice && (
        <div
          role="status"
          className="border-b border-[#e0a83e]/30 bg-[#1b130b] px-4 py-2.5 text-xs text-[#e0a83e]"
        >
          <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4">
            <span>{scopeNotice}</span>
            <button
              type="button"
              onClick={() => setScopeNotice(null)}
              className="underline hover:text-[#f7f3eb] cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      <main className="flex-1">{children}</main>

      <footer className="mt-16 border-t border-[#332415] bg-[#1b130b]/60 py-8 text-xs text-[#b5a794]">
        <div className="mx-auto flex max-w-[1280px] flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-8">
          <span className="tracking-[0.3em] font-semibold text-[#f7f3eb]">
            KURIO
          </span>
          <span>
            Marketplace de Arte Digital & Colecionáveis • Ambiente Simulado
            (ETH)
          </span>
        </div>
      </footer>
    </div>
  );
}
