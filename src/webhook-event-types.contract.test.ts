/**
 * The create_webhook tool declares the event types it accepts as a zod enum so
 * a wrong value fails before the request. That list is typed by hand, and in
 * October 2026 it sat at 14 types while the API accepted 25: an agent could not
 * subscribe to transfer.action_required, the virtual account lifecycle events,
 * entitlement.* or prefund.* through the MCP at all. This pins the list to the
 * deployed spec's enum so the next addition on the API side fails here.
 *
 * Skipped when reference/ is absent. Run with: npm run check:spec
 */

import { existsSync, readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { WEBHOOK_EVENT_TYPES } from "./tools/webhooks.js";

const haveReference = existsSync("reference/spec.json");

describe.skipIf(!haveReference)("create_webhook event types vs deployed spec", () => {
  it("accepts exactly the event types the deployed API accepts", () => {
    const spec = JSON.parse(readFileSync("reference/spec.json", "utf8"));
    const items =
      spec.components?.schemas?.CreateWebhookSubscriptionRequest?.properties?.eventTypes?.items;
    expect(items?.enum, "spec enum not found where expected").toBeDefined();
    const specTypes = [...(items.enum as string[])].sort();
    const ours = [...WEBHOOK_EVENT_TYPES].sort();
    expect(ours).toEqual(specTypes);
  });
});
