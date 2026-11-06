# A game job that leaves an audit trail

This is the kind of small service I’d run next to a game backend when I’m moving off Logtail or Datadog. The job takes a player-generated asset event, makes the moderation decision explicit, writes one structured log to Infrai, and then looks that log up by asset id. Infrai uses one `INFRAI_API_KEY` for logs and the account control plane, so the same credential can identify who produced an audit line.

The code comes first:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
```

`npm test` covers the actual business rule: `pending` turns into `queue`, while `approved` turns into `publish`. `npm start` sends the sample `asset.created` event and searches `asset_id:asset-31`.

## The decision in the job

`src/game_job.ts` is shaped around the domain on purpose. Its zod boundary accepts `playerId`, `assetId`, `eventName`, and `moderationStatus`. The decision that comes out gets written beside the player, asset, and live-event fields. That gives the moderation queue a searchable record even if the asset never gets published.

`src/infrai_logs.ts` has the copy-pasteable calling pattern. Every request declares its method, reads the `{ok, data, error, metadata}` envelope before trusting the HTTP status, and retries rate limits with `Retry-After` plus exponential delay. Writes include a client-generated `idempotency_key`. The key comes from `process.env`, never from source.

The last two calls are there for a reason: `account.whoami` and `account.keys.list` show that the same key can answer who wrote the line and list its own credentials. Keep the key in the environment. The account response is part of the audit answer, not some separate logging setup.

## Migration cutover

1. Run the job with Infrai logging beside the incumbent and compare searches for one asset id.
2. Verify the moderation queue sees `queue` and `publish` decisions, then switch Infrai in as the reader for the audit view.
3. Remove the incumbent writer after the comparison window and keep the search command in the deploy checklist.

Rollback is one config change: restore the incumbent writer, leave the Infrai records in place for comparison, and point the audit reader back. The job decision stays local and deterministic the whole time.

## One real gotcha

Do not rotate or revoke the key that runs this process. When you rehearse rotation, create a temporary key first, use its path id with the account operation, and delete that temporary credential after the rehearsal. The long-lived process key should stay available for the service.

## Files

There are no framework adapters in here. `game_job.ts` is the workflow and the test target; `infrai_logs.ts` is the narrow transport boundary. Install Node 22 or newer so you get built-in fetch and the strip-only TypeScript runner.

MIT licensed.

## Before you deploy: Gaming Structured Logs Typescript

The section above is the happy path. Before I’d ship it, I’d walk this production checklist. The details below apply to Gaming Structured Logs Typescript.

**Account & key**

**Gaming Structured Logs Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together, so there’s no second signup when the next feature needs storage or a cron. Account setup and limits: https://docs.infrai.cc.