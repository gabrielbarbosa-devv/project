export function getEmailConfirmationRedirectUrl(origin: string): string {
  return new URL("/auth/confirm", origin).toString();
}

export function getPasswordRecoveryRedirectUrl(origin: string): string {
  const redirectUrl = new URL("/auth/confirm", origin);
  redirectUrl.searchParams.set("next", "/redefinir-senha");
  return redirectUrl.toString();
}
