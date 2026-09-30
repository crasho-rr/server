import { Hono } from 'hono'
import { useWorkersLogger } from 'workers-tagged-logger'

import { withNotFound, withOnError } from '@repo/hono-helpers'

import type { App } from './context'

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

export default app
