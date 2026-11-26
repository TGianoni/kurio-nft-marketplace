import type {
  CartItem,
  NetworkId,
  NftItem,
  NftListParams,
  NftListResponse,
  OrderRecord,
  QuoteResponse,
  SessionData,
  UserProfile,
  WalletAccount,
} from "@/contracts/marketplace";
import { apiClient } from "./client";
import type { QueryClient } from "@tanstack/react-query";

export interface FavoritesCacheData {
  ids: string[];
  items?: NftItem[];
}

export async function toggleFavoriteWithOptimisticCache(params: {
  queryClient: QueryClient;
  nft: NftItem;
  currentlyFavorited: boolean;
}): Promise<{
  previousFavorites: FavoritesCacheData | undefined;
  request: Promise<{ ids: string[] }>;
}> {
  const { queryClient, nft, currentlyFavorited } = params;

  await queryClient.cancelQueries({ queryKey: ["favorites"] });
  const previousFavorites = queryClient.getQueryData<FavoritesCacheData>([
    "favorites",
  ]);

  queryClient.setQueryData<FavoritesCacheData>(["favorites"], (old) => {
    const currentIds = old?.ids ?? [];
    const currentItems = old?.items ?? [];

    if (currentlyFavorited) {
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

  const request = currentlyFavorited
    ? removeFavorite(nft.id)
    : addFavorite(nft.id);

  return { previousFavorites, request };
}

export async function getSession(): Promise<SessionData> {
  const { data } = await apiClient.get<SessionData>("/auth/session");
  return data;
}

export async function loginUser(payload: {
  email: string;
  password: string;
}): Promise<SessionData> {
  const { data } = await apiClient.post<SessionData>("/auth/login", payload);
  return data;
}

export async function registerUser(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<SessionData> {
  const { data } = await apiClient.post<SessionData>("/auth/register", payload);
  return data;
}

export async function logoutUser(): Promise<void> {
  await apiClient.post("/auth/logout");
}

export async function getNfts(
  params: NftListParams,
  signal?: AbortSignal,
): Promise<NftListResponse> {
  const { data } = await apiClient.get<NftListResponse>("/nfts", {
    params,
    signal,
  });
  return data;
}

export async function getNftById(
  nftId: string,
  signal?: AbortSignal,
): Promise<NftItem> {
  const { data } = await apiClient.get<NftItem>(
    `/nfts/${encodeURIComponent(nftId)}`,
    {
      signal,
    },
  );
  return data;
}

export async function getFavorites(): Promise<{
  ids: string[];
  items: NftItem[];
}> {
  const { data } = await apiClient.get<{ ids: string[]; items: NftItem[] }>(
    "/favorites",
  );
  return data;
}

export async function addFavorite(nftId: string): Promise<{ ids: string[] }> {
  const { data } = await apiClient.post<{ ids: string[] }>(
    `/favorites/${encodeURIComponent(nftId)}`,
  );
  return data;
}

export async function removeFavorite(
  nftId: string,
): Promise<{ ids: string[] }> {
  const { data } = await apiClient.delete<{ ids: string[] }>(
    `/favorites/${encodeURIComponent(nftId)}`,
  );
  return data;
}

export async function getCart(): Promise<{
  items: CartItem[];
  priceOrStockChanged: boolean;
  couponCode: string | null;
}> {
  const { data } = await apiClient.get<{
    items: CartItem[];
    priceOrStockChanged: boolean;
    couponCode: string | null;
  }>("/cart");
  return data;
}

export async function addToCart(payload: { nftId: string; quantity: number }) {
  const { data } = await apiClient.post<{
    items: CartItem[];
    priceOrStockChanged: boolean;
  }>("/cart/items", payload);
  return data;
}

export async function updateCartQuantity(nftId: string, quantity: number) {
  const { data } = await apiClient.patch<{
    items: CartItem[];
    priceOrStockChanged: boolean;
  }>(`/cart/items/${encodeURIComponent(nftId)}`, { quantity });
  return data;
}

export async function removeCartItem(nftId: string) {
  const { data } = await apiClient.delete<{
    items: CartItem[];
    priceOrStockChanged: boolean;
  }>(`/cart/items/${encodeURIComponent(nftId)}`);
  return data;
}

export async function syncCartPrices(): Promise<QuoteResponse> {
  const { data } = await apiClient.post<QuoteResponse>("/cart/sync-prices");
  return data;
}

export async function requestQuote(payload?: {
  couponCode?: string | null;
  clearCoupon?: boolean;
}): Promise<QuoteResponse> {
  const { data } = await apiClient.post<QuoteResponse>("/quote", payload ?? {});
  return data;
}

export async function createOrder(
  payload: {
    buyerName: string;
    buyerEmail: string;
    walletId: "primary" | "secondary";
    network: NetworkId;
    quoteToken: string;
  },
  idempotencyKey: string,
): Promise<OrderRecord> {
  const { data } = await apiClient.post<OrderRecord>("/orders", payload, {
    headers: {
      "Idempotency-Key": idempotencyKey,
    },
  });
  return data;
}

export async function getOrders(): Promise<{ items: OrderRecord[] }> {
  const { data } = await apiClient.get<{ items: OrderRecord[] }>("/orders");
  return data;
}

export async function getOrderById(
  orderId: string,
  signal?: AbortSignal,
): Promise<OrderRecord> {
  const { data } = await apiClient.get<OrderRecord>(
    `/orders/${encodeURIComponent(orderId)}`,
    {
      signal,
    },
  );
  return data;
}

export async function getProfile(): Promise<UserProfile> {
  const { data } = await apiClient.get<UserProfile>("/profile");
  return data;
}

export async function updateProfile(payload: {
  name?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<UserProfile> {
  const { data } = await apiClient.patch<UserProfile>("/profile", payload);
  return data;
}

export async function changePassword(payload: {
  currentPassword: string;
  newPassword: string;
}): Promise<{ ok: boolean }> {
  const { data } = await apiClient.post<{ ok: boolean }>(
    "/profile/password",
    payload,
  );
  return data;
}

export async function getWallets(): Promise<{ items: WalletAccount[] }> {
  const { data } = await apiClient.get<{ items: WalletAccount[] }>("/wallets");
  return data;
}

export async function updateWallet(
  walletId: "primary" | "secondary",
  payload: { label?: string; address?: string; network?: NetworkId },
): Promise<WalletAccount> {
  const { data } = await apiClient.put<WalletAccount>(
    `/wallets/${encodeURIComponent(walletId)}`,
    payload,
  );
  return data;
}

export async function resetMockScenario(scenario = "default") {
  const { data } = await apiClient.post("/mock/reset", { scenario });
  return data;
}

export async function triggerMockNftUpdated(payload: {
  nftId: string;
  priceEth?: string;
  availableStock?: number;
}) {
  const { data } = await apiClient.post("/mock/events/nft-updated", payload);
  return data;
}

export async function triggerMockOrderUpdated(payload: {
  orderId: string;
  status: "pending" | "confirmed" | "rejected";
  reason?: string;
  versionOverride?: number;
}) {
  const { data } = await apiClient.post("/mock/events/order-updated", payload);
  return data;
}
