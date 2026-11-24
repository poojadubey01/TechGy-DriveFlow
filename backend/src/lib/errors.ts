/** An error that is safe to show to the app: an HTTP status, a stable code and a human message. */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const badRequest = (code: string, message: string, details?: Record<string, unknown>) => new AppError(400, code, message, details);
export const unauthorized = (message = 'Please sign in again.') => new AppError(401, 'unauthorized', message);
export const forbidden = (code: string, message: string) => new AppError(403, code, message);
export const notFound = (what = 'That item') => new AppError(404, 'not_found', `${what} was not found.`);
export const conflict = (code: string, message: string) => new AppError(409, code, message);
export const tooMany = (message = 'Too many attempts. Please wait a minute and try again.') => new AppError(429, 'too_many_requests', message);
