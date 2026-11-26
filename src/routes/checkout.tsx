import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  RefreshCw,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { ApiClientError } from "@/api/client";
import {
  createOrder,
  getWallets,
  requestQuote,
  syncCartPrices,
} from "@/api/marketplace";
import type { NetworkId } from "@/contracts/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function generateIdempotencyKey() {
  return `idem-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function CheckoutPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [walletId, setWalletId] = useState<"primary" | "secondary">("primary");
  const [network, setNetwork] = useState<NetworkId>("ethereum");
  const [idempotencyKey, setIdempotencyKey] = useState(() =>
    generateIdempotencyKey(),
  );
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [priceConflict, setPriceConflict] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void navigate({
        to: "/login",
        search: { redirect: "/checkout" },
      });
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    if (user) {
      setBuyerName((prev) => prev || user.name);
      setBuyerEmail((prev) => prev || user.email);
    }
  }, [user]);

  const {
    data: quote,
    isLoading: quoteLoading,
    refetch: refetchQuote,
  } = useQuery({
    queryKey: ["quote"],
    queryFn: () => requestQuote(),
    enabled: isAuthenticated,
  });

  const canonicalQuoteToken =
    quote?.items
      .map((item) => `${item.nftId}:${item.quantity}:${item.unitPriceEth}`)
      .join("|") ?? "";

  useEffect(() => {
    if (!canonicalQuoteToken) return;
    setIdempotencyKey(generateIdempotencyKey());
  }, [canonicalQuoteToken]);

  const { data: walletsData } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    enabled: isAuthenticated,
  });

  const wallets = walletsData?.items ?? [];

  useEffect(() => {
    const selected = wallets.find((w) => w.id === walletId);
    if (selected) {
      setNetwork(selected.network);
    }
  }, [walletId, wallets]);

  const syncPricesMutation = useMutation({
    mutationFn: syncCartPrices,
    onSuccess: async () => {
      setPriceConflict(false);
      setCheckoutError(null);
      setIdempotencyKey(generateIdempotencyKey());
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await refetchQuote();
    },
  });

  const orderMutation = useMutation({
    mutationFn: () =>
      createOrder(
        {
          buyerName,
          buyerEmail,
          walletId,
          network,
          quoteToken: canonicalQuoteToken,
        },
        idempotencyKey,
      ),
    onSuccess: async (order) => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      await queryClient.invalidateQueries({ queryKey: ["quote"] });
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
      await queryClient.invalidateQueries({ queryKey: ["nfts"] });
      void navigate({
        to: "/orders/$orderId",
        params: { orderId: order.id },
      });
    },
    onError: (err: unknown) => {
      if (err instanceof ApiClientError && err.code === "PRICE_CHANGED") {
        setPriceConflict(true);
      }
      setCheckoutError(
        err instanceof Error ? err.message : "Falha ao processar pagamento.",
      );
    },
  });

  function handleConfirmOrder(e: FormEvent) {
    e.preventDefault();
    if (!quote || quote.items.length === 0 || orderMutation.isPending) return;
    setCheckoutError(null);
    orderMutation.mutate();
  }

  if (authLoading || quoteLoading) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 sm:px-8 py-12 space-y-4">
        <div className="h-8 w-56 rounded kurio-shimmer" />
        <div className="h-64 w-full rounded-2xl kurio-shimmer" />
      </div>
    );
  }

  if (!quote || quote.items.length === 0) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#f7f3eb]">
          Nenhum item para finalizar
        </h1>
        <p className="text-xs text-[#b5a794]">
          Adicione ao menos um NFT ao carrinho antes de prosseguir para o
          pagamento.
        </p>
        <Link
          to="/mercado"
          className="inline-flex rounded-full bg-[#e0a83e] px-6 py-2.5 text-xs font-bold uppercase text-[#120c06]"
        >
          Explorar Mercado
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1080px] px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="flex items-center justify-between border-b border-[#332415] pb-4">
        <div>
          <p className="text-xs text-[#e0a83e]">Liquidação On-Chain Simulada</p>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#f7f3eb]">
            Pagamento & Confirmação
          </h1>
        </div>
        <Link
          to="/cart"
          className="text-xs text-[#b5a794] hover:text-[#e0a83e]"
        >
          ← Voltar ao carrinho
        </Link>
      </div>

      {(checkoutError || quote.priceOrStockChanged || priceConflict) && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#e0a83e] bg-[#1b130b] p-4 text-xs"
        >
          <div className="flex items-center gap-3 text-[#f7f3eb]">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#e0a83e]" />
            <span>
              {checkoutError ??
                "Os valores do carrinho foram atualizados. Revise antes de confirmar."}
            </span>
          </div>
          {(quote.priceOrStockChanged || priceConflict) && (
            <button
              type="button"
              disabled={syncPricesMutation.isPending}
              onClick={() => syncPricesMutation.mutate()}
              className="inline-flex items-center gap-1.5 rounded-full bg-[#e0a83e] px-4 py-2 font-bold text-[#120c06] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Atualizar cotação</span>
            </button>
          )}
        </div>
      )}

      <form
        onSubmit={handleConfirmOrder}
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Coluna esquerda: Dados e Carteira */}
        <div className="lg:col-span-7 space-y-6">
          <section className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4">
            <h2 className="text-sm font-bold uppercase text-[#f7f3eb]">
              1. Dados do Colecionador
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="checkout-name"
                  className="block text-xs text-[#b5a794]"
                >
                  Nome completo
                </label>
                <input
                  id="checkout-name"
                  type="text"
                  required
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
                />
              </div>
              <div className="space-y-1.5">
                <label
                  htmlFor="checkout-email"
                  className="block text-xs text-[#b5a794]"
                >
                  E-mail para recibo
                </label>
                <input
                  id="checkout-email"
                  type="email"
                  required
                  value={buyerEmail}
                  onChange={(e) => setBuyerEmail(e.target.value)}
                  className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
                />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold uppercase text-[#f7f3eb]">
                2. Carteira & Rede de Liquidação
              </h2>
              <Link
                to="/wallets"
                className="text-[11px] text-[#e0a83e] hover:underline"
              >
                Gerenciar carteiras
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {wallets.map((wallet) => {
                const selected = wallet.id === walletId;
                return (
                  <button
                    key={wallet.id}
                    type="button"
                    onClick={() => setWalletId(wallet.id)}
                    className={`rounded-xl border p-4 text-left transition-colors cursor-pointer space-y-1.5 ${
                      selected
                        ? "border-[#e0a83e] bg-[#24190e]"
                        : "border-[#332415] bg-[#120c06] hover:border-[#b5a794]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#f7f3eb]">
                        <Wallet className="h-3.5 w-3.5 text-[#e0a83e]" />
                        {wallet.label}
                      </span>
                      {selected && (
                        <CheckCircle2 className="h-4 w-4 text-[#e0a83e]" />
                      )}
                    </div>
                    <p className="truncate text-[11px] text-[#b5a794]">
                      {wallet.address}
                    </p>
                    <p className="text-[11px] font-semibold text-[#e0a83e]">
                      Saldo: {formatEthLabel(wallet.balanceEth)}
                    </p>
                  </button>
                );
              })}
            </div>

            <div className="space-y-1.5 pt-2">
              <label
                htmlFor="checkout-network"
                className="block text-xs text-[#b5a794]"
              >
                Rede de destino
              </label>
              <select
                id="checkout-network"
                value={network}
                onChange={(e) => setNetwork(e.target.value as NetworkId)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2.5 text-xs text-[#f7f3eb]"
              >
                <option value="ethereum">Ethereum Mainnet (Simulada)</option>
                <option value="polygon">Polygon PoS (Simulada)</option>
                <option value="base">Base L2 (Simulada)</option>
              </select>
            </div>
          </section>
        </div>

        {/* Coluna direita: Resumo final */}
        <aside className="lg:col-span-5 rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-5">
          <h2 className="text-sm font-bold uppercase text-[#f7f3eb]">
            Resumo da Aquisição
          </h2>

          <ul className="space-y-3 border-b border-[#332415] pb-4">
            {quote.items.map((item) => (
              <li
                key={item.nftId}
                className="flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-10 w-10 rounded-lg object-cover shrink-0"
                  />
                  <div className="truncate">
                    <p className="truncate font-semibold text-[#f7f3eb]">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#b5a794]">
                      Qtd: {item.quantity}
                    </p>
                  </div>
                </div>
                <span className="font-semibold text-[#f7f3eb] shrink-0">
                  {formatEthLabel(item.unitPriceEth)}
                </span>
              </li>
            ))}
          </ul>

          <dl className="space-y-2 text-xs">
            <div className="flex justify-between text-[#b5a794]">
              <dt>Subtotal</dt>
              <dd className="text-[#f7f3eb]">
                {formatEthLabel(quote.subtotalEth)}
              </dd>
            </div>
            {quote.discountEth !== "0" && (
              <div className="flex justify-between text-emerald-400">
                <dt>Desconto ({quote.couponCode})</dt>
                <dd>- {formatEthLabel(quote.discountEth)}</dd>
              </div>
            )}
            <div className="flex justify-between text-[#b5a794]">
              <dt>Taxa de rede</dt>
              <dd className="text-[#f7f3eb]">
                {formatEthLabel(quote.networkFeeEth)}
              </dd>
            </div>
            <div className="flex justify-between border-t border-[#332415] pt-3 text-sm font-bold">
              <dt className="text-[#f7f3eb]">Total a pagar</dt>
              <dd className="text-[#e0a83e]">
                {formatEthLabel(quote.totalEth)}
              </dd>
            </div>
          </dl>

          <button
            type="submit"
            disabled={
              orderMutation.isPending ||
              quote.priceOrStockChanged ||
              priceConflict
            }
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#e0a83e] px-6 py-3.5 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-40 cursor-pointer"
          >
            <Lock className="h-4 w-4" />
            <span>
              {orderMutation.isPending
                ? "Assinando transação..."
                : "Confirmar pagamento"}
            </span>
          </button>

          <p className="flex items-center gap-2 text-[11px] text-[#b5a794]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#e0a83e]" />
            <span>
              Proteção contra cobrança duplicada ativa (Idempotency-Key).
            </span>
          </p>
        </aside>
      </form>
    </div>
  );
}
