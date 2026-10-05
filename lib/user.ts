import { headers } from "next/headers"

/**
 * Name of the Snowflake user calling the app. SPCS ingress injects the
 * `sf-context-current-user` header; locally there is none, so fall back to "local".
 */
export async function currentUser(): Promise<string> {
  const user = (await headers()).get("sf-context-current-user")
  return user && user.trim() ? user.trim() : "local"
}
