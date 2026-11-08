const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
const PREFIX_LENGTH = /^(0|[1-9]\d{0,2})$/;

/** `::ffff:0:0/96`, where IPv4 addresses sit in IPv6. */
const IPV4_MAPPED_PREFIX = 0xffffn;

interface Range {
  network: bigint;
  ipv6Prefix: number;
}

export const PRIVATE_NETWORKS = [
  "127.0.0.0/8",
  "10.0.0.0/8",
  "172.16.0.0/12",
  "192.168.0.0/16",
  "::1",
  "fc00::/7",
] as const;

export function proxyEntryProblem(entry: string): string | undefined {
  const range = parseRange(entry);
  return typeof range === "string" ? range : undefined;
}

export function clientAddress(
  peer: string | undefined,
  forwardedFor: string | undefined,
  trustedProxies: readonly string[],
): string | undefined {
  if (peer === undefined) return undefined;
  const address = unmapIpv4(peer);
  const ranges = trustedRanges(trustedProxies);
  if (!forwardedFor || !isTrusted(address, ranges)) return address;
  const hops = forwardedFor
    .split(",")
    .map((hop) => unmapIpv4(hop.trim()))
    .filter(Boolean);
  return rightmostUntrustedHop(hops, ranges) ?? address;
}

/** An IPv6 host usually holds a whole /64 and can pick any address in it. */
export function rateLimitKey(address: string): string {
  const ip = parseAsIpv6(address);
  if (ip === undefined) return address;
  if (ip >> 32n === IPV4_MAPPED_PREFIX) {
    return [24n, 16n, 8n, 0n].map((shift) => (ip >> shift) & 0xffn).join(".");
  }
  const hextets = [112n, 96n, 80n, 64n].map((shift) => ((ip >> shift) & 0xffffn).toString(16));
  return `${hextets.join(":")}::/64`;
}

/**
 * Each proxy appends the address it saw, so only hops right of the first
 * untrusted one were written by trusted proxies; everything left of it is the
 * client's own text. With every hop trusted, the leftmost is the client.
 */
function rightmostUntrustedHop(hops: readonly string[], ranges: readonly Range[]) {
  return hops.findLast((hop) => !isTrusted(hop, ranges)) ?? hops[0];
}

function isTrusted(address: string, ranges: readonly Range[]): boolean {
  const ip = parseAsIpv6(address);
  if (ip === undefined) return false;
  return ranges.some(({ network, ipv6Prefix }) => {
    const hostBits = BigInt(128 - ipv6Prefix);
    return ip >> hostBits === network >> hostBits;
  });
}

const parsedRanges = new WeakMap<readonly string[], readonly Range[]>();

function trustedRanges(entries: readonly string[]): readonly Range[] {
  let ranges = parsedRanges.get(entries);
  if (ranges === undefined) {
    ranges = entries.map(parseRange).filter((range) => typeof range !== "string");
    parsedRanges.set(entries, ranges);
  }
  return ranges;
}

/**
 * A prefix applies to the notation it is written in, so `::ffff:10.0.0.0/8`
 * is `::/8`, not `10.0.0.0/8`. Rejecting set host bits catches that slip and
 * any other entry that would trust more than it names.
 */
function parseRange(entry: string): Range | string {
  const [address = "", prefix, extra] = entry.split("/");
  const network = extra === undefined ? parseAsIpv6(address) : undefined;
  if (network === undefined) {
    return `"${entry}" is not an IPv4 or IPv6 address or range; write none, or a list such as 10.0.0.0/8,fd00::/8`;
  }
  if (prefix === undefined) return { network, ipv6Prefix: 128 };
  const width = IPV4.test(address) ? 32 : 128;
  if (!PREFIX_LENGTH.test(prefix) || Number(prefix) > width) {
    return `"${entry}" needs a prefix length from 0 to ${width}`;
  }
  const ipv6Prefix = 128 - width + Number(prefix);
  const hostMask = (1n << BigInt(128 - ipv6Prefix)) - 1n;
  if ((network & hostMask) !== 0n) {
    return `"${entry}" has bits set past its /${prefix} prefix, so it trusts more than it names; write the range's first address, and IPv4 ranges in IPv4 form (10.0.0.0/8)`;
  }
  return { network, ipv6Prefix };
}

function parseAsIpv6(address: string): bigint | undefined {
  if (IPV4.test(address)) {
    const ipv4 = address.split(".").reduce((n, octet) => (n << 8n) | BigInt(octet), 0n);
    return (IPV4_MAPPED_PREFIX << 32n) | ipv4;
  }
  if (!address.includes(":") || !/^[\d.:a-f]+$/i.test(address)) return undefined;
  let hostname: string;
  try {
    hostname = new URL(`http://[${address}]`).hostname;
  } catch {
    return undefined;
  }
  // The URL parser serializes IPv6 as hex groups with at most one `::`.
  const [head = "", tail] = hostname.slice(1, -1).split("::");
  const groups = (part: string | undefined) => (part ? part.split(":") : []);
  const zeros =
    tail === undefined
      ? []
      : Array<string>(8 - groups(head).length - groups(tail).length).fill("0");
  return [...groups(head), ...zeros, ...groups(tail)].reduce(
    (n, group) => (n << 16n) | BigInt(`0x${group}`),
    0n,
  );
}

/** Node reports an IPv4 peer on a dual-stack socket as `::ffff:a.b.c.d`. */
function unmapIpv4(address: string): string {
  const unmapped = address.replace(/^::ffff:/i, "");
  return IPV4.test(unmapped) ? unmapped : address;
}
