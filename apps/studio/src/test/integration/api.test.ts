import { SELF } from 'cloudflare:test'
import { expect, it } from 'vitest'

it('response with hello world', async () => {
	const res = await SELF.fetch('https://example.com')
	expect(res.status).toBe(200)
	expect(await res.text()).toMatchInlineSnapshot(`"hello, world!"`)
})

it('lists no cloud builds for a room', async () => {
	const res = await SELF.fetch(
		'https://example.com/cloud-builds/for-room?roomId=1&subRoomId=1&skip=0&take=20'
	)
	expect(res.status).toBe(200)
	expect(await res.json()).toEqual({ results: [], totalResults: 0 })
})
