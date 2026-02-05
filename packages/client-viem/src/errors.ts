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
