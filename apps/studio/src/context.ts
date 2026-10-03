import type { HonoApp } from '@repo/hono-helpers'
import type { SharedHonoEnv, SharedHonoVariables } from '@repo/hono-helpers/src/types'

export type Env = SharedHonoEnv & {
	/**
	 * Shared Secrets Store binding for the HS256 JWT signing key. Resolve the value with
	 * `await env.JWT_SECRET.get()`; every worker binds the same store, so tokens signed by
	 * `auth` verify here.
	 */
	JWT_SECRET: SecretsStoreSecret
	// Shared `recflare` D1. Read-only here: room ownership lives in the `room` blob
	// (the `rooms` worker owns that schema) and who is standing where lives in
	// `presence` (the `match` worker writes it, the `rooms` worker migrates it).
	// No migrations_dir — this worker does not own a table.
	DB: D1Database
}

/** Variables can be extended */
export type Variables = SharedHonoVariables

export interface App extends HonoApp {
	Bindings: Env
	Variables: Variables
}
