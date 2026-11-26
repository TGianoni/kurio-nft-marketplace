import { delay, http, HttpResponse } from "msw";
import type {
  ApiErrorPayload,
  NetworkId,
  NftCategory,
  NftEdition,
  NftSortOption,
  OrderRecord,
} from "@/contracts/marketplace";
import { parseEthToWei } from "@/lib/eth";
import {
  buildCartItems,
  calculateQuote,
  createOrderSnapshotItems,
  finalizeOrderStatus,
  getActiveCartRaw,
  getCurrentUser,
  getDb,
  mergeGuestCartIntoUser,
  type MockScenario,
  nextEventId,
  persistDb,
  resetMockDb,
  setMockScenario,
  syncCartWithCurrentPrices,
} from "./store";
import { emitNftUpdated, emitOrderUpdated } from "./socket";

function jsonError(status: number, payload: ApiErrorPayload) {
  return HttpResponse.json(payload, { status });
}

async function applyScenarioGate() {
  const db = getDb();
  const baseDelay = db.scenario === "slow_network" ? 1400 : db.latencyMs;
  if (baseDelay > 0) {
    await delay(baseDelay);
  }

  if (db.scenario === "network_error") {
    return HttpResponse.error();
  }

  if (db.scenario === "server_error") {
    return jsonError(503, {
      code: "TRANSIENT_ERROR",
      message: "Serviço temporariamente indisponível na simulação.",
    });
  }

  return null;
}

function requireAuthOrError() {
  const db = getDb();
  if (db.scenario === "expired_session") {
    db.currentUserId = null;
    db.sessionExpiresAt = null;
    persistDb();
    return {
      user: null,
      error: jsonError(401, {
        code: "UNAUTHORIZED",
        message: "Sessão expirada. Faça login novamente para continuar.",
      }),
    };
  }

  const user = getCurrentUser();
  if (!user) {
    return {
      user: null,
      error: jsonError(401, {
        code: "UNAUTHORIZED",
        message: "Autenticação necessária para acessar este recurso.",
      }),
    };
  }

  return { user, error: null };
}

export const restHandlers = [
  // Controle de cenário e reset (para demo e Playwright)
  http.post("/api/mock/reset", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      scenario?: MockScenario;
    };
    resetMockDb(body.scenario ?? "default");
    return HttpResponse.json({ ok: true, scenario: getDb().scenario });
  }),

  http.post("/api/mock/scenario", async ({ request }) => {
    const body = (await request.json().catch(() => ({}))) as {
      scenario: MockScenario;
      latencyMs?: number;
    };
    setMockScenario(body.scenario, body.latencyMs);
    return HttpResponse.json({
      ok: true,
      scenario: getDb().scenario,
      latencyMs: getDb().latencyMs,
    });
  }),

  // Disparo manual de evento em tempo real via Socket.IO (útil para demo e testes E2E)
  http.post("/api/mock/events/nft-updated", async ({ request }) => {
    const body = (await request.json()) as {
      nftId: string;
      priceEth?: string;
      availableStock?: number;
    };
    const db = getDb();
    const nft = db.nfts.find((n) => n.id === body.nftId);
    if (!nft) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "NFT não encontrado.",
      });
    }

    if (typeof body.priceEth === "string" && body.priceEth.trim()) {
      nft.priceEth = body.priceEth.trim();
    }
    if (typeof body.availableStock === "number") {
      nft.availableStock = Math.max(0, body.availableStock);
    }
    nft.version += 1;
    persistDb();

    const eventPayload = {
      eventId: nextEventId(),
      version: nft.version,
      occurredAt: new Date().toISOString(),
      nftId: nft.id,
      priceEth: nft.priceEth,
      availableStock: nft.availableStock,
    };

    emitNftUpdated(eventPayload);
    return HttpResponse.json({ ok: true, event: eventPayload, nft });
  }),

  http.post("/api/mock/events/order-updated", async ({ request }) => {
    const body = (await request.json()) as {
      orderId: string;
      status: "pending" | "confirmed" | "rejected";
      reason?: string;
      versionOverride?: number;
    };
    const db = getDb();
    const existing = db.orders.find((o) => o.id === body.orderId);
    if (!existing) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "Pedido não encontrado.",
      });
    }

    const updated =
      body.status === "pending"
        ? existing
        : (finalizeOrderStatus(existing.id, body.status, body.reason) ??
          existing);

    const version =
      typeof body.versionOverride === "number"
        ? body.versionOverride
        : updated.version;

    const eventPayload = {
      eventId: nextEventId(),
      version,
      occurredAt: new Date().toISOString(),
      orderId: updated.id,
      userId: updated.userId,
      status: updated.status,
      reason: updated.reason,
    };

    emitOrderUpdated(eventPayload);
    return HttpResponse.json({ ok: true, event: eventPayload, order: updated });
  }),

  // Sessão e conta
  http.get("/api/auth/session", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const user = getCurrentUser();
    const db = getDb();
    if (!user) {
      return HttpResponse.json({
        authenticated: false,
        user: null,
        expiresAt: null,
      });
    }
    return HttpResponse.json({
      authenticated: true,
      user: user.profile,
      expiresAt: db.sessionExpiresAt,
    });
  }),

  http.post("/api/auth/login", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      email?: string;
      password?: string;
    };
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    if (!email || !password) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Informe e-mail e senha para entrar.",
        details: {
          email: !email ? "E-mail é obrigatório." : "",
          password: !password ? "Senha é obrigatória." : "",
        },
      });
    }

    const db = getDb();
    const found = db.users.find(
      (u) => u.profile.email.toLowerCase() === email && u.password === password,
    );

    if (!found) {
      return jsonError(401, {
        code: "UNAUTHORIZED",
        message: "Credenciais inválidas. Verifique seu e-mail e senha.",
      });
    }

    db.currentUserId = found.profile.id;
    db.sessionExpiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 2,
    ).toISOString();
    mergeGuestCartIntoUser(found);
    persistDb();

    return HttpResponse.json({
      authenticated: true,
      user: found.profile,
      expiresAt: db.sessionExpiresAt,
    });
  }),

  http.post("/api/auth/register", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      email?: string;
      password?: string;
    };
    const name = (body.name ?? "").trim();
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";

    const fieldErrors: Record<string, string> = {};
    if (name.length < 2)
      fieldErrors.name = "Nome deve ter ao menos 2 caracteres.";
    if (!email.includes("@")) fieldErrors.email = "E-mail inválido.";
    if (password.length < 6)
      fieldErrors.password = "Senha deve ter ao menos 6 caracteres.";

    if (Object.keys(fieldErrors).length > 0) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Corrija os campos obrigatórios do cadastro.",
        details: fieldErrors,
      });
    }

    const db = getDb();
    const exists = db.users.some(
      (u) => u.profile.email.toLowerCase() === email,
    );
    if (exists) {
      return jsonError(409, {
        code: "CONFLICT",
        message: "Este e-mail já está cadastrado na plataforma.",
        details: { email: "E-mail já em uso." },
      });
    }

    const slugBase = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const newUser = {
      profile: {
        id: `user-${Date.now()}`,
        name,
        email,
        handle: `@${slugBase || "colecionador"}`,
        bio: "Novo colecionador na Kurio.",
        avatarUrl: "/images/avatar-1.png",
        collectorLinkSlug: `${slugBase || "colecionador"}-${db.users.length + 1}`,
      },
      password,
      wallets: [
        {
          id: "primary" as const,
          label: "Carteira Principal",
          address: "0x71C95911E9a5D330f4D621842EC243EE1343292e",
          network: "ethereum" as NetworkId,
          balanceEth: "5.0",
        },
        {
          id: "secondary" as const,
          label: "Carteira Secundária",
          address: "0x9f8B2C4d1E7a6B5C8D9E0F1A2B3C4D5E6F7A8B9C",
          network: "polygon" as NetworkId,
          balanceEth: "2.0",
        },
      ],
      favorites: [],
      cart: [],
    };

    db.users.push(newUser);
    db.currentUserId = newUser.profile.id;
    db.sessionExpiresAt = new Date(
      Date.now() + 1000 * 60 * 60 * 2,
    ).toISOString();
    mergeGuestCartIntoUser(newUser);
    persistDb();

    return HttpResponse.json(
      {
        authenticated: true,
        user: newUser.profile,
        expiresAt: db.sessionExpiresAt,
      },
      { status: 201 },
    );
  }),

  http.post("/api/auth/logout", async () => {
    const db = getDb();
    db.currentUserId = null;
    db.sessionExpiresAt = null;
    persistDb();
    return HttpResponse.json({ ok: true });
  }),

  // NFTs
  http.get("/api/nfts", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const db = getDb();
    if (db.scenario === "empty_catalog") {
      return HttpResponse.json({
        items: [],
        total: 0,
        page: 1,
        pageSize: 6,
        totalPages: 0,
      });
    }

    const url = new URL(request.url);
    const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
    const category = (url.searchParams.get("category") ?? "all") as
      NftCategory | "all";
    const edition = (url.searchParams.get("edition") ?? "all") as
      NftEdition | "all";
    const minPrice = url.searchParams.get("minPrice") ?? "";
    const maxPrice = url.searchParams.get("maxPrice") ?? "";
    const sort = (url.searchParams.get("sort") ?? "featured") as NftSortOption;
    const page = Math.max(1, Number(url.searchParams.get("page") ?? "1") || 1);
    const pageSize = Math.max(
      1,
      Number(url.searchParams.get("pageSize") ?? "6") || 6,
    );

    let filtered = Array.isArray(db.nfts) ? [...db.nfts] : [];

    if (q) {
      filtered = filtered.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.creatorName.toLowerCase().includes(q) ||
          item.collectionName.toLowerCase().includes(q),
      );
    }

    if (category && category !== "all") {
      filtered = filtered.filter((item) => item.category === category);
    }

    if (edition && edition !== "all") {
      filtered = filtered.filter((item) => item.edition === edition);
    }

    if (minPrice) {
      try {
        const minWei = parseEthToWei(minPrice);
        filtered = filtered.filter(
          (item) => parseEthToWei(item.priceEth) >= minWei,
        );
      } catch {
        // Ignora filtro malformado
      }
    }

    if (maxPrice) {
      try {
        const maxWei = parseEthToWei(maxPrice);
        filtered = filtered.filter(
          (item) => parseEthToWei(item.priceEth) <= maxWei,
        );
      } catch {
        // Ignora filtro malformado
      }
    }

    if (sort === "price_asc") {
      filtered.sort((a, b) =>
        Number(parseEthToWei(a.priceEth) - parseEthToWei(b.priceEth)),
      );
    } else if (sort === "price_desc") {
      filtered.sort((a, b) =>
        Number(parseEthToWei(b.priceEth) - parseEthToWei(a.priceEth)),
      );
    } else if (sort === "newest") {
      filtered.sort((a, b) => b.id.localeCompare(a.id));
    } else {
      filtered.sort(
        (a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)),
      );
    }

    const total = filtered.length;
    const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
    const safePage = totalPages === 0 ? 1 : Math.min(page, totalPages);
    const start = (safePage - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return HttpResponse.json({
      items,
      total,
      page: safePage,
      pageSize,
      totalPages,
    });
  }),

  http.get("/api/nfts/:nftId", async ({ params }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const nftId = String(params.nftId ?? "");
    const nft = getDb().nfts.find((n) => n.id === nftId || n.slug === nftId);
    if (!nft) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "NFT não encontrado no catálogo.",
      });
    }
    return HttpResponse.json(nft);
  }),

  // Favoritos
  http.get("/api/favorites", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const items = getDb().nfts.filter((n) => user.favorites.includes(n.id));
    return HttpResponse.json({ ids: user.favorites, items });
  }),

  http.post("/api/favorites/:nftId", async ({ params }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const nftId = String(params.nftId ?? "");
    const exists = getDb().nfts.some((n) => n.id === nftId);
    if (!exists) {
      return jsonError(404, { code: "NOT_FOUND", message: "NFT inexistente." });
    }

    if (!user.favorites.includes(nftId)) {
      user.favorites.push(nftId);
      persistDb();
    }
    return HttpResponse.json({ ids: user.favorites });
  }),

  http.delete("/api/favorites/:nftId", async ({ params }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const nftId = String(params.nftId ?? "");
    user.favorites = user.favorites.filter((id) => id !== nftId);
    persistDb();
    return HttpResponse.json({ ids: user.favorites });
  }),

  // Carrinho e Cotação
  http.get("/api/cart", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { items, priceOrStockChanged } = buildCartItems();
    return HttpResponse.json({
      items,
      priceOrStockChanged,
      couponCode: getDb().appliedCoupon,
    });
  }),

  http.post("/api/cart/items", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      nftId?: string;
      quantity?: number;
    };
    const nftId = body.nftId ?? "";
    const quantity = Number(body.quantity ?? 1);

    if (!nftId || !Number.isInteger(quantity) || quantity <= 0) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Quantidade inválida.",
      });
    }

    const db = getDb();
    const nft = db.nfts.find((n) => n.id === nftId);
    if (!nft) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "NFT não encontrado.",
      });
    }
    if (nft.availableStock <= 0) {
      return jsonError(409, {
        code: "UNAVAILABLE_STOCK",
        message: "Este NFT está esgotado no momento.",
      });
    }

    const maxAllowed = Math.min(nft.availableStock, nft.maxPerOrder);
    const rawCart = getActiveCartRaw();
    const existing = rawCart.find((c) => c.nftId === nft.id);
    const nextQty = (existing?.quantity ?? 0) + quantity;

    if (nextQty > maxAllowed) {
      return jsonError(409, {
        code: "UNAVAILABLE_STOCK",
        message: `Limite máximo permitido: ${maxAllowed} unidade(s).`,
      });
    }

    if (existing) {
      existing.quantity = nextQty;
      existing.unitPriceEth = nft.priceEth;
      existing.version = nft.version;
    } else {
      rawCart.push({
        nftId: nft.id,
        quantity: nextQty,
        unitPriceEth: nft.priceEth,
        version: nft.version,
      });
    }

    persistDb();
    return HttpResponse.json(buildCartItems(), { status: 201 });
  }),

  http.patch("/api/cart/items/:nftId", async ({ params, request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      quantity?: number;
    };
    const quantity = Number(body.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Quantidade deve ser um número inteiro maior ou igual a zero.",
      });
    }

    const db = getDb();
    const nft = db.nfts.find((n) => n.id === String(params.nftId));
    if (!nft) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "NFT não encontrado.",
      });
    }

    const rawCart = getActiveCartRaw();
    const idx = rawCart.findIndex((c) => c.nftId === nft.id);
    if (idx === -1) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "Item não está no carrinho.",
      });
    }

    if (quantity === 0) {
      rawCart.splice(idx, 1);
    } else {
      const maxAllowed = Math.min(nft.availableStock, nft.maxPerOrder);
      if (quantity > maxAllowed) {
        return jsonError(409, {
          code: "UNAVAILABLE_STOCK",
          message: `Quantidade indisponível. Máximo permitido: ${maxAllowed}.`,
        });
      }
      rawCart[idx].quantity = quantity;
    }

    persistDb();
    return HttpResponse.json(buildCartItems());
  }),

  http.delete("/api/cart/items/:nftId", async ({ params }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const rawCart = getActiveCartRaw();
    const next = rawCart.filter((c) => c.nftId !== String(params.nftId));
    const user = getCurrentUser();
    if (user) {
      user.cart = next;
    } else {
      getDb().guestCart = next;
    }
    persistDb();
    return HttpResponse.json(buildCartItems());
  }),

  http.post("/api/cart/sync-prices", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    syncCartWithCurrentPrices();
    return HttpResponse.json(calculateQuote());
  }),

  http.post("/api/quote", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const body = (await request.json().catch(() => ({}))) as {
      couponCode?: string | null;
      clearCoupon?: boolean;
    };

    const db = getDb();
    if (body.clearCoupon) {
      db.appliedCoupon = null;
      persistDb();
      return HttpResponse.json(calculateQuote(null));
    }

    if (typeof body.couponCode === "string" && body.couponCode.trim() !== "") {
      const normalized = body.couponCode.trim().toUpperCase();
      if (normalized !== "KURIO10") {
        return jsonError(400, {
          code: "INVALID_COUPON",
          message: "Cupom inválido ou expirado. Tente KURIO10.",
        });
      }
      db.appliedCoupon = normalized;
      persistDb();
    }

    return HttpResponse.json(calculateQuote());
  }),

  // Pedidos (idempotentes)
  http.post("/api/orders", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const idempotencyKey = request.headers.get("Idempotency-Key")?.trim() ?? "";
    if (!idempotencyKey) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Cabeçalho Idempotency-Key é obrigatório para criar pedido.",
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      buyerName?: string;
      buyerEmail?: string;
      walletId?: "primary" | "secondary";
      network?: NetworkId;
      quoteToken?: string;
    };

    const db = getDb();
    const existingOrder = db.orders.find(
      (o) =>
        o.userId === user.profile.id && o.idempotencyKey === idempotencyKey,
    );

    if (existingOrder) {
      const existingWalletId =
        user.wallets.find((w) => w.address === existingOrder.walletAddress)
          ?.id ?? "primary";
      const existingSnapshot = existingOrder.items
        .map((i) => `${i.nftId}:${i.quantity}:${i.unitPriceEth}`)
        .join("|");

      const requestedWalletId = body.walletId ?? existingWalletId;
      const requestedNetwork = body.network ?? existingOrder.network;
      const payloadMatches =
        requestedWalletId === existingWalletId &&
        requestedNetwork === existingOrder.network &&
        (!body.quoteToken || body.quoteToken === existingSnapshot);

      // Reutilizar a mesma chave com conteúdo diferente deve gerar conflito (409)
      if (!payloadMatches) {
        return jsonError(409, {
          code: "CONFLICT",
          message:
            "Chave de idempotência reutilizada com dados diferentes do pedido original.",
        });
      }

      // Pedidos confirmados ou recusados são terminais
      if (
        existingOrder.status === "confirmed" ||
        existingOrder.status === "rejected"
      ) {
        return HttpResponse.json(existingOrder);
      }

      if (
        db.scenario === "order_timeout_then_confirm" &&
        existingOrder.status === "pending"
      ) {
        const confirmed =
          finalizeOrderStatus(existingOrder.id, "confirmed") ?? existingOrder;
        persistDb();
        return HttpResponse.json(confirmed);
      }

      return HttpResponse.json(existingOrder);
    }

    if (db.scenario === "price_changed_checkout") {
      const targetNft = db.nfts.find((n) =>
        user.cart.some((c) => c.nftId === n.id),
      );
      if (targetNft) {
        targetNft.priceEth = "2.95";
        targetNft.version += 1;
        persistDb();
        emitNftUpdated({
          eventId: nextEventId(),
          version: targetNft.version,
          occurredAt: new Date().toISOString(),
          nftId: targetNft.id,
          priceEth: targetNft.priceEth,
          availableStock: targetNft.availableStock,
        });
      }
      return jsonError(409, {
        code: "PRICE_CHANGED",
        message:
          "O preço de um item foi atualizado. Revise e confirme novamente.",
      });
    }

    const quote = calculateQuote();
    if (quote.items.length === 0) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Seu carrinho está vazio.",
      });
    }

    for (const item of quote.items) {
      const nft = db.nfts.find((n) => n.id === item.nftId);
      if (!nft || nft.availableStock < item.quantity) {
        return jsonError(409, {
          code: "UNAVAILABLE_STOCK",
          message: `Estoque insuficiente para ${item.title}.`,
        });
      }
      if (nft.priceEth !== item.unitPriceEth) {
        return jsonError(409, {
          code: "PRICE_CHANGED",
          message: `O preço de ${item.title} mudou para ${nft.priceEth} ETH.`,
        });
      }
    }

    const selectedWallet =
      user.wallets.find((w) => w.id === body.walletId) ?? user.wallets[0];
    const network = body.network ?? selectedWallet?.network ?? "ethereum";
    const orderId = `ord-${Date.now()}`;
    const nowIso = new Date().toISOString();

    const order: OrderRecord = {
      id: orderId,
      userId: user.profile.id,
      idempotencyKey,
      status: "pending",
      createdAt: nowIso,
      updatedAt: nowIso,
      version: 1,
      txHash: `0x${Math.random().toString(16).slice(2).padEnd(64, "0").slice(0, 64)}`,
      explorerUrl: `https://sepolia.etherscan.io/tx/0x${orderId}`,
      network,
      walletAddress:
        selectedWallet?.address ?? "0x71C95911E9a5D330f4D621842EC243EE1343292e",
      buyerName:
        (body.buyerName ?? user.profile.name).trim() || user.profile.name,
      buyerEmail:
        (body.buyerEmail ?? user.profile.email).trim() || user.profile.email,
      couponCode: quote.couponCode,
      subtotalEth: quote.subtotalEth,
      discountEth: quote.discountEth,
      networkFeeEth: quote.networkFeeEth,
      totalEth: quote.totalEth,
      items: createOrderSnapshotItems(quote.items),
    };

    db.orders.unshift(order);
    persistDb();

    if (db.scenario === "order_timeout_then_confirm") {
      setTimeout(() => {
        const finalized = finalizeOrderStatus(order.id, "confirmed");
        if (finalized) {
          persistDb();
          emitOrderUpdated({
            eventId: nextEventId(),
            version: finalized.version,
            occurredAt: new Date().toISOString(),
            orderId: finalized.id,
            userId: finalized.userId,
            status: finalized.status,
          });
        }
      }, 1500);

      return jsonError(504, {
        code: "TRANSIENT_ERROR",
        message:
          "Tempo limite esgotado ao aguardar confirmação da rede. Você pode consultar ou tentar novamente com segurança.",
      });
    }

    if (db.scenario === "payment_rejected") {
      const rejected = finalizeOrderStatus(
        order.id,
        "rejected",
        "Pagamento recusado pela carteira simulada.",
      );
      persistDb();
      return HttpResponse.json(rejected ?? order, { status: 201 });
    }

    const confirmed = finalizeOrderStatus(order.id, "confirmed") ?? order;
    persistDb();
    return HttpResponse.json(confirmed, { status: 201 });
  }),

  http.get("/api/orders", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const orders = getDb().orders.filter((o) => o.userId === user.profile.id);
    return HttpResponse.json({ items: orders });
  }),

  http.get("/api/orders/:orderId", async ({ params }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const order = getDb().orders.find((o) => o.id === String(params.orderId));
    if (!order) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "Pedido não encontrado.",
      });
    }
    if (order.userId !== user.profile.id) {
      return jsonError(403, {
        code: "FORBIDDEN",
        message: "Acesso negado a este pedido.",
      });
    }
    return HttpResponse.json(order);
  }),

  // Perfil
  http.get("/api/profile", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    return HttpResponse.json(user.profile);
  }),

  http.patch("/api/profile", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const body = (await request.json().catch(() => ({}))) as {
      name?: string;
      handle?: string;
      bio?: string;
      avatarUrl?: string;
    };

    const name = (body.name ?? user.profile.name).trim();
    if (name.length < 2) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Nome deve ter pelo menos 2 caracteres.",
        details: { name: "Nome inválido." },
      });
    }

    user.profile.name = name;
    if (typeof body.handle === "string" && body.handle.trim()) {
      user.profile.handle = body.handle.trim();
    }
    if (typeof body.bio === "string") {
      user.profile.bio = body.bio.trim();
    }
    if (typeof body.avatarUrl === "string" && body.avatarUrl.trim()) {
      user.profile.avatarUrl = body.avatarUrl.trim();
    }

    persistDb();
    return HttpResponse.json(user.profile);
  }),

  http.post("/api/profile/password", async ({ request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const body = (await request.json().catch(() => ({}))) as {
      currentPassword?: string;
      newPassword?: string;
    };

    if (!body.currentPassword || body.currentPassword !== user.password) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "Senha atual incorreta.",
        details: { currentPassword: "Senha atual não confere." },
      });
    }

    if (!body.newPassword || body.newPassword.length < 6) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message: "A nova senha deve ter pelo menos 6 caracteres.",
        details: { newPassword: "Mínimo de 6 caracteres." },
      });
    }

    user.password = body.newPassword;
    persistDb();
    return HttpResponse.json({ ok: true });
  }),

  // Carteiras
  http.get("/api/wallets", async () => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    return HttpResponse.json({ items: user.wallets });
  }),

  http.put("/api/wallets/:walletId", async ({ params, request }) => {
    const blocked = await applyScenarioGate();
    if (blocked) return blocked;

    const { user, error } = requireAuthOrError();
    if (error || !user) return error;

    const walletId = String(params.walletId);
    const wallet = user.wallets.find((w) => w.id === walletId);
    if (!wallet) {
      return jsonError(404, {
        code: "NOT_FOUND",
        message: "Carteira não encontrada.",
      });
    }

    const body = (await request.json().catch(() => ({}))) as {
      label?: string;
      address?: string;
      network?: NetworkId;
    };

    const address = (body.address ?? wallet.address).trim();
    if (!/^0x[a-fA-F0-9]{10,42}$/.test(address)) {
      return jsonError(400, {
        code: "VALIDATION_ERROR",
        message:
          "Endereço de carteira inválido. Use formato hexadecimal começando com 0x.",
        details: { address: "Endereço inválido (ex.: 0x71C9...)." },
      });
    }

    if (typeof body.label === "string" && body.label.trim()) {
      wallet.label = body.label.trim();
    }
    wallet.address = address;
    if (body.network) {
      wallet.network = body.network;
    }

    persistDb();
    return HttpResponse.json(wallet);
  }),
];
