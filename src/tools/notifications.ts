/**
 * Notification Tools for Stables MCP Server
 * Sends verification SMS to customers via Twilio
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError } from "../lib/stables-client.js";

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) {
    return `${error.message} (HTTP ${error.statusCode})`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export function registerNotificationTools(
  server: McpServer,
  client: StablesApiClient
) {
  server.tool(
    "send_verification_sms",
    "Send a KYC verification link to a customer via SMS. Automatically fetches the customer's phone number and generates a fresh verification link. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.",
    {
      customerId: z
        .string()
        .describe("The customer ID to send the verification SMS to"),
      phone: z
        .string()
        .optional()
        .describe(
          "Override phone number (with country code, e.g., '+14155552671'). If not provided, uses the customer's phone on file."
        ),
      botName: z
        .string()
        .optional()
        .describe(
          "Name of the bot/assistant sending the message (default: 'your assistant')"
        ),
      verificationLinkTtlSecs: z
        .number()
        .optional()
        .describe(
          "TTL for the verification link in seconds (default: 1800)"
        ),
    },
    async ({ customerId, phone, botName, verificationLinkTtlSecs }) => {
      try {
        // 1. Validate Twilio environment variables
        const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
        const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
          return {
            content: [
              {
                type: "text" as const,
                text: "Missing Twilio configuration. Please set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and TWILIO_PHONE_NUMBER environment variables.",
              },
            ],
            isError: true,
          };
        }

        // 2. Fetch customer details to get phone and name
        const customer = await client.getCustomer(customerId);

        const recipientPhone = phone || customer.phone;
        if (!recipientPhone) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Customer ${customerId} has no phone number on file. Please provide a phone number via the 'phone' parameter or update the customer's phone first using 'update_customer'.`,
              },
            ],
            isError: true,
          };
        }

        const customerName = customer.firstName || "there";
        const assistantName = botName || "your assistant";

        // 3. Generate a fresh verification link
        const verificationResult = await client.generateVerificationLink(
          customerId,
          { ttlInSecs: verificationLinkTtlSecs }
        );
        const verificationLink = verificationResult.kycLink;

        // 4. Compose the SMS message
        const messageBody = `Hi ${customerName}, I'm ${assistantName}. Please complete verification to give me access to global commerce payment rails: ${verificationLink}`;

        // 5. Send SMS via Twilio REST API (using native fetch, no SDK needed)
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
        const authHeader =
          "Basic " +
          Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString(
            "base64"
          );

        const formBody = new URLSearchParams({
          To: recipientPhone,
          From: twilioPhoneNumber,
          Body: messageBody,
        });

        const twilioResponse = await fetch(twilioUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: formBody.toString(),
        });

        if (!twilioResponse.ok) {
          const errorData = await twilioResponse
            .json()
            .catch(() => null);
          const errorMsg =
            errorData?.message ||
            `HTTP ${twilioResponse.status}: ${twilioResponse.statusText}`;
          throw new Error(`Twilio API error: ${errorMsg}`);
        }

        const smsResult = (await twilioResponse.json()) as {
          sid: string;
          status: string;
        };

        // 6. Return success
        const ttlDisplay = verificationLinkTtlSecs
          ? `${Math.floor(verificationLinkTtlSecs / 60)} minutes`
          : "30 minutes (default)";

        return {
          content: [
            {
              type: "text" as const,
              text: `Verification SMS sent successfully!

Customer ID: ${customerId}
Customer Name: ${customerName}
Sent To: ${recipientPhone}
Twilio Message SID: ${smsResult.sid}
Status: ${smsResult.status}

Verification link expires in ${ttlDisplay}.
The customer will receive an SMS with a link to complete KYC verification.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to send verification SMS: ${formatError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
