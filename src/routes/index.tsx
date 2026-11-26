import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Heart,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { z } from "zod";
import {
  addFavorite,
  addToCart,
  getFavorites,
  getNfts,
  removeFavorite,
  type FavoritesCacheData,
} from "@/api/marketplace";
import HomeHero from "@/app/components/home-hero";
import type {
  NftCategory,
  NftEdition,
  NftSortOption,
} from "@/contracts/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel } from "@/lib/eth";

const indexSearchSchema = z.object({
  q: z.string().optional(),
  category: z
    .enum(["all", "Arte", "3D", "Fotografia", "Colecionáveis", "Música"])
    .optional()
    .default("all"),
  edition: z
    .enum(["all", "1/1", "Limitada", "Aberta"])
    .optional()
    .default("all"),
  minPrice: z.string().optional(),
  maxPrice: z.string().optional(),
  sort: z
    .enum(["featured", "price_asc", "price_desc", "newest"])
    .optional()
    .default("featured"),
  page: z.number().int().min(1).optional().default(1),
});

export const Route = createFileRoute("/")({
  validateSearch: (search) => indexSearchSchema.parse(search),
  component: HomePage,
});

const COLLECTION_FILTERS: Array<{
  label: string;
  category: NftCategory | "all";
  count: number;
}> = [
  { label: "Arte digital", category: "Arte", count: 31 },
  { label: "Fotografia", category: "Fotografia", count: 12 },
  { label: "Música", category: "Música", count: 65 },
  { label: "Arte 3D", category: "3D", count: 29 },
  { label: "Colecionáveis", category: "Colecionáveis", count: 23 },
  { label: "Todas", category: "all", count: 160 },
];

const NETWORK_COUNTS = [
  { label: "Ethereum", count: 119 },
  { label: "Polygon", count: 78 },
  { label: "Solana", count: 86 },
];

const JOURNAL_POSTS = [
  {
    id: "post-1",
    meta: "12 Nov 2026 • Guia",
    title: "Como funciona a propriedade de NFTs",
    excerpt:
      "Entenda como contratos inteligentes garantem autenticidade e histórico transparente.",
    image: "/src/assets/images/nft-neon-vessel.png",
  },
  {
    id: "post-2",
    meta: "08 Nov 2026 • Curadoria",
    title: "10 artistas digitais para acompanhar",
    excerpt:
      "Conheça criadores emergentes que estão redefinindo coleções visuais na web.",
    image: "/src/assets/images/nft-emerald-ape.png",
  },
  {
    id: "post-3",
    meta: "03 Nov 2026 • Mercado",
    title: "Raridade, atributos e proveniência",
    excerpt:
      "O que observar antes de adicionar uma edição limitada à sua carteira.",
    image: "/src/assets/images/nft-sage-nomad.png",
  },
  {
    id: "post-4",
    meta: "28 Out 2026 • Segurança",
    title: "Como proteger sua carteira digital",
    excerpt:
      "Boas práticas essenciais para gerenciar múltiplas redes e assinaturas com segurança.",
    image: "/src/assets/images/nft-pulse-beat.png",
  },
];

function HomePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const [searchInput, setSearchInput] = useState(search.q ?? "");
  const [minPriceInput, setMinPriceInput] = useState(search.minPrice ?? "");
  const [maxPriceInput, setMaxPriceInput] = useState(search.maxPrice ?? "");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  useEffect(() => {
    setSearchInput(search.q ?? "");
    setMinPriceInput(search.minPrice ?? "");
    setMaxPriceInput(search.maxPrice ?? "");
  }, [search.q, search.minPrice, search.maxPrice]);

  const {
    data: nftsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ["nfts", search],
    queryFn: ({ signal }) =>
      getNfts(
        {
          q: search.q,
          category: search.category,
          edition: search.edition,
          minPrice: search.minPrice,
          maxPrice: search.maxPrice,
          sort: search.sort as NftSortOption,
          page: search.page,
          pageSize: 6,
        },
        signal,
      ),
  });

  const catalogItems = nftsData?.items ?? [];

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  const favoriteIds = new Set(favoritesData?.ids ?? []);

  const addCartMutation = useMutation({
    mutationFn: addToCart,
    onSuccess: async (_res, vars) => {
      await queryClient.invalidateQueries({ queryKey: ["cart"] });
      setFeedbackMessage(`NFT adicionado ao carrinho (${vars.quantity} un.).`);
    },
    onError: (err: unknown) => {
      setFeedbackMessage(
        err instanceof Error
          ? err.message
          : "Não foi possível adicionar ao carrinho.",
      );
    },
  });

  const toggleFavoriteMutation = useMutation<
    { ids: string[] },
    unknown,
    string,
    { previousFavorites: FavoritesCacheData | undefined }
  >({
    mutationFn: async (nftId: string) => {
      if (favoriteIds.has(nftId)) {
        return removeFavorite(nftId);
      }
      return addFavorite(nftId);
    },
    onMutate: async (nftId: string) => {
      setFeedbackMessage(null);
      await queryClient.cancelQueries({ queryKey: ["favorites"] });

      const previousFavorites = queryClient.getQueryData<FavoritesCacheData>([
        "favorites",
      ]);

      const currentlyFavorited = favoriteIds.has(nftId);
      // Ajuste `catalogItems` para o array de NFTs já carregado no seu `src/routes/index.tsx` (ex.: `nftsData?.items ?? []`)
      const targetNft = catalogItems.find((item) => item.id === nftId);

      queryClient.setQueryData<FavoritesCacheData>(["favorites"], (old) => {
        const currentIds = old?.ids ?? [];
        const currentItems = old?.items ?? [];

        if (currentlyFavorited) {
          return {
            ids: currentIds.filter((id) => id !== nftId),
            items: currentItems.filter((item) => item.id !== nftId),
          };
        }

        const nextIds = currentIds.includes(nftId)
          ? currentIds
          : [...currentIds, nftId];
        const hasItem = currentItems.some((item) => item.id === nftId);
        const nextItems =
          !targetNft || hasItem ? currentItems : [targetNft, ...currentItems];

        return {
          ids: nextIds,
          items: nextItems,
        };
      });

      return { previousFavorites };
    },
    onError: (err: unknown, _nftId, context) => {
      if (context?.previousFavorites !== undefined) {
        queryClient.setQueryData(["favorites"], context.previousFavorites);
      }
      setFeedbackMessage(
        err instanceof Error
          ? err.message
          : "Entre na sua conta para favoritar NFTs.",
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: ["favorites"] });
    },
  });

  function updateFilters(patch: Partial<z.infer<typeof indexSearchSchema>>) {
    void navigate({
      to: "/",
      search: (prev) => ({
        ...prev,
        ...patch,
        page: patch.page ?? 1,
      }),
    });
  }

  function handleSearchSubmit(e: FormEvent) {
    e.preventDefault();
    updateFilters({ q: searchInput.trim() || undefined });
  }

  function handlePriceSubmit(e: FormEvent) {
    e.preventDefault();
    updateFilters({
      minPrice: minPriceInput.trim() || undefined,
      maxPrice: maxPriceInput.trim() || undefined,
    });
  }

  const featuredOffer =
    nftsData?.items.find((item) => item.featured) ?? nftsData?.items[0];

  return (
    <div className="w-full">
      {/* 1. HERO (seu componente preservado) */}
      <HomeHero />

      <div className="mx-auto max-w-[1200px] px-4 sm:px-8 space-y-20 pb-16">
        {feedbackMessage && (
          <div
            role="status"
            className="flex items-center justify-between rounded-xl border border-[#e0a83e]/40 bg-[#1b130b] px-4 py-3 text-xs text-[#f7f3eb]"
          >
            <span>{feedbackMessage}</span>
            <button
              type="button"
              onClick={() => setFeedbackMessage(null)}
              className="text-[#e0a83e] underline cursor-pointer"
            >
              Fechar
            </button>
          </div>
        )}

        {/* 2. CATÁLOGO + FILTROS LATERAIS */}
        <section id="catalogo" aria-label="Catálogo de NFTs" className="pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            {/* Sidebar esquerda */}
            <aside className="lg:col-span-3 space-y-7 rounded-2xl border border-[#332415] bg-[#1b130b]/70 p-5">
              <div>
                <h2 className="text-sm font-bold text-[#f7f3eb] mb-3">
                  Coleções
                </h2>
                <ul className="space-y-1.5 text-xs">
                  {COLLECTION_FILTERS.map((col) => {
                    const selected =
                      (search.category ?? "all") === col.category;
                    return (
                      <li key={col.label}>
                        <button
                          type="button"
                          onClick={() =>
                            updateFilters({ category: col.category })
                          }
                          className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                            selected
                              ? "bg-[#24190e] font-semibold text-[#e0a83e]"
                              : "text-[#b5a794] hover:bg-[#24190e]/60 hover:text-[#f7f3eb]"
                          }`}
                        >
                          <span>{col.label}</span>
                          <span className="text-[11px] opacity-75">
                            ({col.count})
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              <form
                onSubmit={handlePriceSubmit}
                className="space-y-3 border-t border-[#332415] pt-5"
              >
                <h2 className="text-sm font-bold text-[#f7f3eb]">
                  Faixa de preço
                </h2>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      htmlFor="min-price-input"
                      className="block text-[11px] text-[#b5a794] mb-1"
                    >
                      Mín (ETH)
                    </label>
                    <input
                      id="min-price-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="0.02"
                      value={minPriceInput}
                      onChange={(e) => setMinPriceInput(e.target.value)}
                      className="w-full rounded-lg border border-[#332415] bg-[#120c06] px-2.5 py-1.5 text-xs text-[#f7f3eb]"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="max-price-input"
                      className="block text-[11px] text-[#b5a794] mb-1"
                    >
                      Máx (ETH)
                    </label>
                    <input
                      id="max-price-input"
                      type="text"
                      inputMode="decimal"
                      placeholder="12.30"
                      value={maxPriceInput}
                      onChange={(e) => setMaxPriceInput(e.target.value)}
                      className="w-full rounded-lg border border-[#332415] bg-[#120c06] px-2.5 py-1.5 text-xs text-[#f7f3eb]"
                    />
                  </div>
                </div>
                <p className="text-[11px] text-[#b5a794]">
                  Preço: {search.minPrice || "0.02"} -{" "}
                  {search.maxPrice || "12.30"} ETH
                </p>
                <button
                  type="submit"
                  className="w-full rounded-lg bg-[#e0a83e] px-4 py-2 text-xs font-bold text-[#120c06] hover:bg-[#ebb64e] transition-colors cursor-pointer"
                >
                  Aplicar
                </button>
              </form>

              <div className="space-y-2 border-t border-[#332415] pt-5">
                <h2 className="text-sm font-bold text-[#f7f3eb] mb-2">Rede</h2>
                <ul className="space-y-1.5 text-xs text-[#b5a794]">
                  {NETWORK_COUNTS.map((net) => (
                    <li
                      key={net.label}
                      className="flex items-center justify-between px-1"
                    >
                      <span>{net.label}</span>
                      <span className="text-[11px]">({net.count})</span>
                    </li>
                  ))}
                </ul>
              </div>

              {featuredOffer && (
                <div className="rounded-xl border border-[#e0a83e]/30 bg-[#120c06] p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#e0a83e]">
                      NFT EM DESTAQUE
                    </span>
                    <Sparkles className="h-3.5 w-3.5 text-[#e0a83e]" />
                  </div>
                  <p className="text-[11px] font-semibold uppercase text-[#b5a794]">
                    OFERTA LIMITADA
                  </p>
                  <div className="space-y-2">
                    <img
                      src={featuredOffer.imageUrl}
                      alt={featuredOffer.title}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-[#f7f3eb]">
                        {featuredOffer.title}
                      </span>
                      <span className="font-bold text-[#e0a83e]">
                        {formatEthLabel(featuredOffer.priceEth)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </aside>

            {/* Grade principal direita */}
            <div className="lg:col-span-9 space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#332415] pb-4">
                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() =>
                      updateFilters({ sort: "featured", category: "all" })
                    }
                    className={`pb-1 transition-colors cursor-pointer ${
                      search.sort === "featured"
                        ? "border-b-2 border-[#e0a83e] font-bold text-[#e0a83e]"
                        : "text-[#b5a794] hover:text-[#f7f3eb]"
                    }`}
                  >
                    Todos NFTs
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFilters({ sort: "newest" })}
                    className={`pb-1 transition-colors cursor-pointer ${
                      search.sort === "newest"
                        ? "border-b-2 border-[#e0a83e] font-bold text-[#e0a83e]"
                        : "text-[#b5a794] hover:text-[#f7f3eb]"
                    }`}
                  >
                    Novos lançamentos
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFilters({ sort: "price_desc" })}
                    className={`pb-1 transition-colors cursor-pointer ${
                      search.sort === "price_desc"
                        ? "border-b-2 border-[#e0a83e] font-bold text-[#e0a83e]"
                        : "text-[#b5a794] hover:text-[#f7f3eb]"
                    }`}
                  >
                    Em alta
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <form
                    onSubmit={handleSearchSubmit}
                    className="relative flex-1 sm:w-48"
                  >
                    <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#b5a794]" />
                    <input
                      type="search"
                      aria-label="Buscar NFT por nome ou criador"
                      placeholder="Buscar NFT..."
                      value={searchInput}
                      onChange={(e) => {
                        setSearchInput(e.target.value);
                        updateFilters({
                          q: e.target.value.trim() || undefined,
                        });
                      }}
                      className="w-full rounded-lg border border-[#332415] bg-[#1b130b] pl-8 pr-3 py-1.5 text-xs text-[#f7f3eb] placeholder:text-[#b5a794]/60"
                    />
                  </form>

                  <label className="flex items-center gap-2 text-xs text-[#b5a794]">
                    <span>Ordenar por:</span>
                    <select
                      aria-label="Ordenar por"
                      value={search.sort}
                      onChange={(e) =>
                        updateFilters({ sort: e.target.value as NftSortOption })
                      }
                      className="rounded-lg border border-[#332415] bg-[#1b130b] px-2.5 py-1.5 text-xs text-[#f7f3eb]"
                    >
                      <option value="featured">Listados recentemente</option>
                      <option value="price_asc">Menor preço (ETH)</option>
                      <option value="price_desc">Maior preço (ETH)</option>
                      <option value="newest">Mais recentes</option>
                    </select>
                  </label>
                </div>
              </div>

              {/* Filtro de edição */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "1/1", "Limitada", "Aberta"] as const).map((ed) => {
                    const active = search.edition === ed;
                    return (
                      <button
                        key={ed}
                        type="button"
                        onClick={() =>
                          updateFilters({ edition: ed as NftEdition | "all" })
                        }
                        className={`rounded-full px-3 py-1 border text-[11px] transition-colors cursor-pointer ${
                          active
                            ? "border-[#e0a83e] bg-[#e0a83e]/15 text-[#e0a83e] font-semibold"
                            : "border-[#332415] text-[#b5a794] hover:border-[#b5a794]/50"
                        }`}
                      >
                        {ed === "all" ? "Todas edições" : `Edição ${ed}`}
                      </button>
                    );
                  })}
                </div>

                {(search.q ||
                  search.category !== "all" ||
                  search.edition !== "all" ||
                  search.minPrice ||
                  search.maxPrice) && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("");
                      setMinPriceInput("");
                      setMaxPriceInput("");
                      void navigate({
                        to: "/",
                        search: {
                          sort: "featured",
                          page: 1,
                          category: "all",
                          edition: "all",
                        },
                      });
                    }}
                    className="text-[11px] text-[#e0a83e] underline cursor-pointer"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {isLoading && (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {Array.from({ length: 6 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-[#332415] bg-[#1b130b] p-3 space-y-3"
                    >
                      <div className="aspect-square w-full rounded-xl kurio-shimmer" />
                      <div className="h-4 w-2/3 rounded kurio-shimmer" />
                      <div className="h-4 w-1/3 rounded kurio-shimmer" />
                    </div>
                  ))}
                </div>
              )}

              {isError && (
                <div
                  role="alert"
                  className="rounded-2xl border border-red-500/40 bg-[#1b130b] p-8 text-center space-y-4"
                >
                  <p className="text-sm font-semibold text-red-300">
                    {error instanceof Error
                      ? error.message
                      : "Não foi possível carregar os NFTs agora."}
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold text-[#120c06] cursor-pointer"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}

              {!isLoading &&
                !isError &&
                nftsData &&
                nftsData.items.length === 0 && (
                  <div className="rounded-2xl border border-[#332415] bg-[#1b130b] p-10 text-center space-y-4">
                    <p className="text-sm font-semibold text-[#f7f3eb]">
                      Nenhum NFT encontrado com os filtros atuais.
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        void navigate({
                          to: "/",
                          search: {
                            sort: "featured",
                            page: 1,
                            category: "all",
                            edition: "all",
                          },
                        })
                      }
                      className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold text-[#120c06] cursor-pointer"
                    >
                      Restaurar catálogo
                    </button>
                  </div>
                )}

              {!isLoading &&
                !isError &&
                nftsData &&
                nftsData.items.length > 0 && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                      {nftsData.items.map((nft) => {
                        const isFav = favoriteIds.has(nft.id);
                        const soldOut = nft.availableStock <= 0;

                        return (
                          <article
                            key={nft.id}
                            className="group rounded-2xl border border-[#332415] bg-[#1b130b] p-3.5 transition-colors hover:border-[#e0a83e]/60 flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="aspect-square w-full overflow-hidden rounded-xl bg-[#24190e]">
                                <img
                                  src={nft.imageUrl}
                                  alt={nft.title}
                                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                                />
                              </div>

                              <div className="flex items-start justify-between gap-2">
                                <h3 className="text-sm font-semibold text-[#f7f3eb]">
                                  {nft.title}
                                </h3>

                                <button
                                  type="button"
                                  aria-label={
                                    isFav
                                      ? `Remover ${nft.title} dos favoritos`
                                      : `Favoritar ${nft.title}`
                                  }
                                  aria-pressed={isFav}
                                  onClick={() =>
                                    toggleFavoriteMutation.mutate(nft.id)
                                  }
                                  className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#332415] text-[#b5a794] hover:border-[#e0a83e] hover:text-[#e0a83e] transition-colors cursor-pointer"
                                >
                                  <Heart
                                    className={`h-4 w-4 ${isFav ? "fill-[#e0a83e] text-[#e0a83e]" : ""}`}
                                  />
                                </button>
                              </div>
                            </div>

                            <div className="mt-4 pt-3 border-t border-[#332415]/70 flex items-center justify-between gap-2">
                              <div>
                                <span className="text-sm font-bold text-[#e0a83e]">
                                  {formatEthLabel(nft.priceEth)}
                                </span>
                                <span className="ml-2 text-[11px] text-[#b5a794]">
                                  {soldOut
                                    ? "Esgotado"
                                    : `${nft.availableStock} disp.`}
                                </span>
                              </div>

                              <button
                                type="button"
                                disabled={soldOut || addCartMutation.isPending}
                                onClick={() =>
                                  addCartMutation.mutate({
                                    nftId: nft.id,
                                    quantity: 1,
                                  })
                                }
                                className="inline-flex items-center gap-1.5 rounded-full bg-[#e0a83e] px-3.5 py-1.5 text-[11px] font-bold text-[#120c06] hover:bg-[#ebb64e] disabled:opacity-40 transition-colors cursor-pointer"
                              >
                                <ShoppingBag className="h-3.5 w-3.5" />
                                <span>
                                  {soldOut ? "Esgotado" : "Adicionar"}
                                </span>
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    {/* Paginação numérica */}
                    {nftsData.totalPages > 1 && (
                      <div className="mt-6 flex items-center justify-end gap-2 text-xs">
                        {Array.from({ length: nftsData.totalPages }).map(
                          (_, idx) => {
                            const pageNum = idx + 1;
                            const isCurrent = nftsData.page === pageNum;
                            return (
                              <button
                                key={pageNum}
                                type="button"
                                onClick={() => updateFilters({ page: pageNum })}
                                className={`h-8 w-8 rounded-lg border font-semibold transition-colors cursor-pointer ${
                                  isCurrent
                                    ? "border-[#e0a83e] bg-[#e0a83e] text-[#120c06]"
                                    : "border-[#332415] bg-[#1b130b] text-[#f7f3eb] hover:border-[#e0a83e]"
                                }`}
                              >
                                {pageNum}
                              </button>
                            );
                          },
                        )}
                      </div>
                    )}
                  </>
                )}
            </div>
          </div>
        </section>

        {/* 3. DOIS BANNERS PROMOCIONAIS LADO A LADO */}
        <section
          aria-label="Coleções em destaque"
          className="grid grid-cols-1 md:grid-cols-2 gap-6"
        >
          <div className="flex items-center gap-5 rounded-2xl border border-[#332415] bg-[#1b130b] p-5">
            <img
              src="/src/assets/images/nft-emerald-ape.png"
              alt="Série Genesis Kurio"
              className="h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-xl object-cover"
            />
            <div className="space-y-2.5">
              <h2 className="text-base font-bold text-[#f7f3eb]">
                Coleção Genesis
              </h2>
              <p className="text-xs leading-relaxed text-[#b5a794]">
                Peças exclusivas com atributos raros e verificação direta na
                rede.
              </p>
              <Link
                to="/mercado"
                className="inline-flex rounded-full bg-[#e0a83e] px-4 py-1.5 text-[11px] font-bold text-[#120c06] hover:bg-[#ebb64e]"
              >
                Explorar série
              </Link>
            </div>
          </div>

          <div className="flex items-center gap-5 rounded-2xl border border-[#332415] bg-[#1b130b] p-5">
            <img
              src="/src/assets/images/nft-neon-vessel.png"
              alt="Curadoria Atelier Vex"
              className="h-28 w-28 sm:h-32 sm:w-32 shrink-0 rounded-xl object-cover"
            />
            <div className="space-y-2.5">
              <h2 className="text-base font-bold text-[#f7f3eb]">
                Atelier & Arte 3D
              </h2>
              <p className="text-xs leading-relaxed text-[#b5a794]">
                Obras selecionadas de estúdios independentes com edições
                limitadas.
              </p>
              <Link
                to="/mercado"
                className="inline-flex rounded-full border border-[#e0a83e] px-4 py-1.5 text-[11px] font-bold text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06]"
              >
                Ver destaques
              </Link>
            </div>
          </div>
        </section>

        {/* 4. DIÁRIO DA CUNHAGEM */}
        <section aria-label="Diário da Cunhagem" className="space-y-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-[#f7f3eb]">
              Diário da Cunhagem
            </h2>
            <p className="text-xs text-[#b5a794]">
              Artigos e guias para colecionadores explorarem o universo da
              propriedade digital.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {JOURNAL_POSTS.map((post) => (
              <article
                key={post.id}
                className="rounded-2xl border border-[#332415] bg-[#1b130b] p-3.5 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-3">
                  <img
                    src={post.image}
                    alt={post.title}
                    className="aspect-[4/3] w-full rounded-xl object-cover bg-[#24190e]"
                  />
                  <p className="text-[11px] text-[#e0a83e]">{post.meta}</p>
                  <h3 className="text-sm font-bold leading-snug text-[#f7f3eb]">
                    {post.title}
                  </h3>
                  <p className="text-xs leading-relaxed text-[#b5a794]">
                    {post.excerpt}
                  </p>
                </div>
                <a
                  href="#catalogo"
                  className="pt-2 text-xs font-semibold text-[#e0a83e] hover:underline"
                >
                  Ler mais →
                </a>
              </article>
            ))}
          </div>
        </section>

        {/* 5. PILARES DE CONFIANÇA */}
        <section
          aria-label="Diferenciais Kurio"
          className="grid grid-cols-1 md:grid-cols-3 gap-6 rounded-2xl border border-[#332415] bg-[#1b130b]/80 p-6 sm:p-8"
        >
          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e0a83e]/15 text-[#e0a83e]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[#f7f3eb]">
              Segurança de contrato
            </h3>
            <p className="text-xs leading-relaxed text-[#b5a794]">
              Transações verificadas com proteção contra duplicidade e rastreio
              transparente.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e0a83e]/15 text-[#e0a83e]">
              <Users className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[#f7f3eb]">
              Criadores em destaque
            </h3>
            <p className="text-xs leading-relaxed text-[#b5a794]">
              Curadoria ativa conectando colecionadores aos principais artistas
              digitais.
            </p>
          </div>

          <div className="space-y-2.5">
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#e0a83e]/15 text-[#e0a83e]">
              <Trophy className="h-5 w-5" />
            </div>
            <h3 className="text-sm font-bold text-[#f7f3eb]">
              Lendas de Lançamentos
            </h3>
            <p className="text-xs leading-relaxed text-[#b5a794]">
              Acesso antecipado a séries exclusivas, edições 1/1 e quedas
              limitadas.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
