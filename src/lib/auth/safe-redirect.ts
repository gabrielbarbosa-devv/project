const allowedCallbackDestinations = new Set(["/", "/onboarding", "/redefinir-senha"]);

export function getSafeAuthDestination(requestedDestination: string | null): string {
  return requestedDestination && allowedCallbackDestinations.has(requestedDestination)
    ? requestedDestination
    : "/";
}

