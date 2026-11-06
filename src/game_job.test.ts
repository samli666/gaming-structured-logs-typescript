import { moderationDecision } from "./game_job.ts";

const pending = moderationDecision({ playerId: "p1", assetId: "a1", eventName: "asset.created", moderationStatus: "pending" });
const approved = moderationDecision({ playerId: "p1", assetId: "a1", eventName: "asset.created", moderationStatus: "approved" });
if (pending !== "queue" || approved !== "publish") throw new Error("moderation decision changed");
console.log("moderation decision test passed");
