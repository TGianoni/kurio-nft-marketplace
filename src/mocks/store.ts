import type {
  CartItem,
  EthAmount,
  NftItem,
  OrderRecord,
  OrderSnapshotItem,
  OrderStatus,
  QuoteResponse,
  UserProfile,
  WalletAccount,
} from "@/contracts/marketplace";
import {
  addEth,
  mulEthByInt,
  formatWeiToEth,
  parseEthToWei,
  subEth,
} from "@/lib/eth";
import { INITIAL_NFTS, MOCK_USERS } from "./fixtures";

export type MockScenario =
  | "default"
  | "empty_catalog"
  | "slow_network"
  | "server_error"
  | "network_error"
  | "expired_session"
  | "payment_rejected"
  | "order_timeout_then_confirm"
  | "price_changed_checkout";

interface StoredUser {
  profile: UserProfile;
  password: string;
  wallets: WalletAccount[];
  favorites: string[];
  cart: Array<{
    nftId: string;
    quantity: number;
    unitPriceEth: EthAmount;
    version: number;
  }>;
}

interface MockDatabase {
  nfts: NftItem[];
  users: StoredUser[];
  currentUserId: string | null;
  sessionExpiresAt: string | null;
  guestCart: Array<{
    nftId: string;
    quantity: number;
    unitPriceEth: EthAmount;
    version: number;
  }>;
  appliedCoupon: string | null;
  orders: OrderRecord[];
  scenario: MockScenario;
  latencyMs: number;
  eventCounter: number;
}

const STORAGE_KEY = "kurio_mock_db_v1";

function cloneInitialDb(): MockDatabase {
  return {
    nfts: structuredClone(INITIAL_NFTS),
    users: MOCK_USERS.map((u) => ({
      profile: structuredClone(u.profile),
      password: u.password,
      wallets: structuredClone(u.wallets),
      favorites: [...u.favorites],
      cart: [],
    })),
    currentUserId: null,
    sessionExpiresAt: null,
    guestCart: [],
    appliedCoupon: null,
    orders: [],
    scenario: "default",
    latencyMs: 180,
    eventCounter: 1,
  };
}

let db: MockDatabase = loadDb();

function loadDb(): MockDatabase {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneInitialDb();
    return JSON.parse(raw) as MockDatabase;
  } catch {
    return cloneInitialDb();
  }
}

export function persistDb() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch {
    // Ignora falha de storage em ambientes restritos
  }
}

export function getDb(): MockDatabase {
  return db;
}

export function resetMockDb(scenario: MockScenario = "default") {
  db = cloneInitialDb();
  db.scenario = scenario;
  persistDb();
}

export function setMockScenario(scenario: MockScenario, latencyMs?: number) {
  db.scenario = scenario;
  if (typeof latencyMs === "number") {
    db.latencyMs = latencyMs;
  }
  persistDb();
}

export function getCurrentUser(): StoredUser | null {
  if (!db.currentUserId) return null;
  if (
    db.sessionExpiresAt &&
    new Date(db.sessionExpiresAt).getTime() <= Date.now()
  ) {
    db.currentUserId = null;
    db.sessionExpiresAt = null;
    persistDb();
    return null;
  }
  return db.users.find((u) => u.profile.id === db.currentUserId) ?? null;
}

export function getActiveCartRaw() {
  const user = getCurrentUser();
  return user ? user.cart : db.guestCart;
}

export function buildCartItems(): {
  items: CartItem[];
  priceOrStockChanged: boolean;
} {
  const rawCart = getActiveCartRaw();
  const safeCart = Array.isArray(rawCart) ? rawCart : [];
  const safeNfts = Array.isArray(db.nfts) ? db.nfts : [];

  let priceOrStockChanged = false;
  const items: CartItem[] = [];

  for (const entry of safeCart) {
    if (!entry || typeof entry.nftId !== "string") continue;

    const nft = safeNfts.find((n) => n.id === entry.nftId);
    if (!nft) continue;

    if (
      nft.priceEth !== entry.unitPriceEth ||
      nft.version !== entry.version ||
      entry.quantity > nft.availableStock
    ) {
      priceOrStockChanged = true;
    }

    items.push({
      nftId: nft.id,
      quantity: entry.quantity,
      unitPriceEth: entry.unitPriceEth,
      availableStock: nft.availableStock,
      title: nft.title,
      imageUrl: nft.imageUrl,
      edition: nft.edition,
      version: entry.version,
    });
  }

  return { items, priceOrStockChanged };
}

export function syncCartWithCurrentPrices() {
  const rawCart = getActiveCartRaw();
  for (const entry of rawCart) {
    const nft = db.nfts.find((n) => n.id === entry.nftId);
    if (!nft) continue;
    entry.unitPriceEth = nft.priceEth;
    entry.version = nft.version;
    if (entry.quantity > nft.availableStock) {
      entry.quantity = Math.max(0, nft.availableStock);
    }
  }
  const filtered = rawCart.filter((e) => e.quantity > 0);
  const user = getCurrentUser();
  if (user) {
    user.cart = filtered;
  } else {
    db.guestCart = filtered;
  }
  persistDb();
}

export function mergeGuestCartIntoUser(user: StoredUser) {
  for (const guestItem of db.guestCart) {
    const nft = db.nfts.find((n) => n.id === guestItem.nftId);
    if (!nft || nft.availableStock <= 0) continue;

    const existing = user.cart.find((c) => c.nftId === guestItem.nftId);
    const maxAllowed = Math.min(nft.availableStock, nft.maxPerOrder);

    if (existing) {
      existing.quantity = Math.min(
        maxAllowed,
        existing.quantity + guestItem.quantity,
      );
      existing.unitPriceEth = nft.priceEth;
      existing.version = nft.version;
    } else {
      user.cart.push({
        nftId: nft.id,
        quantity: Math.min(maxAllowed, guestItem.quantity),
        unitPriceEth: nft.priceEth,
        version: nft.version,
      });
    }
  }
  db.guestCart = [];
  persistDb();
}

export function calculateQuote(couponInput?: string | null): QuoteResponse {
  const { items, priceOrStockChanged } = buildCartItems();
  const code = (couponInput ?? db.appliedCoupon)?.trim().toUpperCase() || null;

  let subtotal: EthAmount = "0";
  for (const item of items) {
    const nft = db.nfts.find((n) => n.id === item.nftId);
    const currentPrice = nft ? nft.priceEth : item.unitPriceEth;
    subtotal = addEth(subtotal, mulEthByInt(currentPrice, item.quantity));
  }

  let discount: EthAmount = "0";
  let couponMessage: string | undefined;

  if (code === "KURIO10" && parseEthToWei(subtotal) > 0n) {
    const subWei = parseEthToWei(subtotal);
    const discWei = (subWei * 10n) / 100n;
    discount = formatWeiToEth(discWei);
    couponMessage = "Cupom KURIO10 aplicado (10% de desconto)";
  }

  const networkFee: EthAmount = items.length > 0 ? "0.015" : "0";
  const afterDiscount = subEth(subtotal, discount);
  const total = items.length > 0 ? addEth(afterDiscount, networkFee) : "0";

  const quoteToken = items
    .map((i) => {
      const nft = db.nfts.find((n) => n.id === i.nftId);
      return `${i.nftId}:${i.quantity}:${nft?.priceEth ?? i.unitPriceEth}:v${nft?.version ?? i.version}`;
    })
    .join("|");

  return {
    items,
    subtotalEth: subtotal,
    discountEth: discount,
    networkFeeEth: networkFee,
    totalEth: total,
    couponCode: code === "KURIO10" ? code : null,
    couponMessage,
    priceOrStockChanged,
    quoteToken,
  };
}

export function nextEventId(): string {
  const id = `evt-${Date.now()}-${db.eventCounter++}`;
  persistDb();
  return id;
}

export function createOrderSnapshotItems(
  items: CartItem[],
): OrderSnapshotItem[] {
  return items.map((item) => {
    const nft = db.nfts.find((n) => n.id === item.nftId);
    return {
      nftId: item.nftId,
      title: nft?.title ?? item.title,
      imageUrl: nft?.imageUrl ?? item.imageUrl,
      edition: nft?.edition ?? item.edition,
      quantity: item.quantity,
      unitPriceEth: nft?.priceEth ?? item.unitPriceEth,
    };
  });
}

export function finalizeOrderStatus(
  orderId: string,
  status: OrderStatus,
  reason?: string,
) {
  const order = db.orders.find((o) => o.id === orderId);
  if (!order) return null;
  if (order.status === "confirmed" || order.status === "rejected") {
    return order; // Estados terminais não regridem
  }

  order.status = status;
  order.reason = reason;
  order.version += 1;
  order.updatedAt = new Date().toISOString();

  if (status === "confirmed") {
    // Baixa estoque e remove apenas os itens/quantidades comprados do carrinho do usuário
    const user = db.users.find((u) => u.profile.id === order.userId);
    for (const bought of order.items) {
      const nft = db.nfts.find((n) => n.id === bought.nftId);
      if (nft) {
        nft.availableStock = Math.max(0, nft.availableStock - bought.quantity);
        nft.version += 1;
      }
      if (user) {
        const cartEntry = user.cart.find((c) => c.nftId === bought.nftId);
        if (cartEntry) {
          cartEntry.quantity -= bought.quantity;
        }
      }
    }
    if (user) {
      user.cart = user.cart.filter((c) => c.quantity > 0);
    }
    db.appliedCoupon = null;
  }

  persistDb();
  return order;
}
