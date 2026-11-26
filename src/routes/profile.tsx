import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Copy, Heart, Package, User } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import {
  changePassword,
  getFavorites,
  getOrders,
  getProfile,
  updateProfile,
} from "@/api/marketplace";
import { useAuth } from "@/features/auth/auth-context";
import { formatEthLabel } from "@/lib/eth";

export const Route = createFileRoute("/profile")({
  component: ProfilePage,
});

function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [profileNotice, setProfileNotice] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordNotice, setPasswordNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      void navigate({
        to: "/login",
        search: { redirect: "/profile" },
      });
    }
  }, [authLoading, isAuthenticated, navigate]);

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: isAuthenticated,
  });

  const { data: ordersData } = useQuery({
    queryKey: ["orders"],
    queryFn: getOrders,
    enabled: isAuthenticated,
  });

  const { data: favoritesData } = useQuery({
    queryKey: ["favorites"],
    queryFn: getFavorites,
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setHandle(profile.handle);
      setBio(profile.bio);
    }
  }, [profile]);

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: async (updated) => {
      queryClient.setQueryData(["profile"], updated);
      await queryClient.invalidateQueries({ queryKey: ["session"] });
      setProfileNotice("Perfil atualizado com sucesso.");
    },
    onError: (err: unknown) => {
      setProfileNotice(
        err instanceof Error ? err.message : "Erro ao salvar perfil.",
      );
    },
  });

  const passwordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setCurrentPassword("");
      setNewPassword("");
      setPasswordNotice("Senha alterada com sucesso.");
    },
    onError: (err: unknown) => {
      setPasswordNotice(
        err instanceof Error ? err.message : "Erro ao alterar senha.",
      );
    },
  });

  function handleSaveProfile(e: FormEvent) {
    e.preventDefault();
    setProfileNotice(null);
    updateProfileMutation.mutate({ name, handle, bio });
  }

  function handleChangePassword(e: FormEvent) {
    e.preventDefault();
    setPasswordNotice(null);
    passwordMutation.mutate({ currentPassword, newPassword });
  }

  if (authLoading || !profile) {
    return (
      <div className="mx-auto max-w-[1080px] px-4 py-12 space-y-4">
        <div className="h-8 w-48 rounded kurio-shimmer" />
        <div className="h-56 w-full rounded-2xl kurio-shimmer" />
      </div>
    );
  }

  const collectorUrl = `${window.location.origin}/?collector=${profile.collectorLinkSlug}`;

  return (
    <div className="mx-auto max-w-[1080px] px-4 sm:px-8 py-8 sm:py-12 space-y-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#332415] pb-5">
        <div>
          <p className="text-xs text-[#e0a83e]">Conta do Colecionador</p>
          <h1 className="text-2xl sm:text-3xl font-bold uppercase text-[#f7f3eb]">
            Meu Perfil
          </h1>
        </div>
        <Link
          to="/wallets"
          className="w-fit rounded-full border border-[#e0a83e] px-5 py-2 text-xs font-bold text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06]"
        >
          Gerenciar Carteiras
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Dados do perfil e senha */}
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleSaveProfile}
            className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4"
          >
            <div className="flex items-center gap-2 text-sm font-bold uppercase text-[#f7f3eb]">
              <User className="h-4 w-4 text-[#e0a83e]" />
              <h2>Informações Pessoais</h2>
            </div>

            {profileNotice && (
              <p className="rounded-lg bg-[#120c06] px-3 py-2 text-xs text-[#e0a83e]">
                {profileNotice}
              </p>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="profile-name"
                className="block text-xs text-[#b5a794]"
              >
                Nome
              </label>
              <input
                id="profile-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-handle"
                className="block text-xs text-[#b5a794]"
              >
                Handle
              </label>
              <input
                id="profile-handle"
                type="text"
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="profile-bio"
                className="block text-xs text-[#b5a794]"
              >
                Bio
              </label>
              <textarea
                id="profile-bio"
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
              />
            </div>

            <button
              type="submit"
              disabled={updateProfileMutation.isPending}
              className="rounded-full bg-[#e0a83e] px-5 py-2.5 text-xs font-bold uppercase text-[#120c06] hover:bg-[#ebb64e] cursor-pointer"
            >
              Salvar alterações
            </button>
          </form>

          {/* Link público de colecionador */}
          <div className="rounded-2xl border border-[#332415] bg-[#1b130b] p-5 space-y-2">
            <span className="text-xs font-bold text-[#f7f3eb]">
              Link de Colecionador
            </span>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={collectorUrl}
                className="flex-1 rounded-lg border border-[#332415] bg-[#120c06] px-3 py-2 text-[11px] text-[#b5a794]"
              />
              <button
                type="button"
                onClick={() =>
                  void navigator.clipboard?.writeText(collectorUrl)
                }
                className="inline-flex items-center gap-1 rounded-lg border border-[#e0a83e] px-3 py-2 text-xs text-[#e0a83e] cursor-pointer"
              >
                <Copy className="h-3.5 w-3.5" />
                <span>Copiar</span>
              </button>
            </div>
          </div>

          {/* Segurança / Alterar senha */}
          <form
            onSubmit={handleChangePassword}
            className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4"
          >
            <h2 className="text-sm font-bold uppercase text-[#f7f3eb]">
              Alterar Senha
            </h2>
            {passwordNotice && (
              <p className="rounded-lg bg-[#120c06] px-3 py-2 text-xs text-[#e0a83e]">
                {passwordNotice}
              </p>
            )}
            <div className="space-y-1.5">
              <label
                htmlFor="cur-pass"
                className="block text-xs text-[#b5a794]"
              >
                Senha atual
              </label>
              <input
                id="cur-pass"
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
              />
            </div>
            <div className="space-y-1.5">
              <label
                htmlFor="new-pass"
                className="block text-xs text-[#b5a794]"
              >
                Nova senha
              </label>
              <input
                id="new-pass"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full rounded-xl border border-[#332415] bg-[#120c06] px-3.5 py-2 text-xs text-[#f7f3eb]"
              />
            </div>
            <button
              type="submit"
              disabled={passwordMutation.isPending}
              className="rounded-full border border-[#e0a83e] px-5 py-2 text-xs font-bold text-[#e0a83e] hover:bg-[#e0a83e] hover:text-[#120c06] cursor-pointer"
            >
              Atualizar senha
            </button>
          </form>
        </div>

        {/* Pedidos e Favoritos */}
        <div className="lg:col-span-6 space-y-6">
          <section className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase text-[#f7f3eb]">
              <Package className="h-4 w-4 text-[#e0a83e]" />
              <h2>Histórico de Pedidos ({ordersData?.items.length ?? 0})</h2>
            </div>

            {!ordersData || ordersData.items.length === 0 ? (
              <p className="text-xs text-[#b5a794]">
                Você ainda não realizou nenhum pedido.
              </p>
            ) : (
              <ul className="space-y-3">
                {ordersData.items.map((ord) => (
                  <li
                    key={ord.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-[#332415] bg-[#120c06] p-3.5 text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#f7f3eb]">#{ord.id}</p>
                      <p className="text-[11px] text-[#b5a794]">
                        {ord.items.length} item(ns) • Status: {ord.status}
                      </p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="font-bold text-[#e0a83e]">
                        {formatEthLabel(ord.totalEth)}
                      </p>
                      <Link
                        to="/orders/$orderId"
                        params={{ orderId: ord.id }}
                        className="text-[11px] text-[#f7f3eb] underline"
                      >
                        Detalhes
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-[#332415] bg-[#1b130b] p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold uppercase text-[#f7f3eb]">
              <Heart className="h-4 w-4 text-[#e0a83e]" />
              <h2>NFTs Favoritos ({favoritesData?.items.length ?? 0})</h2>
            </div>

            {!favoritesData || favoritesData.items.length === 0 ? (
              <p className="text-xs text-[#b5a794]">
                Nenhum NFT favoritado ainda.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {favoritesData.items.map((nft) => (
                  <Link
                    key={nft.id}
                    to="/nfts/$nftId"
                    params={{ nftId: nft.id }}
                    className="rounded-xl border border-[#332415] bg-[#120c06] p-2.5 space-y-2 hover:border-[#e0a83e]"
                  >
                    <img
                      src={nft.imageUrl}
                      alt={nft.title}
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <p className="truncate text-xs font-bold text-[#f7f3eb]">
                      {nft.title}
                    </p>
                    <p className="text-[11px] text-[#e0a83e]">
                      {formatEthLabel(nft.priceEth)}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
