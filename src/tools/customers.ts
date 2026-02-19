/**
 * Customer Management Tools for Stables MCP Server
 * Updated to match official Stables API docs
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
      businessName: z.string().optional().describe("Business name (required for businesses)"),
      externalCustomerId: z.string().optional().describe("Your own reference ID for this customer"),
      phone: z.string().optional().describe("Phone number with country code (e.g., '+14155552671')"),
      dob: z.string().optional().describe("Date of birth in YYYY-MM-DD format (e.g., '1990-01-15')"),
      nationality: z.string().optional().describe("Two-letter country code (e.g., 'US', 'GB')"),
      entitlements: z.array(z.string()).optional().describe("List of entitlements to request (e.g., ['base_payout'])"),
      addressLine1: z.string().optional().describe("Street address line 1"),
      addressLine2: z.string().optional().describe("Street address line 2"),
      addressCity: z.string().optional().describe("City"),
      addressState: z.string().optional().describe("State or region"),
      addressPostalCode: z.string().optional().describe("Postal/ZIP code"),
      addressCountry: z.string().optional().describe("Two-letter country code (e.g., 'US')"),
    },
    async ({ email, customerType, firstName, lastName, middleName, businessName, externalCustomerId, phone, dob, nationality, entitlements, addressLine1, addressLine2, addressCity, addressState, addressPostalCode, addressCountry }) => {
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
          businessName,
          externalCustomerId: externalCustomerId || crypto.randomUUID(),
          phone,
          dob,
          nationality,
          entitlements,
          address,
        });

        const verificationStatus = customer.verificationLevels?.[0]?.status || "NOT_STARTED";

        return {
          content: [
            {
              type: "text",
              text: `Customer created successfully!

Customer ID: ${customer.customerId}
Email: ${customer.email}
Type: ${customerType}
${firstName ? `Name: ${firstName}${middleName ? ` ${middleName}` : ""} ${lastName || ""}` : ""}
${businessName ? `Business: ${businessName}` : ""}
${phone ? `Phone: ${phone}` : ""}
${nationality ? `Nationality: ${nationality}` : ""}
${entitlements?.length ? `Entitlements: ${entitlements.join(", ")}` : ""}
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

        return {
          content: [
            {
              type: "text",
              text: `Customer Details:

Customer ID: ${customer.customerId}
Email: ${customer.email || "Not set"}
Type: ${customer.customerType}
${customer.firstName ? `Name: ${customer.firstName}${customer.middleName ? ` ${customer.middleName}` : ""} ${customer.lastName || ""}` : ""}
${customer.businessName ? `Business: ${customer.businessName}` : ""}
${customer.phone ? `Phone: ${customer.phone}` : ""}
${customer.nationality ? `Nationality: ${customer.nationality}` : ""}
${customer.dob ? `Date of Birth: ${customer.dob}` : ""}
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
    "List all customers with optional pagination",
    {
      pageSize: z.number().optional().describe("Number of customers per page (default: 20)"),
      pageToken: z.string().optional().describe("Token for the next page of results"),
    },
    async ({ pageSize, pageToken }) => {
      try {
        const response = await client.listCustomers({ pageSize, pageToken });

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
              text: `Customers (${response.customers.length} of ${response.page.total}):

${customerList}
${response.page.nextPageToken ? `\nMore results available. Use pageToken: "${response.page.nextPageToken}"` : ""}`,
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
      verificationType: z.enum(["KYC", "KYB"]).optional().describe("Type of verification - KYC for individuals, KYB for businesses"),
    },
    async ({ customerId, verificationType }) => {
      try {
        const result = await client.generateVerificationLink(customerId, {
          verificationType,
        });

        return {
          content: [
            {
              type: "text",
              text: `Verification link generated!

Customer ID: ${result.customerId}
Verification Link: ${result.kycLink}

Share this link with the customer to complete their identity verification. The link will expire in 24 hours.`,
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
}
