import type { EthAmount } from "@/contracts/marketplace";

const WEI_DECIMALS = 18n;
const WEI_FACTOR = 10n ** WEI_DECIMALS;

export function parseEthToWei(eth: string): bigint {
  const normalized = eth.trim().replace(",", ".");
  if (!normalized || !/^\d+(\.\d+)?$/.test(normalized)) {
    throw new Error(`Valor ETH inválido: ${eth}`);
  }
  const [intPart, fracPart = ""] = normalized.split(".");
  const paddedFrac = fracPart.padEnd(18, "0").slice(0, 18);
  return BigInt(intPart) * WEI_FACTOR + BigInt(paddedFrac);
}

export function formatWeiToEth(wei: bigint, maxDecimals = 4): EthAmount {
  const negative = wei < 0n;
  const absWei = negative ? -wei : wei;
  const intPart = absWei / WEI_FACTOR;
  const fracPart = (absWei % WEI_FACTOR).toString().padStart(18, "0");

  const trimmedFrac = fracPart.slice(0, maxDecimals).replace(/0+$/, "");
  const sign = negative ? "-" : "";
  return trimmedFrac ? `${sign}${intPart}.${trimmedFrac}` : `${sign}${intPart}`;
}

export function addEth(a: EthAmount, b: EthAmount): EthAmount {
  return formatWeiToEth(parseEthToWei(a) + parseEthToWei(b));
}

export function subEth(a: EthAmount, b: EthAmount): EthAmount {
  const res = parseEthToWei(a) - parseEthToWei(b);
  return formatWeiToEth(res < 0n ? 0n : res);
}

export function mulEthByInt(eth: EthAmount, qty: number): EthAmount {
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error(`Quantidade inválida para cálculo em ETH: ${qty}`);
  }
  return formatWeiToEth(parseEthToWei(eth) * BigInt(qty));
}

export function compareEth(a: EthAmount, b: EthAmount): number {
  const diff = parseEthToWei(a) - parseEthToWei(b);
  if (diff < 0n) return -1;
  if (diff > 0n) return 1;
  return 0;
}

export function formatEthLabel(eth: EthAmount): string {
  return `${eth} ETH`;
}
