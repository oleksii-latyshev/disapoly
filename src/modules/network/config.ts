/**
 * Realtime server connection settings.
 *
 * The server runs as a Cloudflare Durable Object (via `partyserver`). Locally
 * `wrangler dev` serves it at `127.0.0.1:8787`; in production set
 * `VITE_PARTYKIT_HOST` to your deployed `*.workers.dev` host.
 */
export const PARTY_HOST: string =
  import.meta.env.VITE_PARTYKIT_HOST ?? "127.0.0.1:8787"

/**
 * Party name — must match the kebab-case of the Durable Object binding name
 * (`Game`) in wrangler.jsonc, since partyserver routes `/parties/<party>/<room>`.
 */
export const PARTY_NAME = "game"
