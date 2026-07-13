import { Effect } from 'effect'
import type { Either } from 'effect'

const DEFAULT_ERROR_MESSAGE = 'Something went wrong — try again.'

export class AppError extends Error {
  readonly _tag = 'AppError'

  constructor(
    message: string,
    readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function getErrorMessage(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): string {
  if (error instanceof Error && error.message.trim()) return error.message
  if (typeof error === 'string' && error.trim()) return error
  return fallback
}

export function toAppError(error: unknown, fallback = DEFAULT_ERROR_MESSAGE): AppError {
  return error instanceof AppError ? error : new AppError(getErrorMessage(error, fallback), error)
}

export function attempt<A>(
  operation: (signal: AbortSignal) => PromiseLike<A>,
  fallback = DEFAULT_ERROR_MESSAGE,
): Effect.Effect<A, AppError> {
  return Effect.tryPromise({
    try: operation,
    catch: (error) => toAppError(error, fallback),
  })
}

export function runResult<A, E>(effect: Effect.Effect<A, E>): Promise<Either.Either<A, E>> {
  return Effect.runPromise(Effect.either(effect))
}

export function originalError(error: AppError): unknown {
  return error.cause ?? error
}
