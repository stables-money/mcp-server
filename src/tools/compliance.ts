/**
 * Compliance Tools for Stables MCP Server
 *
 * Mirrors the Compliance requests (RFIs) reference on docs.stables.money. An RFI
 * is what Stables compliance needs before it releases a held payment or a held
 * verification level. Each requirement on it says how to answer: `evidence`
 * with submit_rfi_evidence, `kyc_level` / `kyc_capability` with a verification
 * link (get_verification_link), and `manual_review` needs nothing.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError, Rfi, RfiRequirement } from "../lib/stables-client.js";

const RFI_STATUSES = ["open", "submitted", "satisfied", "expired", "waived", "rejected"] as const;
const RFI_TYPES = ["verification", "transaction", "manual"] as const;

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) return `${error.message} (HTTP ${error.statusCode})`;
  return error instanceof Error ? error.message : "Unknown error";
}

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], ...(isError && { isError }) };
}

/** What the integrator should do next for one requirement. */
function nextStep(rfi: Rfi, r: RfiRequirement): string {
  if (r.status === "satisfied" || r.status === "waived") return "nothing to do";
  if (r.status === "submitted") return "submitted, waiting for Stables compliance";
  switch (r.type) {
    case "evidence":
      return `answer with get_rfi_evidence_form, then submit_rfi_evidence (customerId ${rfi.customer_id}, rfiId ${rfi.rfi_id}, requirementId ${r.requirement_id})`;
    case "kyc_level":
    case "kyc_capability":
      return r.action?.verification_type
        ? `send the customer a verification link: get_verification_link with verificationType '${r.action.verification_type}'`
        : "the customer must complete verification";
    case "manual_review":
      return "Stables compliance is reviewing, nothing to submit";
    default:
      return "see the RFI in the dashboard";
  }
}

function describeRequirement(rfi: Rfi, r: RfiRequirement): string {
  const what =
    r.required_level ?? r.required_capability ?? r.label ?? r.required_evidence ?? r.type;
  const sentBack = r.rejection_reason ? ` (sent back: ${r.rejection_reason})` : "";
  return `  - ${r.type} ${what}: ${r.status}${sentBack}. Next: ${nextStep(rfi, r)}`;
}

function describeRfi(rfi: Rfi): string {
  const about =
    rfi.subject === "payment"
      ? `payment ${rfi.transfer_id ?? rfi.transaction_reference_id ?? "(unknown)"}${rfi.transaction_type ? ` (${rfi.transaction_type})` : ""}`
      : `customer ${rfi.customer_id}`;
  const reasons = (rfi.reasons ?? []).map((r) => r.description).join("; ");
  const lines = [
    `RFI ${rfi.rfi_id}: ${rfi.type}, ${rfi.status}, about ${about}`,
    reasons ? `  Why: ${reasons}` : "",
    rfi.message ? `  Message: ${rfi.message}` : "",
    rfi.rejection_reason ? `  Rejected: ${rfi.rejection_reason}` : "",
    ...(rfi.requirements ?? []).map((r) => describeRequirement(rfi, r)),
  ];
  return lines.filter(Boolean).join("\n");
}

function describeList(rfis: Rfi[], empty: string): string {
  if (rfis.length === 0) return empty;
  return rfis.map(describeRfi).join("\n\n");
}

export function registerComplianceTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "list_rfis",
    "List the organisation's compliance requests for information (RFIs), newest first: what Stables compliance needs before it releases a held payment or verification. Open and submitted ones by default. Check this when a transfer or deposit is held, or subscribe to the rfi.* webhooks.",
    {
      status: z
        .array(z.enum(RFI_STATUSES))
        .optional()
        .describe("Only these statuses (default: open and submitted)"),
      type: z.array(z.enum(RFI_TYPES)).optional().describe("Only these RFI types"),
      customerId: z.string().optional().describe("Only this customer's RFIs"),
      transactionReferenceId: z
        .string()
        .optional()
        .describe("Only RFIs about this transfer or deposit"),
      limit: z.number().int().min(1).max(100).optional().describe("Results per page"),
      cursor: z.string().optional().describe("next_cursor from the previous page"),
    },
    async (params) => {
      try {
        const { rfis, next_cursor } = await client.listRfis(params);
        const more = next_cursor ? `\n\nMore results: pass cursor "${next_cursor}".` : "";
        return text(describeList(rfis ?? [], "No RFIs match.") + more);
      } catch (error) {
        return text(`Failed to list RFIs: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "list_customer_rfis",
    "List one customer's compliance requests for information (RFIs), with what each requirement needs next.",
    {
      customerId: z.string().describe("The customer ID"),
      status: z.enum(RFI_STATUSES).optional().describe("Only this status"),
    },
    async ({ customerId, status }) => {
      try {
        const { rfis } = await client.listCustomerRfis(customerId, status);
        return text(describeList(rfis ?? [], `Customer ${customerId} has no RFIs.`));
      } catch (error) {
        return text(`Failed to list the customer's RFIs: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "get_rfi",
    "Get one compliance request for information (RFI): why it was raised, its requirements and how to answer each.",
    {
      rfiId: z.string().describe("The RFI ID"),
    },
    async ({ rfiId }) => {
      try {
        return text(describeRfi(await client.getRfi(rfiId)));
      } catch (error) {
        return text(`Failed to get RFI: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "get_rfi_evidence_form",
    "Get the form an `evidence` requirement on an RFI asks for (for example the source of funds behind one held payment), with the current submission if one was sent. Build the submit_rfi_evidence answers from its fields and documents.",
    {
      customerId: z.string().describe("The customer ID"),
      rfiId: z.string().describe("The RFI ID"),
      requirementId: z.string().describe("The requirement ID (type 'evidence')"),
    },
    async ({ customerId, rfiId, requirementId }) => {
      try {
        const evidence = await client.getRfiEvidence(customerId, rfiId, requirementId);
        const form = evidence.form ?? {};
        const fields = (form.fields ?? []).map(
          (f) =>
            `  - ${f.key} (${f.type}${f.required ? ", required" : ""}): ${f.label}${f.description ? `. ${f.description}` : ""}`
        );
        const documents = (form.documents ?? []).map(
          (d) =>
            `  - ${d.wire_field} (files as base64 data URLs${d.required ? ", required" : ""}): ${d.label}${d.description ? `. ${d.description}` : ""}`
        );
        const lines = [
          `Evidence requirement ${evidence.requirement_id} (${evidence.required_evidence}): ${evidence.status}`,
          evidence.rejection_reason ? `Sent back: ${evidence.rejection_reason}` : "",
          evidence.answerable
            ? "It can be answered now."
            : "It cannot be answered now (already approved or the RFI is resolved).",
          form.title ? `\n${form.title}${form.description ? `: ${form.description}` : ""}` : "",
          fields.length ? `\nFields:\n${fields.join("\n")}` : "",
          documents.length ? `\nDocuments:\n${documents.join("\n")}` : "",
          evidence.submission ? "\nA submission is already on file; a new one replaces it." : "",
        ];
        return text(lines.filter(Boolean).join("\n"));
      } catch (error) {
        return text(`Failed to get the evidence form: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "submit_rfi_evidence",
    "Submit the answers and documents an `evidence` requirement asks for, in one request, keyed as get_rfi_evidence_form lists them. Files are base64 data URLs ('data:application/pdf;base64,...'). The requirement moves to 'submitted' for Stables compliance to review; approving it releases the held payment once nothing else is outstanding. Confirm the content with a human before sending: it goes to compliance as the customer's answer.",
    {
      customerId: z.string().describe("The customer ID"),
      rfiId: z.string().describe("The RFI ID"),
      requirementId: z.string().describe("The requirement ID (type 'evidence')"),
      answers: z
        .record(z.string(), z.unknown())
        .describe(
          "Answers keyed by the form's field keys and document wire_field names, e.g. { funds_origin, funds_origin_explanation, supporting_documents: ['data:application/pdf;base64,...'] }"
        ),
    },
    async ({ customerId, rfiId, requirementId, answers }) => {
      try {
        const { rfi } = await client.submitRfiEvidence(customerId, rfiId, requirementId, answers);
        return text(`Evidence submitted.\n\n${describeRfi(rfi)}`);
      } catch (error) {
        return text(`Failed to submit evidence: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "get_kyc_capabilities",
    "List the verification capabilities a customer holds (for example proof_of_address), the level that granted each, and when. A `kyc_capability` requirement on an RFI is satisfied once the customer holds that capability.",
    {
      customerId: z.string().describe("The customer ID"),
    },
    async ({ customerId }) => {
      try {
        const { capabilities } = await client.getKycCapabilities(customerId);
        if (!capabilities?.length) return text(`Customer ${customerId} holds no capabilities yet.`);
        const lines = capabilities.map(
          (c) => `- ${c.capability}: ${c.status} (from ${c.kyc_level}, granted ${c.granted_at})`
        );
        return text(`Capabilities held by ${customerId}:\n${lines.join("\n")}`);
      } catch (error) {
        return text(`Failed to get KYC capabilities: ${formatError(error)}`, true);
      }
    }
  );
}
