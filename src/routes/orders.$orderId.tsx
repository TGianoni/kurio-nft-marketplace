import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2, Clock, ExternalLink, XCircle } from "lucide-react";
import { getOrderById } from "@/api/marketplace";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/orders/$orderId")({
  component: OrderConfirmationPage,
});

function OrderConfirmationPage() {
  const { orderId } = Route.useParams();

  const {
    data: order,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: ({ signal }) => getOrderById(orderId, signal),
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[820px] px-4 py-12 space-y-4">
        <div className="h-10 w-64 rounded kurio-shimmer" />
        <div className="h-56 w-full rounded-2xl kurio-shimmer" />
      </div>
    );
  }

  if (isError || !order) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-red-300">
          Pedido não localizado
        </h1>
        <p className="text-xs text-[#b5a794]">
          {error instanceof Error
            ? error.message
            : "Não foi possível carregar este pedido."}
        </p>
        <div className="flex justify-center gap-3">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full border border-[#332415] px-5 py-2 text-xs text-[#f7f3eb] cursor-pointer"
          >
            Tentar novamente
          </button>
          <Link
            to="/profile"
            className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold text-[#120c06]"
          >
            Ver meus pedidos
          </Link>
        </div>
      </div>
    );
  }

  const isConfirmed = order.status === "confirmed";
  const isRejected = order.status === "rejected";

  return (
    <div className="mx-auto max-w-[820px] px-4 sm:px-8 py-10 sm:py-14 space-y-8">
      <div className="rounded-3xl border border-[#332415] bg-[#1b130b] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#332415] pb-5">
          <div className="flex items-center gap-3">
            {isConfirmed && (
              <CheckCircle2 className="h-8 w-8 text-emerald-400 shrink-0" />
            )}
            {isRejected && (
              <XCircle className="h-8 w-8 text-red-400 shrink-0" />
            )}
            {!isConfirmed && !isRejected && (
              <Clock className="h-8 w-8 text-[#e0a83e] shrink-0 animate-pulse" />
            )}

            <div>
              <p className="text-xs text-[#e0a83e]">Pedido #{order.id}</p>
              <h1 className="text-xl sm:text-2xl font-bold uppercase text-[#f7f3eb]">
                {isConfirmed
                  ? "Aquisição Confirmada"
                  : isRejected
                    ? "Pagamento Recusado"
                    : "Aguardando Confirmação"}
              </h1>
            </div>
          </div>

          <span
            data-testid="order-status-badge"
            className={`w-fit rounded-full px-3.5 py-1 text-xs font-bold uppercase ${
              isConfirmed
                ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40"
                : isRejected
                  ? "bg-red-500/15 text-red-300 border border-red-500/40"
                  : "bg-[#e0a83e]/15 text-[#e0a83e] border border-[#e0a83e]/40"
            }`}
          >
            {order.status}
          </span>
        </div>

        {order.reason && (
          <p className="rounded-xl border border-red-500/40 bg-red-950/30 p-3 text-xs text-red-200">
            {order.reason}
          </p>
        )}

        {/* Metadados da transação */}
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div className="rounded-xl border border-[#332415] bg-[#120c06] p-3.5 space-y-1">
            <dt className="text-[#b5a794]">Hash da transação</dt>
            <dd className="truncate font-mono text-[#f7f3eb]">
              {order.txHash}
            </dd>
          </div>
          <div className="rounded-xl border border-[#332415] bg-[#120c06] p-3.5 space-y-1">
            <dt className="text-[#b5a794]">Carteira & Rede</dt>
            <dd className="truncate text-[#f7f3eb]">
              {order.network.toUpperCase()} • {order.walletAddress}
            </dd>
          </div>
        </dl>

        {/* Itens adquiridos */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase text-[#f7f3eb]">
            Itens do Pedido
          </h2>
          <ul className="space-y-2.5">
            {order.items.map((item) => (
              <li
                key={item.nftId}
                className="flex items-center justify-between gap-3 rounded-xl border border-[#332415] bg-[#120c06] p-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={item.imageUrl}
                    alt={item.title}
                    className="h-12 w-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="truncate">
                    <p className="truncate font-bold text-[#f7f3eb]">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-[#b5a794]">
                      Edição {item.edition} • {item.quantity} un.
                    </p>
                  </div>
                </div>
                <span className="font-bold text-[#e0a83e] shrink-0">
                  {formatEthLabel(item.unitPriceEth)}
                </span>
              </li>
            ))}
          </ul>
        </div>

        {/* Totais */}
        <dl className="space-y-2 border-t border-[#332415] pt-4 text-xs">
          <div className="flex justify-between text-[#b5a794]">
            <dt>Subtotal</dt>
            <dd className="text-[#f7f3eb]">
              {formatEthLabel(order.subtotalEth)}
            </dd>
          </div>
          {order.discountEth !== "0" && (
            <div className="flex justify-between text-emerald-400">
              <dt>Desconto</dt>
              <dd>- {formatEthLabel(order.discountEth)}</dd>
            </div>
          )}
          <div className="flex justify-between text-[#b5a794]">
            <dt>Taxa de rede</dt>
            <dd className="text-[#f7f3eb]">
              {formatEthLabel(order.networkFeeEth)}
            </dd>
          </div>
          <div className="flex justify-between border-t border-[#332415] pt-2.5 text-sm font-bold">
            <dt className="text-[#f7f3eb]">Total pago</dt>
            <dd className="text-[#e0a83e]">{formatEthLabel(order.totalEth)}</dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <a
            href={order.explorerUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs text-[#e0a83e] hover:underline"
          >
            <span>Ver no explorador</span>
            <ExternalLink className="h-3.5 w-3.5" />
          </a>

          <div className="flex items-center gap-3">
            <Link
              to="/profile"
              className="rounded-full border border-[#332415] px-5 py-2.5 text-xs font-semibold text-[#f7f3eb] hover:border-[#e0a83e]"
            >
              Ver meus pedidos
            </Link>
            <Link
              to="/mercado"
              className="rounded-full bg-[#e0a83e] px-5 py-2.5 text-xs font-bold text-[#120c06]"
            >
              Continuar explorando
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
