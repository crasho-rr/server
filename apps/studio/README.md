# studio

The RecFlare Studio host (`https://studio.<domain>`).

Device login stays on Auth, `GET /account/me` stays on Accounts, and the approval
page is WWW `/device`. This worker only answers the editor's build list.

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/cloud-builds/for-room` | Empty page (`results: []`, `totalResults: 0`). Query: `roomId`, `subRoomId`, `skip`, `take`. |

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
