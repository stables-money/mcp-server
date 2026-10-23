/**
 * Stand-in for the `cloudflare:workers` module when the Worker code runs
 * under vitest on Node. The OAuth provider imports WorkerEntrypoint only to
 * recognise class-based handlers; ours are plain objects.
 */
export class WorkerEntrypoint<Env = unknown> {
  constructor(
    public ctx: unknown,
    public env: Env
  ) {}
}
