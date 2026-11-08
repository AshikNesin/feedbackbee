import { config } from "../config";
import type { AppContext } from "../types";
import { clientAddress } from "./client-address";

/**
 * Says which address sent a request, or `undefined` when it cannot tell. The
 * runtime supplies one through `createApp({ clientAddress })`, because only
 * the entry knows where the connection's peer lives.
 */
export type ClientAddressResolver = (c: AppContext) => string | undefined;

/**
 * For a server that sees the connection: the peer `peer(c)` returns, or, when
 * that peer is one of `config.trustedProxies`, the hop it vouches for in
 * `X-Forwarded-For` (the rightmost hop that is not a trusted proxy). The Node
 * entry passes the socket's remote address.
 */
export function peerClientAddress(
  peer: (c: AppContext) => string | undefined,
): ClientAddressResolver {
  return (c) => clientAddress(peer(c), c.req.header("x-forwarded-for"), config.trustedProxies);
}

/**
 * For Workers: there is no socket, and Cloudflare's edge sets
 * `cf-connecting-ip`, overwriting any client-sent value, so that header is
 * the client.
 */
export const cloudflareClientAddress: ClientAddressResolver = (c) =>
  c.req.header("cf-connecting-ip");

/**
 * What an app whose entry passes no resolver gets: @hono/node-server's
 * socket peer through `peerClientAddress` when the request has one, else
 * `cf-connecting-ip`. Entries should pass their own resolver instead.
 */
export const defaultClientAddress: ClientAddressResolver = (c) => {
  const incoming = c.env?.incoming as { socket?: { remoteAddress?: string } } | undefined;
  const peer = incoming?.socket?.remoteAddress;
  if (peer === undefined) return cloudflareClientAddress(c);
  return clientAddress(peer, c.req.header("x-forwarded-for"), config.trustedProxies);
};
