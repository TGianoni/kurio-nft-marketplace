import { toSocketIo } from "@mswjs/socket.io-binding";
import { ws } from "msw";
import type {
  NftUpdatedEvent,
  OrderUpdatedEvent,
} from "@/contracts/marketplace";

const wsLink = ws.link("ws://localhost:5173/socket.io/*");

type ClientConnection = ReturnType<typeof toSocketIo>["client"];
const activeClients = new Set<ClientConnection>();

export const socketHandlers = [
  wsLink.addEventListener("connection", (connection) => {
    const io = toSocketIo(connection);
    activeClients.add(io.client);

    connection.client.addEventListener("close", () => {
      activeClients.delete(io.client);
    });
  }),
];

export function emitNftUpdated(payload: NftUpdatedEvent) {
  for (const client of activeClients) {
    client.emit("nft.updated", payload);
  }
}

export function emitOrderUpdated(payload: OrderUpdatedEvent) {
  for (const client of activeClients) {
    client.emit("order.updated", payload);
  }
}
