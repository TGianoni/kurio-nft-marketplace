import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AlertTriangle, ArrowRight, Tag, Trash2 } from "lucide-react";
import { type FormEvent, useState } from "react";
import {
  removeCartItem,
  requestQuote,
  syncCartPrices,
  updateCartQuantity,
} from "@/api/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel, mulEthByInt } from "@/lib/eth";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [couponInput, setCouponInput] = useState("");
  const [couponError, setCouponError] = useState<string | null>(null);

  const {
    data: quote,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["quote"],
    queryFn: () => requestQuote(),
  });

  const invalidateCartAndQuote = async () => {
    await queryClient.invalidateQueries({ queryKey: ["cart"] });
    await queryClient.invalidateQueries({ queryKey: ["quote"] });
  };

  const updateQtyMutation = useMutation({
    mutationFn: ({ nftId, quantity }: { nftId: string; quantity: number }) =>
      updateCartQuantity(nftId, quantity),
    onSuccess: invalidateCartAndQuote,
  });

  const removeMutation = useMutation({
    mutationFn: (nftId: string) => removeCartItem(nftId),
    onSuccess: invalidateCartAndQuote,
  });

  const syncPricesMutation = useMutation({
    mutationFn: syncCartPrices,
    onSuccess: invalidateCartAndQuote,
  });

  const applyCouponMutation = useMutation({
    mutationFn: (code: string) => requestQuote({ couponCode: code }),
    onSuccess: async () => {
      setCouponError(null);
      setCouponInput("");
      await invalidateCartAndQuote();
    },
    onError: (err: unknown) => {
      setCouponError(err instanceof Error ? err.message : "Cupom inválido.");
    },
  });

  const clearCouponMutation = useMutation({
    mutationFn: () => requestQuote({ clearCoupon: true }),
    onSuccess: invalidateCartAndQuote,
  });

  function handleCouponSubmit(e: FormEvent) {
    e.preventDefault();
    if (!couponInput.trim()) return;
    applyCouponMutation.mutate(couponInput.trim());
  }

  function handleProceedToCheckout() {
    if (!isAuthenticated) {
      void navigate({
        to: "/login",
        search: { redirect: "/checkout" },
      });
      return;
    }
    void navigate({ to: "/checkout" });
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-12 space-y-4">
        <div className="h-8 w-48 rounded kurio-shimmer" />
        <div className="h-40 w-full rounded-2xl kurio-shimmer" />
      </div>
    );
  }

  if (isError || !quote) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center space-y-4">
        <p className="text-sm text-red-300">
          {error instanceof Error
            ? error.message
            : "Erro ao carregar seu carrinho."}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold text-[#120c06] cursor-pointer"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1100px] px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="flex items-center justify-between border-b border-[#332415] pb-4">
        <div>
          <p className="text-xs text-[#e0a83e]">Revisão de Aquisição</p>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#f7f3eb]">
            Seu Carrinho
          </h1>
        </div>
        <Link
          to="/mercado"
          className="text-xs text-[#b5a794] hover:text-[#e0a83e]"
        >
          Continuar explorando →
        </Link>
      </div>

      {quote.priceOrStockChanged && (
        <div
          role="alert"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-[#e0a83e] bg-[#1b130b] p-4 text-xs"
        >
          <div className="flex items-center gap-3 text-[#f7f3eb]">
            <AlertTriangle className="h-5 w-5 shrink-0 text-[#e0a83e]" />
            <span>
              O preço ou estoque de um ou mais itens mudou desde que foram
              adicionados.
            </span>
          </div>
          <button
            type="button"
            disabled={syncPricesMutation.isPending}
            onClick={() => syncPricesMutation.mutate()}
            className="w-fit rounded-full bg-[#e0a83e] px-4 py-2 font-bold text-[#120c06] cursor-pointer"
          >
            Atualizar valores
          </button>
        </div>
      )}

      {quote.items.length === 0 ? (
        <div className="rounded-2xl border border-[#332415] bg-[#1b130b] p-12 text-center space-y-4">
          <p className="text-base font-bold text-[#f7f3eb]">
            Seu carrinho está vazio
          </p>
          <p className="text-xs text-[#b5a794]">
            Explore o mercado da Kurio e adicione obras digitais para começar.
          </p>
          <Link
            to="/mercado"
            className="inline-flex rounded-full bg-[#e0a83e] px-6 py-2.5 text-xs font-bold uppercase text-[#120c06]"
          >
            Explorar Mercado
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Lista de itens */}
          <div className="lg:col-span-7 space-y-4">
            {quote.items.map((item) => {
              const lineTotal = mulEthByInt(item.unitPriceEth, item.quantity);
              return (
                <article
                  key={item.nftId}
                  className="flex items-center gap-4 rounded-2xl border border-[#332415] bg-[#1b130b] p-4"
                >
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-20 w-20 rounded-xl object-cover bg-[#24190e] shrink-0"
                  />

                  <div className="flex-1 min-w-0 space-y-1">
                    <Link
                      to="/nfts/$nftId"
                      params={{ nftId: item.nftId }}
                      className="block truncate text-sm font-bold text-[#f7f3eb] hover:text-[#e0a83e]"
                    >
                      {item.title}
                    </Link>
                    <p className="text-[11px] text-[#b5a794]">
                      Edição {item.edition} • Unitário:{" "}
                      {formatEthLabel(item.unitPriceEth)}
                    </p>
                    <p className="text-xs font-bold text-[#e0a83e]">
                      Subtotal: {formatEthLabel(lineTotal)}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        aria-label={`Diminuir quantidade de ${item.title}`}
                        disabled={updateQtyMutation.isPending}
                        onClick={() =>
                          updateQtyMutation.mutate({
                            nftId: item.nftId,
                            quantity: item.quantity - 1,
                          })
                        }
                        className="h-7 w-7 rounded-lg border border-[#332415] bg-[#120c06] text-xs font-bold cursor-pointer"
                      >
                        -
                      </button>
                      <span className="w-7 text-center text-xs font-bold">
                        {item.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Aumentar quantidade de ${item.title}`}
                        disabled={
                          updateQtyMutation.isPending ||
                          item.quantity >= item.availableStock
                        }
                        onClick={() =>
                          updateQtyMutation.mutate({
                            nftId: item.nftId,
                            quantity: item.quantity + 1,
                          })
                        }
                        className="h-7 w-7 rounded-lg border border-[#332415] bg-[#120c06] text-xs font-bold disabled:opacity-40 cursor-pointer"
                      >
                        +
                      </button>
                    </div>

                    <button
                      type="button"
                      aria-label={`Remover ${item.title}`}
                      onClick={() => removeMutation.mutate(item.nftId)}
                      className="inline-flex items-center gap-1 text-[11px] text-[#b5a794] hover:text-red-300 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      <span>Remover</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {/* Resumo financeiro e cupom */}
          <aside className="lg:col-span-5 rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-[#f7f3eb]">
              Resumo do Pedido
            </h2>

            {/* Cupom promocional */}
            <form onSubmit={handleCouponSubmit} className="space-y-2">
              <label
                htmlFor="coupon-input"
                className="block text-xs text-[#b5a794]"
              >
                Cupom promocional (ex.:{" "}
                <span className="text-[#e0a83e]">KURIO10</span>)
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#b5a794]" />
                  <input
                    id="coupon-input"
                    type="text"
                    placeholder="Código do cupom"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    className="w-full rounded-lg border border-[#332415] bg-[#120c06] pl-8 pr-3 py-2 text-xs text-[#f7f3eb]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={applyCouponMutation.isPending}
                  className="rounded-lg border border-[#e0a83e] px-4 py-2 text-xs font-bold text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06] cursor-pointer"
                >
                  Aplicar
                </button>
              </div>
              {couponError && (
                <p className="text-[11px] text-red-300">{couponError}</p>
              )}
              {quote.couponCode && (
                <div className="flex items-center justify-between rounded-lg bg-[#120c06] px-3 py-2 text-[11px] text-[#e0a83e]">
                  <span>{quote.couponMessage}</span>
                  <button
                    type="button"
                    onClick={() => clearCouponMutation.mutate()}
                    className="underline cursor-pointer"
                  >
                    Remover
                  </button>
                </div>
              )}
            </form>

            {/* Totais */}
            <dl className="space-y-2.5 border-t border-[#332415] pt-4 text-xs">
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
                <dt>Taxa estimada de rede</dt>
                <dd className="text-[#f7f3eb]">
                  {formatEthLabel(quote.networkFeeEth)}
                </dd>
              </div>
              <div className="flex justify-between border-t border-[#332415] pt-3 text-sm font-bold">
                <dt className="text-[#f7f3eb]">Total</dt>
                <dd className="text-[#e0a83e]">
                  {formatEthLabel(quote.totalEth)}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              disabled={quote.priceOrStockChanged}
              onClick={handleProceedToCheckout}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-[#e0a83e] px-6 py-3 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-40 cursor-pointer"
            >
              <span>Continuar para pagamento</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </aside>
        </div>
      )}
    </div>
  );
}
