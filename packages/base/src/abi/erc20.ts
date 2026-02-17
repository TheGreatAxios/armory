export type TransferWithAuthorizationParams = readonly [
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
  validAfter: bigint,
  expiry: bigint,
  v: number,
  r: `0x${string}`,
  s: `0x${string}`,
];

export type ReceiveWithAuthorizationParams = readonly [
  from: `0x${string}`,
  to: `0x${string}`,
  amount: bigint,
  validAfter: bigint,
  expiry: bigint,
  v: number,
  r: `0x${string}`,
  s: `0x${string}`,
];

export type BalanceOfParams = readonly [account: `0x${string}`];
export type BalanceOfReturnType = bigint;
export type NameReturnType = string;
export type SymbolReturnType = string;

export const ERC20_ABI = [
  {
    type: "function",
    name: "transferWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "receiveWithAuthorization",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "expiry", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "balanceOf",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "balance", type: "uint256" }],
  },
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
  },
] as const;

export type ERC20Abi = typeof ERC20_ABI;
