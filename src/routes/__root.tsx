import { createRootRoute, Link, Outlet } from "@tanstack/react-router";
import { AppLayout } from "@/components/AppLayout";
import { AuthProvider } from "@/features/auth/auth-context";

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: RootErrorComponent,
  notFoundComponent: RootNotFoundComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <AppLayout>
        <Outlet />
      </AppLayout>
    </AuthProvider>
  );
}

function RootErrorComponent({ error }: { error: unknown }) {
  const message =
    error instanceof Error
      ? error.message
      : "Ocorreu um erro inesperado na tela.";

  return (
    <AuthProvider>
      <AppLayout>
        <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-[#e0a83e]">
            Falha ao carregar a página
          </h1>
          <p className="mt-3 text-sm text-[#b5a794]">{message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              to="/"
              search={{
                category: "all",
                edition: "all",
                sort: "featured",
                page: 1,
              }}
              className="rounded-full bg-[#e0a83e] px-5 py-2.5 text-xs font-semibold text-[#120c06]"
            >
              Voltar para o Início
            </Link>
          </div>
        </div>
      </AppLayout>
    </AuthProvider>
  );
}

function RootNotFoundComponent() {
  return (
    <AuthProvider>
      <AppLayout>
        <div className="mx-auto max-w-[720px] px-4 py-16 text-center">
          <h1 className="text-xl font-bold text-[#e0a83e]">
            Página não encontrada
          </h1>
          <p className="mt-3 text-sm text-[#b5a794]">
            A rota solicitada não existe neste marketplace.
          </p>
          <div className="mt-6 flex justify-center">
            <Link
              to="/"
              search={{
                category: "all",
                edition: "all",
                sort: "featured",
                page: 1,
              }}
              className="rounded-full bg-[#e0a83e] px-5 py-2.5 text-xs font-semibold text-[#120c06]"
            >
              Ir para o Início
            </Link>
          </div>
        </div>
      </AppLayout>
    </AuthProvider>
  );
}
