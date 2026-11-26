import type { QueryClient } from "@tanstack/react-query";
import { io, type Socket } from "socket.io-client";
import type {
  NftUpdatedEvent,
  OrderUpdatedEvent,
} from "@/contracts/marketplace";

interface RealtimeCallbacks {
  queryClient: QueryClient;
  getActiveUserId: () => string | null;
  getActiveOrderId?: () => string | null;
  onNftPriceChanged?: (event: NftUpdatedEvent) => void;
  onOrderStatusChanged?: (event: OrderUpdatedEvent) => void;
}

const MAX_SEEN_EVENTS = 500;

class MarketplaceSocketManager {
  private socket: Socket | null = null;
  private seenEventIds = new Set<string>();
  private lastNftVersion = new Map<string, number>();
  private lastOrderVersion = new Map<string, number>();
  private callbacks: RealtimeCallbacks | null = null;
  private hasConnectedOnce = false;

  private markEventSeen(eventId: string) {
    if (this.seenEventIds.size >= MAX_SEEN_EVENTS) {
      const oldest = this.seenEventIds.values().next().value;
      if (oldest) {
        this.seenEventIds.delete(oldest);
      }
    }
    this.seenEventIds.add(eventId);
  }

  public connect(callbacks: RealtimeCallbacks) {
    this.callbacks = callbacks;

    if (this.socket) {
      return this.socket;
    }

    const socketUrl =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:5173";

    const socket = io(socketUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    socket.on("connect", () => {
      const currentCallbacks = this.callbacks;
      if (!currentCallbacks) return;

      // Reconcilia os recursos ativos com a API REST na conexão / reconexão
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["nfts"],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["cart"],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["quote"],
      });

      if (currentCallbacks.getActiveUserId()) {
        void currentCallbacks.queryClient.invalidateQueries({
          queryKey: ["orders"],
        });
      }

      const activeOrderId = currentCallbacks.getActiveOrderId?.();
      if (activeOrderId && this.hasConnectedOnce) {
        void currentCallbacks.queryClient.invalidateQueries({
          queryKey: ["order", activeOrderId],
        });
      }

      this.hasConnectedOnce = true;
    });

    socket.on("nft.updated", (payload: NftUpdatedEvent) => {
      const currentCallbacks = this.callbacks;
      if (!currentCallbacks || !payload?.eventId || !payload?.nftId) return;

      if (this.seenEventIds.has(payload.eventId)) {
        return;
      }

      const prevVersion = this.lastNftVersion.get(payload.nftId) ?? 0;
      if (
        typeof payload.version === "number" &&
        payload.version <= prevVersion
      ) {
        return;
      }

      this.markEventSeen(payload.eventId);
      if (typeof payload.version === "number") {
        this.lastNftVersion.set(payload.nftId, payload.version);
      }

      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["nfts"],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["nft", payload.nftId],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["cart"],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["quote"],
      });

      currentCallbacks.onNftPriceChanged?.(payload);
    });

    socket.on("order.updated", (payload: OrderUpdatedEvent) => {
      const currentCallbacks = this.callbacks;
      if (!currentCallbacks || !payload?.eventId || !payload?.orderId) return;

      if (this.seenEventIds.has(payload.eventId)) {
        return;
      }

      const activeUserId = currentCallbacks.getActiveUserId();
      if (!activeUserId || payload.userId !== activeUserId) {
        return;
      }

      const prevVersion = this.lastOrderVersion.get(payload.orderId) ?? 0;
      if (
        typeof payload.version === "number" &&
        payload.version <= prevVersion
      ) {
        return;
      }

      this.markEventSeen(payload.eventId);
      if (typeof payload.version === "number") {
        this.lastOrderVersion.set(payload.orderId, payload.version);
      }

      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["orders"],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["order", payload.orderId],
      });
      void currentCallbacks.queryClient.invalidateQueries({
        queryKey: ["cart"],
      });

      currentCallbacks.onOrderStatusChanged?.(payload);
    });

    this.socket = socket;
    return socket;
  }

  public resetSessionTracking() {
    this.lastOrderVersion.clear();
  }

  public disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.seenEventIds.clear();
    this.lastNftVersion.clear();
    this.lastOrderVersion.clear();
    this.callbacks = null;
    this.hasConnectedOnce = false;
  }
}

export const socketManager = new MarketplaceSocketManager();
