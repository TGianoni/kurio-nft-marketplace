import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  Heart,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { useState } from "react";
import {
  addFavorite,
  addToCart,
  getFavorites,
  getNftById,
  removeFavorite,
  type FavoritesCacheData,
} from "@/api/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/nfts/$nftId")({
  component: NftDetailPage,
});

function NftDetailPage() {
  const { nftId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [quantity, setQuantity] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  const {
    data: nft,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["nft", nftId],
    queryFn: ({ signal }) => getNftById(nftId, signal),
  });

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  const isFav = Boolean(nft && favoritesData?.ids.includes(nft.id));

  const addCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      setFeedback(`${vars.quantity} unidade(s) adicionada(s) ao carrinho.`);
    },
    onError: (err: unknown) => {
      setFeedback(
        err instanceof Error
          ? err.message
          : "Não foi possível adicionar ao carrinho.",
      );
    },
  });

  const buyNowMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      void navigate({ to: "/cart" });
    },
    onError: (err: unknown) => {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao preparar compra.",
      );
    },
  });

  const favoriteMutation = useMutation<
    { ids: string[] } | undefined,
    unknown,
    void,
    { previousFavorites: FavoritesCacheData | undefined }
  >({
    mutationFn: async () => {
      if (!nft) return;
      return isFav ? removeFavorite(nft.id) : addFavorite(nft.id);
    },
    onMutate: async () => {
      if (!nft) return { previousFavorites: undefined };

      setFeedback(null);
      await queryClient.cancelQueries({ queryKey: ["favorites"] });

      const previousFavorites = queryClient.getQueryData<FavoritesCacheData>([
        "favorites",
      ]);

      queryClient.setQueryData<FavoritesCacheData>(["favorites"], (old) => {
        const currentIds = old?.ids ?? [];
        const currentItems = old?.items ?? [];

        if (isFav) {
          return {
            ids: currentIds.filter((id) => id !== nft.id),
            items: currentItems.filter((item) => item.id !== nft.id),
          };
        }

        const nextIds = currentIds.includes(nft.id)
          ? currentIds
          : [...currentIds, nft.id];
        const hasItem = currentItems.some((item) => item.id === nft.id);

        return {
          ids: nextIds,
          items: hasItem ? currentItems : [nft, ...currentItems],
        };
      });

      return { previousFavorites };
    },
    onError: (err, _variables, context) => {
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(["favorites"], context.previousFavorites);
      }
      setFeedback(
        err instanceof Error
          ? err.message
          : "Não foi possível atualizar os favoritos.",
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-12 grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div className="aspect-square w-full rounded-3xl kurio-shimmer" />
        <div className="space-y-4">
          <div className="h-6 w-1/3 rounded kurio-shimmer" />
          <div className="h-10 w-3/4 rounded kurio-shimmer" />
          <div className="h-24 w-full rounded kurio-shimmer" />
        </div>
      </div>
    );
  }

  if (isError || !nft) {
    return (
      <div className="mx-auto max-w-[720px] px-4 py-16 text-center space-y-4">
        <h1 className="text-xl font-bold text-[#e0a83e]">NFT não encontrado</h1>
        <p className="text-xs text-[#b5a794]">
          {error instanceof Error
            ? error.message
            : "Este item não está disponível no momento."}
        </p>
        <div className="flex justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => void refetch()}
            className="rounded-full border border-[#332415] px-5 py-2 text-xs text-[#f7f3eb] cursor-pointer"
          >
            Tentar novamente
          </button>
          <Link
            to="/mercado"
            className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold text-[#120c06]"
          >
            Voltar ao Mercado
          </Link>
        </div>
      </div>
    );
  }

  const maxAllowed = Math.max(1, Math.min(nft.availableStock, nft.maxPerOrder));
  const soldOut = nft.availableStock <= 0;

  return (
    <div className="mx-auto max-w-[1200px] px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <Link
        to="/mercado"
        className="inline-flex items-center gap-2 text-xs text-[#b5a794] hover:text-[#e0a83e]"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Voltar ao Mercado</span>
      </Link>

      {feedback && (
        <div
          role="status"
          className="flex items-center justify-between rounded-xl border border-[#e0a83e]/40 bg-[#1b130b] px-4 py-3 text-xs text-[#f7f3eb]"
        >
          <span>{feedback}</span>
          <Link to="/cart" className="font-bold text-[#e0a83e] underline">
            Ver carrinho →
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
        {/* Imagem principal */}
        <div className="lg:col-span-6 rounded-3xl border border-[#332415] bg-[#1b130b] p-4">
          <img
            src={nft.imageUrl}
            alt={nft.title}
            className="aspect-square w-full rounded-2xl object-cover bg-[#24190e]"
          />
        </div>

        {/* Informações e compra */}
        <div className="lg:col-span-6 space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <p className="text-xs font-medium text-[#e0a83e]">
                {nft.collectionName}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-[#f7f3eb]">
                {nft.title}
              </h1>
              <p className="text-xs text-[#b5a794]">
                Criado por{" "}
                <span className="text-[#f7f3eb]">{nft.creatorName}</span> •
                Edição <span className="text-[#f7f3eb]">{nft.edition}</span>
              </p>
            </div>

            <button
              type="button"
              aria-label={
                isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"
              }
              aria-pressed={isFav}
              onClick={() => favoriteMutation.mutate()}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#332415] bg-[#1b130b] text-[#b5a794] hover:border-[#e0a83e] hover:text-[#e0a83e] cursor-pointer"
            >
              <Heart
                className={`h-5 w-5 ${isFav ? "fill-[#e0a83e] text-[#e0a83e]" : ""}`}
              />
            </button>
          </div>

          <p className="text-xs sm:text-sm leading-relaxed text-[#b5a794]">
            {nft.description}
          </p>

          {/* Card de preço e ação */}
          <div className="rounded-2xl border border-[#332415] bg-[#1b130b] p-5 space-y-5">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="block text-[11px] uppercase tracking-wider text-[#b5a794]">
                  Preço atual
                </span>
                <span className="text-2xl sm:text-3xl font-bold text-[#e0a83e]">
                  {formatEthLabel(nft.priceEth)}
                </span>
              </div>
              <span className="rounded-full border border-[#332415] bg-[#120c06] px-3 py-1 text-xs text-[#b5a794]">
                {soldOut ? "Esgotado" : `${nft.availableStock} disponível(is)`}
              </span>
            </div>

            {!soldOut && (
              <div className="flex items-center justify-between border-t border-[#332415] pt-4">
                <span className="text-xs text-[#b5a794]">Quantidade</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    aria-label="Diminuir quantidade"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="h-8 w-8 rounded-lg border border-[#332415] bg-[#120c06] text-sm font-bold disabled:opacity-40 cursor-pointer"
                  >
                    -
                  </button>
                  <span className="w-8 text-center text-xs font-bold">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    aria-label="Aumentar quantidade"
                    disabled={quantity >= maxAllowed}
                    onClick={() =>
                      setQuantity((q) => Math.min(maxAllowed, q + 1))
                    }
                    className="h-8 w-8 rounded-lg border border-[#332415] bg-[#120c06] text-sm font-bold disabled:opacity-40 cursor-pointer"
                  >
                    +
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                disabled={soldOut || buyNowMutation.isPending}
                onClick={() =>
                  buyNowMutation.mutate({ nftId: nft.id, quantity })
                }
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#e0a83e] px-5 py-3 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-40 cursor-pointer"
              >
                <Sparkles className="h-4 w-4" />
                <span>{soldOut ? "Esgotado" : "Comprar agora"}</span>
              </button>

              <button
                type="button"
                disabled={soldOut || addCartMutation.isPending}
                onClick={() =>
                  addCartMutation.mutate({ nftId: nft.id, quantity })
                }
                className="inline-flex items-center justify-center gap-2 rounded-full border border-[#e0a83e] px-5 py-3 text-xs font-bold uppercase text-[#e0a83e] hover:bg-[#e0a83e]/10 disabled:opacity-40 cursor-pointer"
              >
                <ShoppingBag className="h-4 w-4" />
                <span>Adicionar ao carrinho</span>
              </button>
            </div>
          </div>

          {/* Atributos / Metadados */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[#f7f3eb]">
              Atributos da Obra
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {nft.traits.map((attr) => (
                <div
                  key={`${attr.label}-${attr.value}`}
                  className="rounded-xl border border-[#332415] bg-[#1b130b]/80 p-3 space-y-1"
                >
                  <span className="block text-[10px] uppercase text-[#e0a83e]">
                    {attr.label}
                  </span>
                  <span className="block text-xs font-semibold text-[#f7f3eb]">
                    {attr.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-[#b5a794]">
            <ShieldCheck className="h-4 w-4 text-[#e0a83e]" />
            <span>
              Contrato auditado • Transferência registrada on-chain na rede
              selecionada
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
