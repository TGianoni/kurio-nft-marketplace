export type EthAmount = string; // Ex.: "0.45", "1.2500"

export type NftCategory = "Arte" | "3D" | "Fotografia" | "Colecionáveis" | "Música";
export type NftEdition = "1/1" | "Limitada" | "Aberta";
export type NftSortOption =
  | "featured"
  | "price_asc"
  | "price_desc"
  | "newest";

export interface NftItem {
  id: string;
  title: string;
  slug: string;
  creatorName: string;
  creatorHandle: string;
  collectionName: string;
  category: NftCategory;
  edition: NftEdition;
  imageUrl: string;
  galleryUrls: string[];
  description: string;
  priceEth: EthAmount;
  availableStock: number;
  maxPerOrder: number;
  version: number;
  featured?: boolean;
  traits: Array<{ label: string; value: string }>;
}

export interface NftListParams {
  q?: string;
  category?: NftCategory | "all";
  edition?: NftEdition | "all";
  minPrice?: string;
  maxPrice?: string;
  sort?: NftSortOption;
  page?: number;
  pageSize?: number;
}

export interface NftListResponse {
  items: NftItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface CartItem {
  nftId: string;
  quantity: number;
  unitPriceEth: EthAmount;
  availableStock: number;
  title: string;
  imageUrl: string;
  edition: NftEdition;
  version: number;
}

export interface QuoteResponse {
  items: CartItem[];
  subtotalEth: EthAmount;
  discountEth: EthAmount;
  networkFeeEth: EthAmount;
  totalEth: EthAmount;
  couponCode: string | null;
  couponMessage?: string;
  priceOrStockChanged: boolean;
  quoteToken: string;
}

export type NetworkId = "ethereum" | "polygon" | "arbitrum" | "base";

export interface WalletAccount {
  id: "primary" | "secondary";
  label: string;
  address: string;
  network: NetworkId;
  balanceEth: EthAmount;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  handle: string;
  bio: string;
  avatarUrl: string;
  collectorLinkSlug: string;
}

export interface SessionData {
  authenticated: boolean;
  user: UserProfile | null;
  expiresAt: string | null;
}

export type OrderStatus = "pending" | "confirmed" | "rejected";

export interface OrderSnapshotItem {
  nftId: string;
  title: string;
  imageUrl: string;
  edition: NftEdition;
  quantity: number;
  unitPriceEth: EthAmount;
}

export interface OrderRecord {
  id: string;
  userId: string;
  idempotencyKey: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
  version: number;
  txHash: string;
  explorerUrl: string;
  network: NetworkId;
  walletAddress: string;
  buyerName: string;
  buyerEmail: string;
  couponCode: string | null;
  subtotalEth: EthAmount;
  discountEth: EthAmount;
  networkFeeEth: EthAmount;
  totalEth: EthAmount;
  items: OrderSnapshotItem[];
  reason?: string;
}

export interface NftUpdatedEvent {
  eventId: string;
  version: number;
  occurredAt: string;
  nftId: string;
  priceEth: EthAmount;
  availableStock: number;
}

export interface OrderUpdatedEvent {
  eventId: string;
  version: number;
  occurredAt: string;
  orderId: string;
  userId: string;
  status: OrderStatus;
  reason?: string;
}

export interface ApiErrorPayload {
  code:
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "UNAVAILABLE_STOCK"
    | "PRICE_CHANGED"
    | "INVALID_COUPON"
    | "TRANSIENT_ERROR";
  message: string;
  details?: Record<string, string>;
}