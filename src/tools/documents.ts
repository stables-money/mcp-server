/**
 * Document Tools for Stables MCP Server
 *
 * Mirrors the Transfer Documents and Deposit Documents references on
 * docs.stables.money: attach an invoice, contract or other supporting document
 * to a transfer or to a payment route deposit, for example when Stables
 * compliance asks for one, then list, download or remove it.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError, TransactionDocument } from "../lib/stables-client.js";

const OWNER = z
  .enum(["transfer", "deposit"])
  .describe("What the document belongs to: a transfer, or a deposit on a payment route");
const TRANSACTION_ID = z
  .string()
  .describe("The transfer ID, or the deposit ID from get_virtual_account_history");

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) return `${error.message} (HTTP ${error.statusCode})`;
  return error instanceof Error ? error.message : "Unknown error";
}

function text(value: string, isError = false) {
  return { content: [{ type: "text" as const, text: value }], ...(isError && { isError }) };
}

function describeDocument(d: TransactionDocument): string {
  return `- ${d.document_id}: ${d.file_name} (${d.type}, ${d.content_type}, ${d.size_bytes} bytes, added ${d.created_at})`;
}

export function registerDocumentTools(server: McpServer, client: StablesApiClient) {
  server.tool(
    "add_document",
    "Attach a supporting document (invoice, contract or other) to a transfer or a payment route deposit, for example when Stables compliance asks for one. The file goes as a base64 data URL ('data:application/pdf;base64,...').",
    {
      on: OWNER,
      transactionId: TRANSACTION_ID,
      fileName: z.string().describe("File name shown to Stables, e.g. 'invoice-2041.pdf'"),
      base64Url: z.string().describe("The file as a data URL: 'data:<mime>;base64,<data>'"),
      type: z
        .enum(["invoice", "contract", "other"])
        .optional()
        .describe("What the document is (default other)"),
    },
    async ({ on, transactionId, fileName, base64Url, type }) => {
      try {
        const { document } = await client.addDocument(on, transactionId, {
          file_name: fileName,
          base64_url: base64Url,
          ...(type && { type }),
        });
        return text(`Document attached to ${on} ${transactionId}:\n${describeDocument(document)}`);
      } catch (error) {
        return text(`Failed to attach the document: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "list_documents",
    "List the documents attached to a transfer or a payment route deposit, newest first.",
    {
      on: OWNER,
      transactionId: TRANSACTION_ID,
    },
    async ({ on, transactionId }) => {
      try {
        const { documents } = await client.listDocuments(on, transactionId);
        if (!documents?.length) return text(`No documents on ${on} ${transactionId}.`);
        return text(
          `Documents on ${on} ${transactionId}:\n${documents.map(describeDocument).join("\n")}`
        );
      } catch (error) {
        return text(`Failed to list documents: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "get_document_download_url",
    "Get a short-lived link to download a document attached to a transfer or a payment route deposit.",
    {
      on: OWNER,
      transactionId: TRANSACTION_ID,
      documentId: z.string().describe("The document ID from list_documents"),
    },
    async ({ on, transactionId, documentId }) => {
      try {
        const link = await client.getDocumentDownloadUrl(on, transactionId, documentId);
        return text(
          `Download ${link.file_name} (${link.content_type}), valid for ${link.expires_in} seconds:\n${link.url}`
        );
      } catch (error) {
        return text(`Failed to get the download link: ${formatError(error)}`, true);
      }
    }
  );

  server.tool(
    "delete_document",
    "Remove a document from a transfer or a payment route deposit. This cannot be undone, so confirm with a human first.",
    {
      on: OWNER,
      transactionId: TRANSACTION_ID,
      documentId: z.string().describe("The document ID from list_documents"),
    },
    async ({ on, transactionId, documentId }) => {
      try {
        const { deleted } = await client.deleteDocument(on, transactionId, documentId);
        return text(
          deleted
            ? `Document ${documentId} removed from ${on} ${transactionId}.`
            : `Document ${documentId} was not removed.`
        );
      } catch (error) {
        return text(`Failed to remove the document: ${formatError(error)}`, true);
      }
    }
  );
}
