# SpareX backend

One NestJS API for the Kannali Garage + SpareX admin panel (`/v1/admin`), B2C web (`/v1/b2c`) and B2B web
(`/v1/b2b`). How the code is organised and the rules it follows are in [CLAUDE.md](CLAUDE.md).

## Run locally

Needs Node.js 24. Nothing else: no Docker, no local MongoDB.

1. `npm install`
2. `cp .env.example .env`
3. Put your Atlas dev database in `MONGO_URI` (keep `_dev` in its name, e.g. `kannali_dev_ravi`)
4. `npm run seed` (wipes that database and loads the demo data)
5. `npm run dev`

No Atlas database yet? Skip steps 3 to 5 and run `npm run dev:memory`: it starts an in-memory MongoDB, seeds it and
runs the app with watch. Nothing is kept after you stop it.

The API listens on <http://localhost:4000>. API docs: <http://localhost:4000/docs/admin>,
[/docs/b2c](http://localhost:4000/docs/b2c), [/docs/b2b](http://localhost:4000/docs/b2b). Health:
<http://localhost:4000/health>. Uploads are kept in `uploads/` (git-ignored) unless S3 keys are set.

## Demo sign-ins

- Admin: `ravi@kannaligarage.in` (Super Admin, 2-step) or `kiran@kannaligarage.in` (Admin), password `Demo@1234`.
  With `SMS_PROVIDER=console` the 2-step code is printed in the API log and returned as `demoCode`.
- B2C: mobile `9845012345` (Arjun Rao). The SMS code is printed in the API log.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | start with watch, against the database in `.env` |
| `npm run dev:memory` | in-memory MongoDB, seeded, app with watch |
| `npm run build` / `npm start` | compile / run the compiled app |
| `npm run check` | typecheck + lint + format check |
| `npm test` | unit and end-to-end tests on an in-memory replica set (the first run downloads MongoDB) |
| `npm run seed` | wipe the configured database and load demo data (needs `NODE_ENV=development` and `_dev` in the name) |
| `npm run db:indexes` | create or update every collection's indexes |
| `npm run migrate:up` / `migrate:down` / `migrate:create` | data migrations (migrate-mongo) |
| `npm run openapi` | write `openapi/admin.json`, `b2c.json`, `b2b.json` (uses its own in-memory database) |
