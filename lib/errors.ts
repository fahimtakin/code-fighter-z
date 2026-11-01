/**
 * Throw from anywhere to send a clean JSON error with this status. It lives
 * apart from lib/http.ts so domain code never imports Next.js (the Socket.IO
 * server loads that code before Next has started).
 */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
}
