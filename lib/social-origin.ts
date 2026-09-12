/** Use the configured public origin when a local reverse proxy rewrites request URLs. */
export function socialOrigin(request: Request): string {
  const configured = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  return new URL(configured || request.url).origin;
}

export function validSocialOrigin(request: Request): boolean {
  return request.headers.get("Origin") === socialOrigin(request);
}
