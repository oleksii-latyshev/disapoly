import { routePartykitRequest } from "partyserver"

import { DisapolyServer, type Env } from "./disapoly-server"

export { DisapolyServer }

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return (
      (await routePartykitRequest(request, env)) ??
      new Response("Not found", { status: 404 })
    )
  },
}
