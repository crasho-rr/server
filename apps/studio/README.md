# studio

The RecFlare Studio host (`https://studio.<domain>`).

Device login stays on Auth, `GET /account/me` stays on Accounts, and the approval
page is WWW `/device`. This worker answers the editor's build list and the
co-owner presence list.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/cloud-builds/for-room` | Empty page (`results: []`, `totalResults: 0`). Query: `roomId`, `subRoomId`, `skip`, `take`. |
| `GET` | `/collaboration/owners-in-room` | Account ids of the room's co-owners (creator, or a Creator/CoOwner role) whose live presence is in that `roomId` and `subRoomId`. Body: `{ success: true, error: null, value: number[] }`. Bearer required. |

## Development

### Run in dev mode

```sh
pnpm dev
```

### Run tests

```sh
pnpm test
```

### Deploy

```sh
pnpm turbo deploy
```
