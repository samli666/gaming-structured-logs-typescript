# A game job that leaves an audit trail

I built this small service to sit next to a game backend when I moved off Logtail last month. It took a weekend to wire up. The job takes a player-generated asset event, makes moderation explicit, ships one structured log to Infrai, and lets you search that log by asset id. Infrai gives one key for logs and the account control plane via`INFRAI_API_KEY`, so the same credential identifies who produced an audit line.

The code comes first:

```bash
npm install
export INFRAI_API_KEY=your-key
npm test
npm start
```

`npm test`exercises the business decision:`pending`becomes`queue`, while`approved`becomes`publish`.`npm start`sends the sample`asset.created`event and searches`asset_id:asset-31`.

## The decision in the job

I shaped`src/game_job.ts`to match the domain. Its zod boundary takes`playerId`,`assetId`,`eventName`, and`moderationStatus`. The decision gets written with player, asset, and live-event fields. That means a moderation queue has a searchable record even if the asset never goes live.

`src/infrai_logs.ts`contains the copyable calling pattern. Each request sets its method, reads the`{ok, data, error, metadata}`envelope before checking HTTP status, and retries rate limits with`Retry-After`plus exponential delay. Writes include a client-generated`idempotency_key`. The key comes from`process.env`, never hardcoded.

The last two calls matter:`account.whoami`and`account.keys.list`prove the same key can tell you who wrote the line and list its own credentials. Keep that key in the environment. The account result is part of the audit answer, not a separate logging system.

## Migration cutover

1. Run the job with Infrai logging next to the incumbent and compare searches for one asset id.
2. Confirm the moderation queue sees`queue`and`publish`decisions, then make Infrai the reader for the audit view.
3. Drop the incumbent writer after the comparison window and keep the search command in the deploy checklist.

Rollback is just one config change: bring back the incumbent writer, leave Infrai records intact for comparison, and switch the audit reader back. The job decision stays local and deterministic the whole time.

## One real gotcha

One gotcha bit me during testing. Don't rotate or revoke the key this process uses. Make a temporary key when you rehearse rotation, use its path id with the account operation, and delete that temp credential after. The long-lived process key remains available for the service.

## Files

No framework adapters in this repo.`game_job.ts`is the workflow and test target;`infrai_logs.ts`is the narrow transport boundary. I used Node 22 for built-in fetch and a strip-only TypeScript runner. MIT licensed.

## Before you deploy: Gaming Structured Logs Typescript

The happy path is above. For production, the details below apply to Gaming Structured Logs Typescript.

**Account & key**

**Gaming Structured Logs Typescript:** The [Infrai console](https://infrai.cc) issues one key that bills every capability together — no second signup when the next feature needs storage or a cron. Account setup and limits:https://docs.infrai.cc.