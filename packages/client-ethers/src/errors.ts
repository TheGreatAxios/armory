// Import shared error classes from @armory-sh/base
import {
  SigningError as BaseSigningError,
  X402ClientError,
} from "@armory-sh/base";

// Re-export shared error classes
export {
  PaymentException as PaymentError,
  X402ClientError,
} from "@armory-sh/base";
export { BaseSigningError as SigningError };

// Ethers-specific error classes
export class SignerRequiredError extends X402ClientError {
  constructor(message = "Signer is required for this operation") {
    super(message);
    this.name = "SignerRequiredError";
  }
}

export class AuthorizationError extends X402ClientError {
  constructor(message: string, cause?: unknown) {
    super(`Authorization failed: ${message}`, cause);
    this.name = "AuthorizationError";
  }
}

export class ProviderRequiredError extends X402ClientError {
  constructor(message = "Provider is required for this operation") {
    super(message);
    this.name = "ProviderRequiredError";
  }
}
