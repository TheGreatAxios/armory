export class X402ClientError extends Error {
  override readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.name = "X402ClientError";
    this.cause = cause;
  }
}

export class SigningError extends X402ClientError {
  constructor(message: string, cause?: unknown) {
    super(`Signing failed: ${message}`, cause);
    this.name = "SigningError";
  }
}

export class PaymentError extends X402ClientError {
  constructor(message: string, cause?: unknown) {
    super(`Payment failed: ${message}`, cause);
    this.name = "PaymentError";
  }
}

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
