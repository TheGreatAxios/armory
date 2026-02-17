/**
 * Generic Wallet Adapter Interface
 *
 * This interface defines the minimum wallet operations required
 * for x402 payment signing. Each client package implements this
 * interface for their specific wallet library (viem, ethers, etc.).
 */

export interface PaymentWallet {
  /**
   * Get the wallet address
   * Can be synchronous or asynchronous depending on the wallet library
   */
  getAddress(): string | Promise<string>;

  /**
   * Sign EIP-712 typed data
   * Used for EIP-3009 TransferWithAuthorization signatures
   *
   * @param domain - EIP-712 domain separator
   * @param types - EIP-712 type definitions
   * @param value - Message to sign
   * @returns Signature as hex string (0x-prefixed)
   */
  signTypedData(
    domain: Record<string, unknown>,
    types: Record<string, unknown>,
    value: Record<string, unknown>
  ): Promise<string>;
}
