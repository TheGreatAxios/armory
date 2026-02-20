import type {
  Address,
  Extensions,
  PaymentPayloadV2,
  PaymentRequirementsV2,
} from "@armory-sh/base";
import {
  getNetworkByChainId,
  getToken,
  normalizeNetworkName,
} from "@armory-sh/base";

export interface PaymentRequiredContext {
  url: RequestInfo | URL;
  requestInit: RequestInit | undefined;
  accepts: PaymentRequirementsV2[];
  requirements: PaymentRequirementsV2;
  selectedRequirement?: PaymentRequirementsV2;
  serverExtensions: Extensions | undefined;
  fromAddress: Address;
  nonce: `0x${string}`;
  validBefore: number;
}

export interface PaymentPayloadContext<TWallet = unknown> {
  payload: PaymentPayloadV2;
  requirements: PaymentRequirementsV2;
  wallet: TWallet;
  paymentContext: PaymentRequiredContext;
}

export interface ClientHookErrorContext {
  error: unknown;
  phase:
    | "onPaymentRequired"
    | "selectRequirement"
    | "beforeSignPayment"
    | "afterPaymentResponse";
}

export interface ClientHook<TWallet = unknown> {
  name?: string;
  onPaymentRequired?: (context: PaymentRequiredContext) => void | Promise<void>;
  selectRequirement?: (
    context: PaymentRequiredContext,
  ) =>
    | PaymentRequirementsV2
    | undefined
    | Promise<PaymentRequirementsV2 | undefined>;
  beforeSignPayment?: (
    context: PaymentPayloadContext<TWallet>,
  ) => void | Promise<void>;
  afterPaymentResponse?: (
    context: PaymentPayloadContext<TWallet> & { response: Response },
  ) => void | Promise<void>;
  onError?: (context: ClientHookErrorContext) => void | Promise<void>;
}

type LoggerOptions = {
  prefix?: string;
  enabled?: boolean;
};

const toArray = (value: string | string[]): string[] =>
  Array.isArray(value) ? value : [value];

const normalize = (value: string): string => value.trim().toLowerCase();

const parseChainId = (network: string): number | undefined => {
  if (!network.startsWith("eip155:")) {
    return undefined;
  }
  const chainId = Number.parseInt(network.slice("eip155:".length), 10);
  return Number.isFinite(chainId) ? chainId : undefined;
};

const getNetworkAliases = (requirement: PaymentRequirementsV2): string[] => {
  const aliases = [normalize(requirement.network)];
  const chainId = parseChainId(requirement.network);
  if (chainId !== undefined) {
    const network = getNetworkByChainId(chainId);
    if (network) {
      aliases.push(normalize(normalizeNetworkName(network.name)));
    }
  }
  return aliases;
};

const getTokenSymbol = (
  requirement: PaymentRequirementsV2,
): string | undefined => {
  const chainId = parseChainId(requirement.network);
  if (chainId === undefined) {
    return undefined;
  }
  const token = getToken(chainId, requirement.asset);
  return token?.symbol ? normalize(token.symbol) : undefined;
};

const selectFirstMatching = (
  accepts: PaymentRequirementsV2[],
  predicate: (requirement: PaymentRequirementsV2) => boolean,
): PaymentRequirementsV2 | undefined => {
  for (const requirement of accepts) {
    if (predicate(requirement)) {
      return requirement;
    }
  }
  return undefined;
};

const parseAmount = (amount: string): bigint | undefined => {
  try {
    return BigInt(amount);
  } catch {
    return undefined;
  }
};

export const combineHooks = <TWallet>(
  ...hooks: Array<ClientHook<TWallet> | ClientHook<TWallet>[] | undefined>
): ClientHook<TWallet>[] =>
  hooks
    .flatMap((hook) => (Array.isArray(hook) ? hook : [hook]))
    .filter(Boolean) as ClientHook<TWallet>[];

export const PaymentPreference = {
  chain<TWallet = unknown>(
    preferredChains: string | string[],
  ): ClientHook<TWallet> {
    const ranked = toArray(preferredChains).map(normalize);
    return {
      name: "PaymentPreference.chain",
      selectRequirement: (context) => {
        for (const preferred of ranked) {
          const candidate = selectFirstMatching(
            context.accepts,
            (requirement) =>
              getNetworkAliases(requirement).some(
                (alias) => alias === preferred || alias.includes(preferred),
              ),
          );
          if (candidate) {
            return candidate;
          }
        }
        return undefined;
      },
    };
  },
  token<TWallet = unknown>(
    preferredTokens: string | string[],
  ): ClientHook<TWallet> {
    const ranked = toArray(preferredTokens).map(normalize);
    return {
      name: "PaymentPreference.token",
      selectRequirement: (context) => {
        const selectedChain = context.selectedRequirement?.network;
        const inSelectedChain = selectedChain
          ? context.accepts.filter(
              (requirement) => requirement.network === selectedChain,
            )
          : context.accepts;

        for (const preferred of ranked) {
          const candidate = selectFirstMatching(
            inSelectedChain,
            (requirement) => {
              const asset = normalize(requirement.asset);
              const symbol = getTokenSymbol(requirement);
              return asset === preferred || symbol === preferred;
            },
          );
          if (candidate) {
            return candidate;
          }
        }
        return undefined;
      },
    };
  },
  cheapest<TWallet = unknown>(): ClientHook<TWallet> {
    return {
      name: "PaymentPreference.cheapest",
      selectRequirement: (context) => {
        const selectedRequirement = context.selectedRequirement;
        if (!selectedRequirement) {
          return undefined;
        }
        const candidates = context.accepts.filter(
          (requirement) =>
            requirement.network === selectedRequirement.network &&
            requirement.asset === selectedRequirement.asset,
        );
        const [first] = candidates;
        if (!first) {
          return undefined;
        }
        let cheapest = first;
        let selectedAmount = parseAmount(first.amount);
        for (const requirement of candidates) {
          const nextAmount = parseAmount(requirement.amount);
          if (
            nextAmount !== undefined &&
            selectedAmount !== undefined &&
            nextAmount < selectedAmount
          ) {
            cheapest = requirement;
            selectedAmount = nextAmount;
          }
        }
        return cheapest;
      },
    };
  },
};

export const Logger = {
  console<TWallet = unknown>(options: LoggerOptions = {}): ClientHook<TWallet> {
    const enabled = options.enabled ?? true;
    const prefix = options.prefix ?? "[x402]";
    return {
      name: "Logger.console",
      onPaymentRequired: (context) => {
        if (!enabled) {
          return;
        }
        console.log(`${prefix} payment required`, {
          accepts: context.accepts.map((requirement) => ({
            network: requirement.network,
            asset: requirement.asset,
            amount: requirement.amount,
          })),
        });
      },
      afterPaymentResponse: (context) => {
        if (!enabled) {
          return;
        }
        console.log(`${prefix} payment response`, {
          status: context.response.status,
        });
      },
      onError: (context) => {
        if (!enabled) {
          return;
        }
        console.error(`${prefix} hook error`, {
          phase: context.phase,
          error: context.error,
        });
      },
    };
  },
};

export type { PaymentRequirementsV2 };
