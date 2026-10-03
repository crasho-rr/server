import { adminSecretsStore, env, SELF } from 'cloudflare:test'
import { beforeAll, describe, expect, it } from 'vitest'

import { PRESENCE_SCHEMA_DDL, ROOM_SCHEMA_DDL, setPresence } from '@repo/domain'

import type { Env } from '../../context'

declare module 'cloudflare:test' {
	interface ProvidedEnv extends Env {}
}

const ORIGIN = 'https://example.com'
const TEST_SECRET = 'test-signing-key'

function b64url(input: ArrayBuffer | string): string {
	const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : new Uint8Array(input)
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function bearer(sub: string): Promise<Record<string, string>> {
	const now = Math.floor(Date.now() / 1000)
	const signingInput = `${b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${b64url(
		JSON.stringify({ sub, exp: now + 3600 })
	)}`
	const key = await crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(TEST_SECRET),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign']
	)
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signingInput))
	return { Authorization: `Bearer ${signingInput}.${b64url(sig)}` }
}

async function insertRoom(roomId: number, creatorAccountId: number, roles: unknown[]): Promise<void> {
	await env.DB.prepare('INSERT INTO room (data) VALUES (?1)')
		.bind(
			JSON.stringify({
				RoomId: roomId,
				Name: `Room ${roomId}`,
				CreatorAccountId: creatorAccountId,
				IsDorm: false,
				Accessibility: 1,
				Roles: roles,
			})
		)
		.run()
}

async function standIn(
	accountId: number,
	roomId: number,
	subRoomId: number,
	{ expired = false }: { expired?: boolean } = {}
): Promise<void> {
	if (expired) {
		await env.DB.prepare('INSERT OR REPLACE INTO presence (data) VALUES (?1)')
			.bind(
				JSON.stringify({
					accountId,
					roomInstance: { roomInstanceId: 800000 + accountId, roomId, subRoomId },
					expiresAt: Math.floor(Date.now() / 1000) - 10,
				})
			)
			.run()
		return
	}
	await setPresence(env.DB, {
		accountId,
		roomInstance: { roomInstanceId: 800000 + accountId, roomId, subRoomId },
		statusVisibility: 0,
		deviceClass: 0,
		vrMovementMode: 0,
		platform: 0,
		appVersion: 'test',
	})
}

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

describe('GET /collaboration/owners-in-room', () => {
	const roomId = 1106
	const subRoomId = 22941

	beforeAll(async () => {
		await adminSecretsStore(env.JWT_SECRET).create(TEST_SECRET)
		for (const stmt of ROOM_SCHEMA_DDL) await env.DB.prepare(stmt).run()
		for (const stmt of PRESENCE_SCHEMA_DDL) await env.DB.prepare(stmt).run()
		// Creator 1, co-owner 7, another co-owner 11, moderator 8, pending invite 9.
		await insertRoom(roomId, 1, [
			{ AccountId: 1, Role: 255, InvitedRole: 0 },
			{ AccountId: 7, Role: 30, InvitedRole: 0 },
			{ AccountId: 11, Role: 30, InvitedRole: 0 },
			{ AccountId: 13, Role: 30, InvitedRole: 0 },
			{ AccountId: 8, Role: 20, InvitedRole: 0 },
			{ AccountId: 9, Role: 0, InvitedRole: 30 },
		])
		await standIn(1, roomId, subRoomId)
		await standIn(7, roomId, subRoomId)
		await standIn(11, roomId, 22942)
		await standIn(8, roomId, subRoomId)
		await standIn(9, roomId, subRoomId)
		await standIn(10, roomId, subRoomId)
		await standIn(12, 9999, subRoomId)
		await standIn(13, roomId, subRoomId, { expired: true })
	})

	it('requires a bearer token', async () => {
		const res = await SELF.fetch(
			`${ORIGIN}/collaboration/owners-in-room?roomId=${roomId}&subRoomId=${subRoomId}`
		)
		expect(res.status).toBe(401)
	})

	it('lists co-owners whose presence is in this room and subroom', async () => {
		const res = await SELF.fetch(
			`${ORIGIN}/collaboration/owners-in-room?roomId=${roomId}&subRoomId=${subRoomId}`,
			{ headers: await bearer('42') }
		)
		expect(res.status).toBe(200)
		// 1 (creator) and 7 (role 30) are in subroom 22941. 11 is a co-owner in the
		// other subroom. 13 is a co-owner whose presence has expired. 8 is a
		// moderator, 9 is only invited, 10 has no role.
		expect(await res.json()).toEqual({ success: true, error: null, value: [1, 7] })
	})

	it('returns an empty list for an unknown room', async () => {
		const res = await SELF.fetch(
			`${ORIGIN}/collaboration/owners-in-room?roomId=404&subRoomId=${subRoomId}`,
			{ headers: await bearer('42') }
		)
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ success: true, error: null, value: [] })
	})

	it('returns an empty list when the query ids are missing', async () => {
		const res = await SELF.fetch(`${ORIGIN}/collaboration/owners-in-room`, {
			headers: await bearer('42'),
		})
		expect(res.status).toBe(200)
		expect(await res.json()).toEqual({ success: true, error: null, value: [] })
	})
})
