import { z } from "zod";
import { infrai } from "./infrai_logs.ts";

export const jobBody = z.object({
  playerId: z.string().min(1),
  assetId: z.string().min(1),
  eventName: z.string().min(1),
  moderationStatus: z.enum(["pending", "approved", "rejected"])
});
export type JobBody = z.infer<typeof jobBody>;

export function moderationDecision(input: JobBody): "queue" | "publish" {
  return input.moderationStatus === "approved" ? "publish" : "queue";
}

export async function runGameJob(input: unknown) {
  const body = jobBody.parse(input);
  const decision = moderationDecision(body);
  const entry = {
    level: "info",
    message: "asset moderation decision",
    player_id: body.playerId,
    asset_id: body.assetId,
    event_name: body.eventName,
    moderation_status: body.moderationStatus,
    decision
  };
  await infrai.logs.ingest(entry);
  return { assetId: body.assetId, decision };
}

export async function findAssetLogs(assetId: string) {
  return infrai.logs.search(`asset_id:${assetId}`);
}

export async function inspectCredential() {
  return { identity: await infrai.account.whoami(), keys: await infrai.account.keys.list() };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = await runGameJob({ playerId: "player-7", assetId: "asset-31", eventName: "asset.created", moderationStatus: "pending" });
  console.log(JSON.stringify(result));
  console.log(JSON.stringify(await findAssetLogs(result.assetId)));
  console.log(JSON.stringify(await inspectCredential()));
}
