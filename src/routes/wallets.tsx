import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { getWallets, updateWallet } from "@/api/marketplace";
import type { NetworkId, WalletAccount } from "@/contracts/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/wallets")({
  component: WalletsPage,
});

function WalletCard({ wallet }: { wallet: WalletAccount }) {
  const queryClient = useQueryClient();
  const [label, setLabel] = useState(wallet.label);
  const [address, setAddress] = useState(wallet.address);
  const [network, setNetwork] = useState<NetworkId>(wallet.network);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    setLabel(wallet.label);
    setAddress(wallet.address);
    setNetwork(wallet.network);
  }, [wallet]);

  const mutation = useMutation({
    mutationFn: () =>
      updateWallet(wallet.id, {
        label,
        address,
        network,
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["wallets"] });
      setFeedback("Carteira atualizada com sucesso.");
    },
    onError: (err: unknown) => {
      setFeedback(
        err instanceof Error ? err.message : "Erro ao atualizar carteira.",
      );
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFeedback(null);
    mutation.mutate();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-[#f7f3eb]">
          <Wallet className="h-4 w-4 text-[#e0a83e]" />
          <span>
            {wallet.id === "primary"
              ? "Carteira Principal"
              : "Carteira Secundária"}
          </span>
        </div>
        <span className="rounded-full bg-[#120c06] border border-[#332415] px-3 py-1 text-xs font-bold text-[#e0a83e]">
          {formatEthLabel(wallet.balanceEth)}
        </span>
      </div>

      {feedback && (
        <p className="rounded-lg bg-[#120c06] px-3 py-2 text-xs text-[#e0a83e]">
          {feedback}
        </p>
      )}

      <div className="space-y-1.5">
        <label
          htmlFor={`label-${wallet.id}`}
          className="block text-xs text-[#b5a794]"
        >
          Identificação
        </label>
        <input
          id={`label-${wallet.id}`}
          type="text"
          required
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`address-${wallet.id}`}
          className="block text-xs text-[#b5a794]"
        >
          Endereço público (0x...)
        </label>
        <input
          id={`address-${wallet.id}`}
          type="text"
          required
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs font-mono text-[#f7f3eb]"
        />
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor={`network-${wallet.id}`}
          className="block text-xs text-[#b5a794]"
        >
          Rede padrão
        </label>
        <select
          id={`network-${wallet.id}`}
          value={network}
          onChange={(e) => setNetwork(e.target.value as NetworkId)}
          className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
        >
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
          <option value="base">Base</option>
        </select>
      </div>

      <button
        type="submit"
        disabled={mutation.isPending}
        className="rounded-full bg-[#e0a83e] px-5 py-2 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] cursor-pointer"
      >
        Salvar carteira
      </button>
    </form>
  );
}

function WalletsPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void navigate({
        to: "/login",
        search: { redirect: "/wallets" },
      });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["wallets"],
    queryFn: getWallets,
    enabled: isAuthenticated,
  });

  if (authLoading || isLoading) {
    return (
      <div className="mx-auto max-w-[1000px] px-4 py-12 space-y-4">
        <div className="h-8 w-48 rounded kurio-shimmer" />
        <div className="h-56 w-full rounded-2xl kurio-shimmer" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1000px] px-4 sm:px-8 py-8 sm:py-12 space-y-8">
      <div className="border-b border-[#332415] pb-4">
        <p className="text-xs text-[#e0a83e]">Custódia & Redes</p>
        <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#f7f3eb]">
          Minhas Carteiras
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {(data?.items ?? []).map((wallet) => (
          <WalletCard key={wallet.id} wallet={wallet} />
        ))}
      </div>
    </div>
  );
}
