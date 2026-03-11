/**
 * Customer Management Tools for Stables MCP Server
 * Synced with OpenAPI spec from https://api.stables.money/docs
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { StablesApiClient, StablesApiError, CreateCustomerRequest } from "../lib/stables-client.js";

function formatError(error: unknown): string {
  if (error instanceof StablesApiError) {
    return `${error.message} (HTTP ${error.statusCode})`;
  }
  return error instanceof Error ? error.message : "Unknown error";
}

export function registerCustomerTools(server: McpServer, client: StablesApiClient) {
  // Create Customer
  server.tool(
    "create_customer",
    "Create a new customer in Stables for KYC verification and transfers. Use 'individual' for personal accounts or 'business' for company accounts. Include entitlements like 'base_payout' to enable transactions.",
    {
      email: z.string().email().optional().describe("Customer's email address"),
      customerType: z.enum(["individual", "business"]).describe("Type of customer - 'individual' for personal, 'business' for companies"),
      // Individual fields
      firstName: z.string().optional().describe("First name (required for individuals)"),
      lastName: z.string().optional().describe("Last name (required for individuals)"),
      middleName: z.string().optional().describe("Middle name"),
      dob: z.string().optional().describe("Date of birth in YYYY-MM-DD format (e.g., '1990-01-15')"),
      nationality: z.string().optional().describe("Two-letter country code (e.g., 'US', 'GB')"),
      // Business fields
      companyName: z.string().optional().describe("Company name (required for businesses)"),
      country: z.string().optional().describe("Country code ISO 3166-1 alpha-2 (required for businesses, e.g., 'US')"),
      registrationNumber: z.string().optional().describe("Business registration number"),
      incorporatedOn: z.string().optional().describe("Date of incorporation in YYYY-MM-DD format"),
      type: z.string().optional().describe("Company type (e.g., 'Private Company Limited by Shares')"),
      taxId: z.string().optional().describe("Tax ID (e.g., '12-3456789')"),
      registrationLocation: z.string().optional().describe("Registration location (e.g., state for USA)"),
      website: z.string().optional().describe("Website URL"),
      describeBusiness: z.string().optional().describe("Description of the business"),
      conductMoneyServices: z.boolean().optional().describe("Whether the company conducts money services"),
      describeMoneyServices: z.string().optional().describe("Describe money services (required if conductMoneyServices is true)"),
      describeComplianceControls: z.string().optional().describe("Description of compliance controls"),
      mainSourceOfFunds: z.enum(["BUSINESS_LOANS", "GRANTS", "INTER_COMPANY_FUNDS", "INVESTMENT_PROCEEDS", "LEGAL_SETTLEMENT", "OWNERS_CAPITAL", "PENSION_RETIREMENT", "SALE_OF_ASSETS", "SALES_OF_GOODS_AND_SERVICES", "THIRD_PARTY_FUNDS", "TREASURY_RESERVES"]).optional().describe("Main source of funds"),
      accountPurpose: z.enum(["CHARITABLE_DONATIONS", "ECOMMERCE_RETAIL_PAYMENTS", "INVESTMENT_PURPOSES", "PAYMENTS_TO_FRIENDS_OR_FAMILY_ABROAD", "PAYROLL", "PERSONAL_OR_LIVING_EXPENSES", "PROTECT_WEALTH", "PURCHASE_GOODS_AND_SERVICES", "RECEIVE_PAYMENTS_FOR_GOODS_AND_SERVICES", "TAX_OPTIMIZATION", "THIRD_PARTY_MONEY_TRANSMISSION", "TREASURY_MANAGEMENT", "OTHER"]).optional().describe("What will you use Stables for?"),
      accountPurposeOther: z.string().optional().describe("Explain purpose (required if accountPurpose is OTHER)"),
      isYourBusinessADao: z.boolean().optional().describe("Is your business a DAO?"),
      industrySelection: z.string().optional().describe("NAICS industry code (e.g., '5415')"),
      expectedAnnualRevenue: z.enum(["0_99999", "100000_999999", "1000000_9999999", "10000000_49999999", "50000000_249999999", "250000000_plus"]).optional().describe("Estimated annual revenue in USD"),
      expectedMonthlyPayments: z.string().optional().describe("Expected monthly payments in USD"),
      sourceOfFunds: z.enum(["BUSINESS_LOANS", "GRANTS", "INTER_COMPANY_FUNDS", "INVESTMENT_PROCEEDS", "LEGAL_SETTLEMENT", "OWNERS_CAPITAL", "PENSION_RETIREMENT", "SALE_OF_ASSETS", "SALES_OF_GOODS_AND_SERVICES", "THIRD_PARTY_FUNDS", "TREASURY_RESERVES"]).optional().describe("Source of funds"),
      sourceOfFundsDescription: z.string().optional().describe("Describe where your business funds come from"),
      operateInProhibitedCountry: z.boolean().optional().describe("Does your business operate in any prohibited countries?"),
      doesYourBusinessEngageInHighRiskActivities: z.enum(["yes", "no"]).optional().describe("Does your business engage in high risk activities?"),
      acceptTerms: z.boolean().optional().describe("Accept Stables' terms of service and privacy policy"),
      howDidYouComeAcrossStables: z.string().optional().describe("How did you come across Stables?"),
      // Shared fields
      externalCustomerId: z.string().optional().describe("Your own reference ID for this customer"),
      phone: z.string().optional().describe("Phone number with country code (e.g., '+14155552671')"),
      entitlements: z.array(z.enum(["base_payout", "virtual_account"])).optional().describe("List of entitlements to request"),
      // Address fields (for individuals)
      addressLine1: z.string().optional().describe("Street address line 1"),
      addressLine2: z.string().optional().describe("Street address line 2"),
      addressCity: z.string().optional().describe("City"),
      addressState: z.string().optional().describe("State or region"),
      addressPostalCode: z.string().optional().describe("Postal/ZIP code"),
      addressCountry: z.string().optional().describe("Two-letter country code (e.g., 'US')"),
      // Legal address fields (for businesses)
      legalAddressLine1: z.string().optional().describe("Legal address line 1 (for businesses)"),
      legalAddressLine2: z.string().optional().describe("Legal address line 2 (for businesses)"),
      legalAddressCity: z.string().optional().describe("Legal address city (for businesses)"),
      legalAddressState: z.string().optional().describe("Legal address state (for businesses)"),
      legalAddressPostalCode: z.string().optional().describe("Legal address postal code (for businesses)"),
      legalAddressCountry: z.string().optional().describe("Legal address country code (for businesses)"),
    },
    async (params) => {
      try {
        const isBusiness = params.customerType === "business";

        // Build address for individuals
        const address = (!isBusiness && params.addressLine1) ? {
          line1: params.addressLine1,
          line2: params.addressLine2,
          city: params.addressCity || "",
          state: params.addressState,
          postalCode: params.addressPostalCode,
          country: params.addressCountry || "",
        } : undefined;

        // Build legal address for businesses
        const legalAddress = (isBusiness && params.legalAddressLine1) ? {
          line1: params.legalAddressLine1,
          line2: params.legalAddressLine2,
          city: params.legalAddressCity || "",
          state: params.legalAddressState,
          postalCode: params.legalAddressPostalCode,
          country: params.legalAddressCountry || "",
        } : undefined;

        // Build request body based on customer type
        const requestBody: Record<string, unknown> = {
          email: params.email,
          customerType: isBusiness ? "CUSTOMER_TYPE_BUSINESS" : "CUSTOMER_TYPE_INDIVIDUAL",
          externalCustomerId: params.externalCustomerId || crypto.randomUUID(),
          phone: params.phone,
          entitlements: params.entitlements,
        };

        if (isBusiness) {
          Object.assign(requestBody, {
            companyName: params.companyName,
            country: params.country,
            registrationNumber: params.registrationNumber,
            incorporatedOn: params.incorporatedOn,
            type: params.type,
            taxId: params.taxId,
            registrationLocation: params.registrationLocation,
            website: params.website,
            legalAddress,
            describeBusiness: params.describeBusiness,
            conductMoneyServices: params.conductMoneyServices,
            describeMoneyServices: params.describeMoneyServices,
            describeComplianceControls: params.describeComplianceControls,
            mainSourceOfFunds: params.mainSourceOfFunds,
            accountPurpose: params.accountPurpose,
            accountPurposeOther: params.accountPurposeOther,
            isYourBusinessADao: params.isYourBusinessADao,
            industrySelection: params.industrySelection,
            expectedAnnualRevenue: params.expectedAnnualRevenue,
            expectedMonthlyPayments: params.expectedMonthlyPayments,
            sourceOfFunds: params.sourceOfFunds,
            sourceOfFundsDescription: params.sourceOfFundsDescription,
            operateInProhibitedCountry: params.operateInProhibitedCountry,
            doesYourBusinessEngageInHighRiskActivities: params.doesYourBusinessEngageInHighRiskActivities,
            acceptTerms: params.acceptTerms,
            howDidYouComeAcrossStables: params.howDidYouComeAcrossStables,
          });
        } else {
          Object.assign(requestBody, {
            firstName: params.firstName,
            lastName: params.lastName,
            middleName: params.middleName,
            dob: params.dob,
            nationality: params.nationality,
            address,
          });
        }

        // Remove undefined values
        for (const key of Object.keys(requestBody)) {
          if (requestBody[key] === undefined) delete requestBody[key];
        }

        const customer = await client.createCustomer(requestBody as unknown as CreateCustomerRequest);
        const verificationStatus = customer.verificationLevels?.[0]?.status || "NOT_STARTED";
        const entitlementsList = customer.entitlements?.map(e => `${e.name}: ${e.status}`).join(", ") || "None";

        return {
          content: [
            {
              type: "text",
              text: `Customer created successfully!

Customer ID: ${customer.customerId}
Email: ${customer.email}
Type: ${params.customerType}
${params.firstName ? `Name: ${params.firstName}${params.middleName ? ` ${params.middleName}` : ""} ${params.lastName || ""}` : ""}
${params.companyName ? `Company: ${params.companyName}` : ""}
${params.phone ? `Phone: ${params.phone}` : ""}
${params.nationality ? `Nationality: ${params.nationality}` : ""}
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
              text: `Failed to create customer: ${formatError(error)}`,
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
              text: `Failed to get customer: ${formatError(error)}`,
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
              text: `Failed to list customers: ${formatError(error)}`,
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
              text: `Failed to generate verification link: ${formatError(error)}`,
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
      middleName: z.string().optional().describe("Updated middle name"),
      dob: z.string().optional().describe("Updated date of birth (YYYY-MM-DD)"),
      nationality: z.string().optional().describe("Updated nationality (two-letter country code)"),
      companyName: z.string().optional().describe("Updated company name (for businesses)"),
      entitlements: z.array(z.enum(["base_payout", "virtual_account"])).optional().describe("Updated entitlements"),
    },
    async ({ customerId, email, phone, firstName, lastName, middleName, dob, nationality, companyName, entitlements }) => {
      try {
        const updates: Record<string, unknown> = {};
        if (email) updates.email = email;
        if (phone) updates.phone = phone;
        if (firstName) updates.firstName = firstName;
        if (lastName) updates.lastName = lastName;
        if (middleName) updates.middleName = middleName;
        if (dob) updates.dob = dob;
        if (nationality) updates.nationality = nationality;
        if (companyName) updates.companyName = companyName;
        if (entitlements) updates.entitlements = entitlements;

        const customer = await client.updateCustomer(customerId, updates);

        return {
          content: [
            {
              type: "text",
              text: `Customer ${customer.customerId} updated successfully.

Email: ${customer.email}
${customer.firstName ? `Name: ${customer.firstName} ${customer.lastName || ""}` : ""}
${customer.companyName ? `Company: ${customer.companyName}` : ""}
Updated: ${customer.updatedAt}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to update customer: ${formatError(error)}`,
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
              text: `Failed to update metadata: ${formatError(error)}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
