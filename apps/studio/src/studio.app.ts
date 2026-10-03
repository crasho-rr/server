import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { getPlayerIdsInRoomSubRoom, getRoomCoOwnerIds } from '@repo/domain'
import { withNotFound, withOnError } from '@repo/hono-helpers'
import { validateAndGetAccountId } from '@repo/jwt'

import type { App } from './context'

/**
 * A query id the editor already validated as a positive integer. Anything else is
 * treated as "no such room" rather than an error: a non-2xx makes Studio throw
 * before it can show the empty co-owner list.
 */
function positiveId(raw: string | undefined): number | null {
	if (raw == null || !/^[1-9]\d*$/.test(raw)) return null
	const id = Number(raw)
	return Number.isSafeInteger(id) ? id : null
}

const app = new Hono<App>()
	.use(
		'*',
		// middleware
		(c, next) =>
			useWorkersLogger(c.env.NAME, {
				environment: c.env.ENVIRONMENT,
				release: c.env.SENTRY_RELEASE,
			})(c, next)
	)

	.onError(withOnError())
	.notFound(withNotFound())

	.get('/', async (c) => {
		return c.text('hello, world!')
	})

	// The editor lists a room's cloud builds with
	// GET /cloud-builds/for-room?roomId=&subRoomId=&skip=&take= on this host.
	// Nothing here builds rooms, so every room is an empty page. Studio reads
	// `results` and `totalResults` (camelCase) and treats any non-2xx as failure.
	.get('/cloud-builds/for-room', (c) => {
		return c.json({ results: [], totalResults: 0 })
	})

	// Who of this room's co-owners is standing in this subroom right now. Studio
	// shows them as "Co-owners in Room" and reads a Result<List<int>>: `success`
	// must be true and `error` null, or the editor throws; `value` is those
	// account ids (camelCase). An empty list is the "nobody here" state.
	//
	// Co-owners are the room's creator plus every Creator/CoOwner role. Presence
	// has to name this roomId AND this subRoomId — a co-owner in another subroom,
	// or in another room, is not in the list. Hosts and moderators are not
	// co-owners, and a pending co-owner invite is not a role yet.
	.get('/collaboration/owners-in-room', async (c) => {
		const accountId = await validateAndGetAccountId(c.req.raw, await c.env.JWT_SECRET.get())
		if (accountId == null) return c.body(null, 401)

		const roomId = positiveId(c.req.query('roomId'))
		const subRoomId = positiveId(c.req.query('subRoomId'))
		if (roomId == null || subRoomId == null) {
			return c.json({ success: true, error: null, value: [] })
		}

		const coOwners = await getRoomCoOwnerIds(c.env.DB, roomId)
		if (coOwners == null || coOwners.length === 0) {
			return c.json({ success: true, error: null, value: [] })
		}
		const present = new Set(await getPlayerIdsInRoomSubRoom(c.env.DB, roomId, subRoomId))
		return c.json({
			success: true,
			error: null,
			value: coOwners.filter((id) => present.has(id)),
		})
	})

export default app
