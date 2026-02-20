/**
 * Customer Management Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.sandbox.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient } from "../lib/stables-client.js";

export function registerCustomerTools(server: McpServer, client: StablesApiClient) {
  // Create Customer
  server.tool(
    "create_customer",
    "Create a new customer in Stables for KYC verification and transfers. Use 'individual' for personal accounts or 'business' for company accounts. Include entitlements like 'base_payout' to enable transactions.",
    {
      email: z.string().email().describe("Customer's email address"),
      customerType: z.enum(["individual", "business"]).describe("Type of customer - 'individual' for personal, 'business' for companies"),
      firstName: z.string().optional().describe("First name (required for individuals)"),
      lastName: z.string().optional().describe("Last name (required for individuals)"),
      middleName: z.string().optional().describe("Middle name"),
      companyName: z.string().optional().describe("Company name (required for businesses)"),
      externalCustomerId: z.string().optional().describe("Your own reference ID for this customer"),
      phone: z.string().optional().describe("Phone number with country code (e.g., '+14155552671')"),
      dob: z.string().optional().describe("Date of birth in YYYY-MM-DD format (e.g., '1990-01-15')"),
      nationality: z.string().optional().describe("Two-letter country code (e.g., 'US', 'GB')"),
      entitlements: z.array(z.string()).optional().describe("List of entitlements to request (e.g., ['base_payout', 'virtual_account'])"),
      addressLine1: z.string().optional().describe("Street address line 1"),
      addressLine2: z.string().optional().describe("Street address line 2"),
      addressCity: z.string().optional().describe("City"),
      addressState: z.string().optional().describe("State or region"),
      addressPostalCode: z.string().optional().describe("Postal/ZIP code"),
      addressCountry: z.string().optional().describe("Two-letter country code (e.g., 'US')"),
    },
    async ({ email, customerType, firstName, lastName, middleName, companyName, externalCustomerId, phone, dob, nationality, entitlements, addressLine1, addressLine2, addressCity, addressState, addressPostalCode, addressCountry }) => {
      try {
        const address = addressLine1 ? {
          line1: addressLine1,
          line2: addressLine2,
          city: addressCity || "",
          state: addressState,
          postalCode: addressPostalCode,
          country: addressCountry || "",
        } : undefined;

        const customer = await client.createCustomer({
          email,
          customerType: customerType === "individual"
            ? "CUSTOMER_TYPE_INDIVIDUAL"
            : "CUSTOMER_TYPE_BUSINESS",
          firstName,
          lastName,
          middleName,
          companyName,
          externalCustomerId: externalCustomerId || crypto.randomUUID(),
          phone,
          dob,
          nationality,
          entitlements,
          address,
        });

        const verificationStatus = customer.verificationLevels?.[0]?.status || "NOT_STARTED";
        const entitlementsList = customer.entitlements?.map(e => `${e.name}: ${e.status}`).join(", ") || "None";

        return {
          content: [
            {
              type: "text",
              text: `Customer created successfully!

Customer ID: ${customer.customerId}
Email: ${customer.email}
Type: ${customerType}
${firstName ? `Name: ${firstName}${middleName ? ` ${middleName}` : ""} ${lastName || ""}` : ""}
${companyName ? `Company: ${companyName}` : ""}
${phone ? `Phone: ${phone}` : ""}
${nationality ? `Nationality: ${nationality}` : ""}
Entitlements: ${entitlementsList}
Verification Status: ${verificationStatus}
Created: ${customer.createdAt}

Next step: Use 'get_verification_link' to get a KYC verification link for this customer.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to create customer: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Customer
  server.tool(
    "get_customer",
    "Get details about a specific customer including their verification status",
    {
      customerId: z.string().describe("The customer ID to look up"),
    },
    async ({ customerId }) => {
      try {
        const customer = await client.getCustomer(customerId);

        const verificationStatus = customer.verificationLevels?.[0]?.status || "NOT_STARTED";
        const isVerified = verificationStatus === "VERIFICATION_APPROVED";
        const entitlementsList = customer.entitlements?.map(e => `${e.name}: ${e.status}`).join(", ") || "None";

        return {
          content: [
            {
              type: "text",
              text: `Customer Details:

Customer ID: ${customer.customerId}
Email: ${customer.email || "Not set"}
Type: ${customer.customerType}
${customer.firstName ? `Name: ${customer.firstName} ${customer.lastName || ""}` : ""}
${customer.companyName ? `Company: ${customer.companyName}` : ""}
${customer.phone ? `Phone: ${customer.phone}` : ""}
Entitlements: ${entitlementsList}
Verification Status: ${verificationStatus}
Can Transfer: ${isVerified ? "Yes" : "No - needs KYC verification"}
Created: ${customer.createdAt}
Updated: ${customer.updatedAt}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to get customer: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Customers
  server.tool(
    "list_customers",
    "List all customers for the authenticated tenant",
    {},
    async () => {
      try {
        const response = await client.listCustomers();

        if (response.customers.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No customers found. Use 'create_customer' to add your first customer.",
              },
            ],
          };
        }

        const customerList = response.customers.map((c) => {
          const status = c.verificationLevels?.[0]?.status || "NOT_STARTED";
          return `- ${c.customerId}: ${c.email || "No email"} (${c.customerType}) - ${status}`;
        }).join("\n");

        return {
          content: [
            {
              type: "text",
              text: `Customers (${response.customers.length}):

${customerList}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to list customers: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Verification Link
  server.tool(
    "get_verification_link",
    "Generate a KYC verification link for a customer. The customer must complete verification before they can make transfers.",
    {
      customerId: z.string().describe("The customer ID to generate verification link for"),
      ttlInSecs: z.number().optional().describe("Time-to-live for the KYC link in seconds (default: 1800)"),
      successUrl: z.string().optional().describe("URL to redirect to after successful verification"),
      rejectUrl: z.string().optional().describe("URL to redirect to after rejected verification"),
    },
    async ({ customerId, ttlInSecs, successUrl, rejectUrl }) => {
      try {
        const redirect = (successUrl || rejectUrl) ? {
          successUrl,
          rejectUrl,
        } : undefined;

        const result = await client.generateVerificationLink(customerId, {
          ttlInSecs,
          redirect,
        });

        const ttlDisplay = ttlInSecs ? `${Math.floor(ttlInSecs / 60)} minutes` : "30 minutes (default)";

        return {
          content: [
            {
              type: "text",
              text: `Verification link generated!

Customer ID: ${result.customerId}
Verification Link: ${result.kycLink}

The link will expire in ${ttlDisplay}.
Share this link with the customer to complete their identity verification.`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to generate verification link: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Customer
  server.tool(
    "update_customer",
    "Update customer details, entitlements, or verification information",
    {
      customerId: z.string().describe("The customer ID to update"),
      email: z.string().optional().describe("Updated email address"),
      phone: z.string().optional().describe("Updated phone number"),
      firstName: z.string().optional().describe("Updated first name"),
      lastName: z.string().optional().describe("Updated last name"),
      entitlements: z.array(z.string()).optional().describe("Updated entitlements (e.g., ['base_payout', 'virtual_account'])"),
    },
    async ({ customerId, email, phone, firstName, lastName, entitlements }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        if (firstName) updates.firstName = firstName;
        if (lastName) updates.lastName = lastName;
        if (entitlements) updates.entitlements = entitlements;

        const customer = await client.updateCustomer(customerId, updates);

        return {
          content: [
            {
              type: "text",
              text: `Customer ${customer.customerId} updated successfully.

Email: ${customer.email}
${customer.firstName ? `Name: ${customer.firstName} ${customer.lastName || ""}` : ""}
Updated: ${customer.updatedAt}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update customer: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update Metadata
  server.tool(
    "update_customer_metadata",
    "Update customer metadata key-value pairs",
    {
      customerId: z.string().describe("The customer ID to update metadata for"),
      metadata: z.record(z.string()).describe("Metadata key-value pairs to set"),
    },
    async ({ customerId, metadata }) => {
      try {
        await client.updateMetadata(customerId, metadata);

        return {
          content: [
            {
              type: "text",
              text: `Metadata updated for customer ${customerId}.

Keys set: ${Object.keys(metadata).join(", ")}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update metadata: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
