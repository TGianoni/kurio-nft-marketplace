import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { getNfts } from "@/api/marketplace";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/mercado")({
  component: MercadoPage,
});

function MercadoPage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["nfts", "mercado"],
    queryFn: ({ signal }) => getNfts({ page: 1, pageSize: 6 }, signal),
  });

  return (
    <section
      id="catalogo"
      className="mx-auto max-w-[1200px] px-8 py-12 space-y-8"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#332415] pb-5">
        <div>
          <p className="text-xs font-medium text-[#e0a83e]">
            Explorar Coleções
          </p>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#f7f3eb]">
            Mercado Kurio
          </h1>
        </div>
        <Link
          to="/"
          search={{
            category: "all",
            edition: "all",
            sort: "featured",
            page: 1,
          }}
          className="w-fit rounded-full border border-[#332415] px-5 py-2 text-xs text-[#f7f3eb] hover:border-[#e0a83e]"
        >
          Voltar ao Início
        </Link>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="rounded-2xl border border-[#332415] bg-[#1b130b] p-4 space-y-3"
            >
              <div className="aspect-square w-full rounded-xl kurio-shimmer" />
              <div className="h-4 w-2/3 rounded kurio-shimmer" />
            </div>
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-2xl border border-red-500/40 bg-[#1b130b] p-8 text-center space-y-3">
          <p className="text-sm text-red-300">
            Erro ao carregar os NFTs do catálogo.
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

      {!isLoading && !isError && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {data.items.map((nft) => (
            <article
              key={nft.id}
              className="rounded-2xl border border-[#332415] bg-[#1b130b] p-4 space-y-3"
            >
              <img
                src={nft.imageUrl}
                alt={nft.title}
                className="aspect-square w-full rounded-xl object-cover bg-[#24190e]"
              />
              <div className="flex items-center justify-between gap-2 pt-1">
                <h2 className="text-sm font-semibold text-[#f7f3eb]">
                  {nft.title}
                </h2>
                <span className="text-sm font-bold text-[#e0a83e]">
                  {formatEthLabel(nft.priceEth)}
                </span>
              </div>
              <p className="text-xs text-[#b5a794]">{nft.collectionName}</p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
