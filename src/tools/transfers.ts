/**
 * Transfer Tools for Stables MCP Server
 *
 * Mirrors POST /api/v1/transfer as of 2026-07-30. The wire is snake_case and the
 * payout target is a discriminated `destination`, not the old nested
 * `paymentMethod.bankTransfer`.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  StablesApiClient,
  BankTransferDestination,
  BeneficiaryAddress,
  PayoutExtras,
  Transfer,
  TransferDestination,
  TransferStatus,
} from "../lib/stables-client.js";

/**
 * Currencies whose payouts require a fuller beneficiary record. Named in the
 * tool description so the model collects them up front rather than after a
 * rejection — and because two of the three fail late, as a stuck transfer
 * rather than a clean 400.
 */
const ENHANCED_BENEFICIARY_CURRENCIES = "AED, CAD, EUR, GBP, MXN, USD";

/** Every fiat payout network the API names (ApiNetworkSchema). */
export const PAYOUT_NETWORKS = [
  "swift",
  "bank",
  "payid",
  "mobile_money",
  "ach",
  "fedwire",
  "fps",
  "chaps",
  "sepa",
  "sepa_instant",
  "fast",
  "chats",
  "unionpay",
] as const;

/** Networks a beneficiary can be saved on. PayID aliases are paid per transfer, never stored. */
export const BENEFICIARY_NETWORKS = ["bank", "swift", "mobile_money", "unionpay"] as const;

/** What each payout network is and needs, said once so every tool describes them alike. */
export const PAYOUT_NETWORK_GUIDE =
  "bank = the default domestic scheme, swift = international wire, payid = PayID alias (AUD), " +
  "mobile_money = a mobile money wallet (needs walletProvider and walletAccount, and no bank fields). " +
  "A named domestic scheme (ach, fedwire, fps, chaps, sepa, sepa_instant, fast, chats, unionpay) is refused where it is unavailable for the corridor. " +
  "unionpay = personal remittance to a bank account in mainland China in CNY: purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL, and the customer needs the cny_unionpay entitlement";

/** What a CNY bank payout asks for beyond the usual bank details. */
export const CNY_BANK_GUIDE =
  "A CNY bank payout needs nameInLocalLanguage and nationalIdentificationNumber, and for goods trade (purposeCode GENERAL_GOODS_TRADES) logisticsTrackingDetails and items";

const STATUS_EXPLANATIONS: Partial<Record<TransferStatus, string>> = {
  created: "Transfer has been created and is awaiting processing.",
  compliance_hold: "Transfer is on hold pending compliance review.",
  awaiting_funds_collection: "Waiting for the customer to send crypto funds.",
  funds_collected: "Crypto funds have been received, payout is being prepared.",
  in_progress: "Transfer is being processed.",
  payment_submitted: "Bank payment has been submitted for processing.",
  payment_processed: "Bank payment has been processed successfully.",
  completed: "Transfer completed successfully!",
  failed: "Transfer failed. Check with support for details.",
  cancelled: "Transfer was cancelled.",
  expired: "Transfer expired before completion.",
  refund_pending: "A refund of this transfer is in progress.",
  refunded: "Transfer was refunded, net of any processing fee.",
  refund_failed: "The refund did not go through. Check with support for details.",
  unknown: "Transfer state could not be determined.",
};

function describeType(type: string): string {
  if (type === "onramp") return "On-ramp (Fiat to Crypto)";
  if (type === "swap") return "Swap (Crypto to Crypto)";
  return "Off-ramp (Crypto to Fiat)";
}

function shortType(type: string): string {
  if (type === "onramp") return "On-ramp";
  if (type === "swap") return "Swap";
  return "Off-ramp";
}

function depositBlock(transfer: {
  type?: string;
  source_deposit_instructions?: Record<string, unknown>;
}): string {
  const deposit = transfer.source_deposit_instructions;
  const wallet = deposit?.["wallet_address"];
  if (!wallet) return "";
  return `
Deposit Instructions (share with customer):
  Wallet Address: ${String(wallet)}
  Currency: ${String(deposit?.["currency"] ?? "-")}
  Network: ${String(deposit?.["network"] ?? "-")}
  Amount: ${String(deposit?.["amount"] ?? "-")}

The customer must send this amount to that address. Once received, Stables ${
    transfer.type === "swap"
      ? "delivers the swap to the destination wallet"
      : "processes the payout"
  }.`;
}

// The API rejects anything else; listing them saves an agent a failed transfer.
export const PURPOSE_CODES = [
  "PAYMENT_FOR_SERVICES",
  "PAYMENT_FOR_SOFTWARE",
  "PAYMENT_FOR_IMPORTED_GOODS",
  "TRAVEL_SERVICES",
  "VENDOR_CONTRACTOR_PAYOUTS",
  "TRANSFER_TO_OWN_ACCOUNT",
  "INVESTMENT_IN_SHARES",
  "PURCHASE_OF_PROPERTY",
  "REPAYMENT_OF_LOANS",
  "SALARY",
  "PAYMENT_OF_PROPERTY_RENTAL",
  "INFORMATION_SERVICE_CHARGES",
  "ADVERTISING_PR_EXPENSES",
  "ROYALTY_FEES",
  "BROKER_COMMITMENT_FEES",
  "ADVISOR_TECHNICAL_FEES",
  "REPRESENTATIVE_OFFICE_EXPENSES",
  "TAX_PAYMENT",
  "TRANSPORTATION_FEES_FOR_GOODS",
  "CONSTRUCTION_COSTS",
  "INSURANCE_PREMIUM",
  "GENERAL_GOODS_TRADES",
  "INSURANCE_CLAIMS_PAYMENT",
  "FAMILY_MAINTENANCE",
  "EDUCATION_EXPENSES",
  "MEDICAL_TREATMENT",
  "DONATIONS",
  "MUTUAL_FUND_INVESTMENT",
  "CURRENCY_EXCHANGE",
  "USER_WITHDRAWAL",
  "ADVANCE_PAYMENTS_FOR_GOODS",
  "VENDOR_CONTRACTOR_SOFTWARE_PAYOUTS",
  "MERCHANT_SETTLEMENT",
  "REPATRIATION_FUND_SETTLEMENT",
  "PERSONAL_REMITTANCE",
  "RETURN_OF_FUNDS",
] as const;

/**
 * Recipient and account fields, shared by create_transfer, validate_payment_method,
 * create_beneficiary and create_payment_route.
 */
export const bankDestinationShape = {
  accountHolderName: z
    .string()
    .optional()
    .describe("Account holder's full name, or the company name when recipientType is business"),
  bankName: z
    .string()
    .optional()
    .describe("Name of the destination bank. Required unless paying a mobile money wallet"),
  bankCountry: z
    .string()
    .optional()
    .describe(
      "Bank country, ISO 2-letter (e.g. 'AU', 'US'). For mobile money, the country of the wallet"
    ),
  bankCurrency: z.string().optional().describe("Payout currency, ISO 3-letter (e.g. 'EUR')"),
  recipientType: z
    .enum(["individual", "business"])
    .optional()
    .describe(`Beneficiary type. Required for ${ENHANCED_BENEFICIARY_CURRENCIES}`),
  dateOfBirth: z
    .string()
    .optional()
    .describe(
      `Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for ${ENHANCED_BENEFICIARY_CURRENCIES}`
    ),
  phone: z
    .string()
    .optional()
    .describe("Beneficiary phone number in E.164 format (e.g. '+5215512345678')"),
  nameInLocalLanguage: z
    .string()
    .optional()
    .describe("Account holder name in the local language (e.g. Chinese characters for CNY)"),
  nationalIdentificationNumber: z
    .string()
    .optional()
    .describe("National identification number of the account holder"),
  addressStreet: z
    .string()
    .optional()
    .describe(
      "Beneficiary street address. Needed, with addressCountry, whenever an address is sent"
    ),
  addressCity: z.string().optional().describe("Beneficiary city"),
  addressState: z.string().optional().describe("Beneficiary state or region"),
  addressPostalCode: z.string().optional().describe("Beneficiary postal code"),
  addressCountry: z
    .string()
    .optional()
    .describe(
      `Beneficiary country, ISO 2-letter. The complete address is required for ${ENHANCED_BENEFICIARY_CURRENCIES}`
    ),
  bankAddressStreet: z
    .string()
    .optional()
    .describe(
      "Street address of the beneficiary's bank. A bank address is required for a USD SWIFT payout to an account the paying customer does not hold; street and country at minimum"
    ),
  bankAddressCity: z.string().optional().describe("City of the beneficiary's bank"),
  bankAddressState: z.string().optional().describe("State or region of the beneficiary's bank"),
  bankAddressPostalCode: z.string().optional().describe("Postal code of the beneficiary's bank"),
  bankAddressCountry: z
    .string()
    .optional()
    .describe("Country of the beneficiary's bank, ISO 2-letter"),
  walletProvider: z
    .string()
    .max(128)
    .optional()
    .describe(
      "Mobile money only: the wallet provider code, as listed for the corridor (e.g. 'mtn_gh'). Requires walletAccount, and every bank field (bankName, accountNumber, iban, bank codes) must be left out"
    ),
  walletAccount: z
    .string()
    .max(64)
    .optional()
    .describe(
      "Mobile money only: the wallet's identifier, such as its mobile number (e.g. '+233241234567'). Required with walletProvider"
    ),
  walletAccountType: z
    .enum(["mobile_number"])
    .optional()
    .describe(
      "Mobile money only: the kind of identifier in walletAccount. Only needed where the wallet provider accepts more than one"
    ),
  iban: z.string().optional().describe("IBAN (EU/international)"),
  accountNumber: z.string().optional().describe("Bank account number, if not using IBAN"),
  accountType: z
    .enum(["savings", "checking", "payment"])
    .optional()
    .describe("Account type. Required for CAD and USD bank payouts"),
  payId: z.string().optional().describe("PayID alias (AUD only). Requires payIdType"),
  payIdType: z
    .enum(["email", "phone_number", "abn", "acn", "organisation_id"])
    .optional()
    .describe("PayID alias type. Required when payId is given"),
  branchName: z.string().optional().describe("Bank branch name"),
  paymentRail: z
    .enum(["ach", "wire"])
    .optional()
    .describe(
      "USD payouts only: prefer ACH or wire. Omit for the account's default. A rail that is not available is refused"
    ),
  swiftCode: z.string().optional().describe("SWIFT code"),
  bicCode: z.string().optional().describe("BIC (EUR/GBP international)"),
  routingNumber: z.string().optional().describe("ABA routing number (US)"),
  sortCode: z.string().optional().describe("Sort code (UK)"),
  ifscCode: z.string().optional().describe("IFSC code (India)"),
  bsbCode: z.string().optional().describe("BSB code (Australia)"),
  bankCode: z.string().optional().describe("Bank code / institution number (CAD)"),
  branchCode: z.string().optional().describe("Branch code / transit number (CAD)"),
  cnaps: z.string().optional().describe("CNAPS (China)"),
};

/**
 * Supporting details for one payout. They travel with a transfer, whether it pays bank details
 * or a saved beneficiary, and are never saved on a beneficiary.
 */
export const payoutExtrasShape = {
  logisticsTrackingDetails: z
    .array(
      z.object({
        trackingNumber: z.string().optional().describe("Logistics tracking number"),
        logisticsProvider: z
          .object({
            name: z.string().optional().describe("Logistics provider name"),
            code: z.string().optional().describe("Logistics provider code"),
          })
          .optional(),
      })
    )
    .optional()
    .describe(
      "Shipment tracking for the goods the payout pays for. Required, with items, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES"
    ),
  items: z
    .array(
      z.object({
        name: z.string().max(512).describe("Name of the goods"),
        quantity: z.number().int().min(1).describe("Number of units"),
        unitPrice: z
          .string()
          .describe(
            "Price of one unit in the destination currency, major units, as a decimal string (e.g. '20.00')"
          ),
        description: z.string().max(512).optional().describe("Free-text description of the goods"),
      })
    )
    .min(1)
    .optional()
    .describe(
      "Goods the payout pays for, as invoice lines. Required, with logisticsTrackingDetails, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES"
    ),
  documents: z
    .array(
      z.object({
        type: z.enum(["invoice", "contract", "other"]).describe("Document type"),
        base64Url: z
          .string()
          .describe("The document as a base64 data URI (e.g. 'data:application/pdf;base64,...')"),
      })
    )
    .optional()
    .describe("Supporting documents for the payout, such as an invoice or contract"),
};

type BankDestinationInput = Partial<
  z.infer<z.ZodObject<typeof bankDestinationShape & typeof payoutExtrasShape>>
>;

/**
 * The bank fields a mobile money destination must not carry (the API's
 * MOBILE_MONEY_REFUSED_BANK_FIELDS, by input name): a wallet has no bank account, name or code.
 */
const MOBILE_MONEY_REFUSED_INPUTS = [
  "accountNumber",
  "iban",
  "bankName",
  "branchName",
  "bankAddressStreet",
  "bankAddressCity",
  "bankAddressState",
  "bankAddressPostalCode",
  "bankAddressCountry",
  "accountType",
  "swiftCode",
  "bicCode",
  "ifscCode",
  "routingNumber",
  "sortCode",
  "branchCode",
  "bsbCode",
  "bankCode",
  "cnaps",
  "payId",
  "payIdType",
  "paymentRail",
] as const satisfies readonly (keyof BankDestinationInput)[];

/**
 * An address as the API takes one: street and country always, the rest where the corridor asks.
 * Half an address used to be dropped here without a word, which read as "address missing" from
 * the API; now whatever was given is sent, or refused with the reason.
 */
function buildAddress(
  label: string,
  prefix: "address" | "bankAddress",
  parts: {
    street?: string;
    city?: string;
    state?: string;
    postalCode?: string;
    country?: string;
  }
): BeneficiaryAddress | undefined {
  if (!Object.values(parts).some(Boolean)) return undefined;
  if (!parts.street || !parts.country) {
    throw new Error(
      `${label} needs at least ${prefix}Street and ${prefix}Country; city, state and postal code are sent when given`
    );
  }
  return {
    street: parts.street,
    ...(parts.city && { city: parts.city }),
    ...(parts.state && { state: parts.state }),
    ...(parts.postalCode && { postal_code: parts.postalCode }),
    country: parts.country,
  };
}

/** The per-payout extras, in wire form. Shared by bank and saved-beneficiary destinations. */
export function buildPayoutExtras(input: BankDestinationInput): PayoutExtras {
  return {
    ...(input.logisticsTrackingDetails && {
      logistics_tracking_details: input.logisticsTrackingDetails.map((detail) => ({
        ...(detail.trackingNumber && { tracking_number: detail.trackingNumber }),
        ...(detail.logisticsProvider && { logistics_provider: detail.logisticsProvider }),
      })),
    }),
    ...(input.items && {
      items: input.items.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        ...(item.description && { description: item.description }),
      })),
    }),
    ...(input.documents && {
      documents: input.documents.map((document) => ({
        type: document.type,
        base64_url: document.base64Url,
      })),
    }),
  };
}

export function buildBankDestination(input: BankDestinationInput): BankTransferDestination {
  // Any wallet field makes this a mobile money destination, as the API reads it.
  const wallet = Boolean(input.walletProvider || input.walletAccount || input.walletAccountType);
  if (wallet) {
    if (!input.accountHolderName || !input.bankCountry || !input.bankCurrency) {
      throw new Error(
        "A mobile money destination needs accountHolderName, bankCountry (the wallet's country) and bankCurrency"
      );
    }
    if (!input.walletProvider || !input.walletAccount) {
      throw new Error("A mobile money destination needs both walletProvider and walletAccount");
    }
    const refused = MOBILE_MONEY_REFUSED_INPUTS.filter((field) => input[field]);
    if (refused.length > 0) {
      throw new Error(`A mobile money wallet takes no bank fields. Remove: ${refused.join(", ")}`);
    }
  } else if (
    !input.accountHolderName ||
    !input.bankName ||
    !input.bankCountry ||
    !input.bankCurrency
  ) {
    throw new Error(
      "A bank destination needs accountHolderName, bankName, bankCountry and bankCurrency"
    );
  }

  const address = buildAddress("A beneficiary address", "address", {
    street: input.addressStreet,
    city: input.addressCity,
    state: input.addressState,
    postalCode: input.addressPostalCode,
    country: input.addressCountry,
  });
  const bankAddress = buildAddress("A bank address", "bankAddress", {
    street: input.bankAddressStreet,
    city: input.bankAddressCity,
    state: input.bankAddressState,
    postalCode: input.bankAddressPostalCode,
    country: input.bankAddressCountry,
  });

  return {
    type: "bank",
    account_holder_name: input.accountHolderName,
    ...(input.bankName && { bank_name: input.bankName }),
    bank_country: input.bankCountry,
    currency: input.bankCurrency,
    ...(input.recipientType && { recipient_type: input.recipientType }),
    ...(input.dateOfBirth && { date_of_birth: input.dateOfBirth }),
    ...(input.phone && { phone: input.phone }),
    ...(address && { address }),
    ...(bankAddress && { bank_address: bankAddress }),
    ...(input.iban && { iban: input.iban }),
    ...(input.accountNumber && { account_number: input.accountNumber }),
    ...(input.accountType && { account_type: input.accountType }),
    ...(input.payId && { pay_id: input.payId }),
    ...(input.payIdType && { pay_id_type: input.payIdType }),
    ...(input.walletProvider && { wallet_provider: input.walletProvider }),
    ...(input.walletAccount && { wallet_account: input.walletAccount }),
    ...(input.walletAccountType && { wallet_account_type: input.walletAccountType }),
    ...(input.branchName && { branch_name: input.branchName }),
    ...(input.paymentRail && { payment_rail: input.paymentRail }),
    ...(input.swiftCode && { swift_code: input.swiftCode }),
    ...(input.bicCode && { bic_code: input.bicCode }),
    ...(input.routingNumber && { aba_code: input.routingNumber }),
    ...(input.sortCode && { sort_code: input.sortCode }),
    ...(input.ifscCode && { ifsc_code: input.ifscCode }),
    ...(input.bsbCode && { bsb_code: input.bsbCode }),
    ...(input.bankCode && { bank_code: input.bankCode }),
    ...(input.branchCode && { branch_code: input.branchCode }),
    ...(input.cnaps && { cnaps: input.cnaps }),
    ...(input.nameInLocalLanguage && { name_in_local_language: input.nameInLocalLanguage }),
    ...(input.nationalIdentificationNumber && {
      national_identification_number: input.nationalIdentificationNumber,
    }),
    ...buildPayoutExtras(input),
  };
}

/** Tracking, payment reference, hold and refund lines for get_transfer; empty when none apply. */
function transferExtras(transfer: Transfer): string {
  const lines: string[] = [];
  if (transfer.payment_reference) lines.push(`Payment Reference: ${transfer.payment_reference}`);
  if (transfer.account_ownership) lines.push(`Account Ownership: ${transfer.account_ownership}`);

  for (const record of transfer.tracking ?? []) {
    if (record.data.number) lines.push(`Tracking (${record.type}): ${record.data.number}`);
    const file = record.data.file;
    if (file) {
      lines.push(`Tracking (${record.type}): ${file.name} (${file.media_type})`, file.content);
    }
  }

  const hold = transfer.compliance_hold;
  if (hold) {
    lines.push(`Compliance Hold (RFI ${hold.rfi_id}; see 'get_rfi'):`);
    for (const reason of hold.reasons) {
      lines.push(`  Reason: ${reason.description} (${reason.reason_code})`);
    }
    for (const requirement of hold.requirements) {
      const needs =
        requirement.required_capability ??
        requirement.required_level ??
        requirement.required_evidence;
      lines.push(
        `  Requirement: ${requirement.type}${needs ? ` ${needs}` : ""} - ${requirement.status}`
      );
    }
  }

  const refund = transfer.refund;
  if (refund) {
    const to =
      refund.destination.type === "prefund_wallet"
        ? `your balance wallet ${refund.destination.address} (${refund.destination.network})`
        : refund.destination.type === "bank_account"
          ? `bank account ${refund.destination.account_masked}`
          : "the original source";
    lines.push(
      `Refund: ${refund.status}`,
      `  Amount: ${refund.amount} ${refund.currency} (fee ${refund.fee}, net ${refund.net})`,
      `  Returned to: ${to}`,
      `  Requested: ${refund.requested_at}`
    );
    if (refund.tx_hash) lines.push(`  Transaction: ${refund.tx_hash}`);
    if (refund.provider_reference) lines.push(`  Reference: ${refund.provider_reference}`);
    if (refund.completed_at) lines.push(`  Completed: ${refund.completed_at}`);
    if (refund.failed_at) lines.push(`  Failed: ${refund.failed_at}`);
  }

  return lines.length > 0 ? `\n${lines.join("\n")}\n` : "";
}

export function registerTransferTools(server: McpServer, client: StablesApiClient) {
  // Create Transfer
  server.tool(
    "create_transfer",
    "Create a transfer from an active quote. The quote must not be expired. " +
      "With fundingSource fund_transfer (the default) this only creates the transfer and returns deposit instructions; no money moves until someone deposits the funds. " +
      "With prefund_balance it debits your organisation's balance and starts the payout immediately, so this moves real money: get explicit human approval first. " +
      `For payouts in ${ENHANCED_BENEFICIARY_CURRENCIES} you must also supply recipientType, the full beneficiary address, and dateOfBirth when the recipient is an individual. ` +
      "To pay one of the organisation's saved beneficiaries, set destinationType to beneficiary and pass its beneficiaryId instead of bank details. " +
      "The payout network comes from the quote. To pay a mobile money wallet (a mobile_money quote), keep destinationType bank and send walletProvider and walletAccount with accountHolderName, bankCountry and bankCurrency, and no bank fields. " +
      `${CNY_BANK_GUIDE}. A unionpay quote is a personal remittance to mainland China: purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL. ` +
      "For a swap (a quote between two stablecoins or two networks), set destinationType to crypto with destinationCurrency, destinationNetwork and destinationAddress; currency and network must match the quote. A swap is funded by a deposit (fund_transfer) and needs no bank details or purposeCode.",
    {
      customerId: z.string().describe("The customer ID for this transfer"),
      quoteId: z.string().describe("The quote ID to execute"),
      destinationType: z
        .enum(["bank", "crypto", "beneficiary"])
        .default("bank")
        .describe(
          "Payout target: a bank account (off-ramp), a wallet address (swap), or a saved beneficiary"
        ),
      beneficiaryId: z
        .string()
        .optional()
        .describe(
          "Saved beneficiary id when destinationType is beneficiary. It supplies the recipient and bank details, so the bank fields are ignored (logisticsTrackingDetails, items and documents still travel with the payout); archived beneficiaries are refused"
        ),

      ...bankDestinationShape,
      ...payoutExtrasShape,

      destinationCurrency: z
        .string()
        .optional()
        .describe(
          "Stablecoin to deliver when destinationType is crypto (e.g. 'USDT'). Must match the quote's destination currency"
        ),
      destinationNetwork: z
        .string()
        .optional()
        .describe(
          "Blockchain network when destinationType is crypto (e.g. 'polygon'). Must match the quote's destination network"
        ),
      destinationAddress: z
        .string()
        .optional()
        .describe(
          "Wallet address when destinationType is crypto. It must be valid on destinationNetwork: funds sent to a wrong address cannot be recovered"
        ),

      purposeCode: z
        .enum(PURPOSE_CODES)
        .optional()
        .describe("Purpose of the transfer (e.g. 'SALARY'). Required on some corridors"),
      paymentReference: z
        .string()
        .max(35)
        .optional()
        .describe(
          "Text sent with a bank payout so the recipient can tell what it is for, such as an invoice number. Up to 35 characters: letters, digits, spaces and / - ? : ( ) . , ' + only. Some payouts carry less and refuse a reference that does not fit. No effect on a crypto destination"
        ),
      accountOwnership: z
        .enum(["first_party", "third_party"])
        .optional()
        .describe(
          "Whose bank account the payout pays: the customer's own (first_party) or someone else's (third_party). A third_party payout needs a purposeCode, and is refused where this type of customer may only pay their own account. No effect on a crypto destination"
        ),
      sourceWallet: z
        .object({
          type: z
            .enum(["hosted", "self_hosted"])
            .describe(
              "hosted when the sending wallet belongs to an exchange or other VASP, self_hosted when the customer controls the keys"
            ),
          vaspId: z
            .string()
            .max(64)
            .optional()
            .describe(
              "Travel Rule directory id of the VASP hosting the wallet, when type is hosted"
            ),
          vaspName: z
            .string()
            .max(200)
            .optional()
            .describe("Name of the VASP hosting the wallet, when type is hosted"),
        })
        .optional()
        .describe(
          "Custody of the wallet the customer will send from, for the travel rule. Defaults to self_hosted when omitted"
        ),
      fundingSource: z
        .enum(["fund_transfer", "prefund_balance"])
        .optional()
        .describe(
          "fund_transfer (default) creates the transfer and returns deposit instructions; nothing moves until a person deposits the funds. prefund_balance debits your organisation's balance and starts the payout immediately, so it needs explicit human approval. Check get_balance first: transfers_enabled must be true and the quote's source asset must be held on its network"
        ),
      metadata: z.record(z.string(), z.string()).optional().describe("Optional metadata"),
    },
    async (input) => {
      try {
        let destination: TransferDestination;

        if (input.destinationType === "crypto") {
          if (
            !input.destinationCurrency ||
            !input.destinationNetwork ||
            !input.destinationAddress
          ) {
            throw new Error(
              "A crypto destination needs destinationCurrency, destinationNetwork and destinationAddress"
            );
          }
          destination = {
            type: "crypto",
            currency: input.destinationCurrency,
            network: input.destinationNetwork,
            address: input.destinationAddress,
          };
        } else if (input.destinationType === "beneficiary") {
          if (!input.beneficiaryId) {
            throw new Error("A beneficiary destination needs beneficiaryId");
          }
          destination = {
            type: "beneficiary",
            beneficiary_id: input.beneficiaryId,
            ...buildPayoutExtras(input),
          };
        } else {
          destination = buildBankDestination(input);
        }

        const transfer = await client.createTransfer({
          customer_id: input.customerId,
          quote_id: input.quoteId,
          destination,
          ...(input.purposeCode && { purpose_code: input.purposeCode }),
          ...(input.paymentReference && { payment_reference: input.paymentReference }),
          ...(input.accountOwnership && { account_ownership: input.accountOwnership }),
          ...(input.fundingSource && { funding_source: input.fundingSource }),
          ...(input.sourceWallet && {
            source_wallet: {
              type: input.sourceWallet.type,
              ...(input.sourceWallet.vaspId && { vasp_id: input.sourceWallet.vaspId }),
              ...(input.sourceWallet.vaspName && { vasp_name: input.sourceWallet.vaspName }),
            },
          }),
          ...(input.metadata && { metadata: input.metadata }),
        });

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfer created successfully!

Transfer ID: ${transfer.id}
Type: ${describeType(transfer.type)}
Status: ${transfer.status}
Customer ID: ${transfer.customer_id}
Quote ID: ${transfer.quote_id}

Created: ${transfer.created_at}
${depositBlock(transfer)}

Use 'get_transfer' to check the status.`,
            },
          ],
        };
      } catch (error: unknown) {
        const apiError = error as { message?: string; statusCode?: number; errorBody?: unknown };
        // The API returns a `fields` array on beneficiary validation failures;
        // dumping the body keeps that detail instead of flattening it away.
        const details = apiError.errorBody
          ? `\nAPI Response: ${JSON.stringify(apiError.errorBody, null, 2)}`
          : "";
        const status = apiError.statusCode ? ` (HTTP ${apiError.statusCode})` : "";
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to create transfer${status}: ${error instanceof Error ? error.message : "Unknown error"}${details}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Validate Payment Method
  server.tool(
    "validate_payment_method",
    "Check payout details (a bank account or a mobile money wallet) against the corridor's rules without creating anything. Use it before create_transfer to find out which fields a currency and network need (beneficiary address, date of birth, bank codes, wallet details), instead of spending a short-lived quote on a rejected transfer. " +
      `Networks: ${PAYOUT_NETWORK_GUIDE}. ${CNY_BANK_GUIDE}.`,
    {
      network: z
        .enum(PAYOUT_NETWORKS)
        .describe(
          "Payout network to validate against: bank (default domestic scheme), swift, payid (AUD), mobile_money, or a named domestic scheme"
        ),
      quoteId: z.string().optional().describe("Validate against this quote's corridor"),
      purposeCode: z
        .enum(PURPOSE_CODES)
        .optional()
        .describe(
          "The purpose the transfer will carry. Some corridors ask for different supporting details per purpose (CNY: logisticsTrackingDetails and items for goods trade, a document for services); without it every such detail is required"
        ),
      ...bankDestinationShape,
      ...payoutExtrasShape,
    },
    async ({ network, quoteId, purposeCode, ...input }) => {
      try {
        const result = await client.validatePaymentMethod(
          network,
          buildBankDestination(input),
          quoteId,
          purposeCode
        );
        if (result.valid) {
          return {
            content: [
              {
                type: "text",
                text: "Valid: these payout details pass every rule for this corridor.",
              },
            ],
          };
        }
        const errors = (result.errors ?? [])
          .map((e) => `- ${e.field ? `${e.field}: ` : ""}${e.message} (${e.code})`)
          .join("\n");
        return { content: [{ type: "text", text: `Not valid:\n${errors}` }] };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to validate payment method: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get Transfer
  server.tool(
    "get_transfer",
    "Get the current status and details of a transfer, including its payment reference, a SWIFT payout's tracking (UETR, then the MT103 once issued), an open compliance hold and any refund",
    {
      transferId: z.string().describe("The transfer ID to look up"),
    },
    async ({ transferId }) => {
      try {
        const transfer = await client.getTransfer(transferId);
        const statusInfo = STATUS_EXPLANATIONS[transfer.status] ?? "";

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfer Details:

Transfer ID: ${transfer.id}
Type: ${describeType(transfer.type)}
Status: ${transfer.status}
Customer ID: ${transfer.customer_id}
Quote ID: ${transfer.quote_id}

Created: ${transfer.created_at}
Updated: ${transfer.updated_at}
${transferExtras(transfer)}${depositBlock(transfer)}

${statusInfo}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to get transfer: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // List Transfers
  server.tool(
    "list_transfers",
    "List transfers with optional filters for status, type, or customer",
    {
      status: z
        .enum([
          "created",
          "compliance_hold",
          "awaiting_funds_collection",
          "funds_collected",
          "in_progress",
          "payment_submitted",
          "payment_processed",
          "completed",
          "failed",
          "cancelled",
          "expired",
          "refund_pending",
          "refunded",
          "refund_failed",
        ])
        .optional()
        .describe("Filter by transfer status"),
      type: z
        .enum(["onramp", "offramp", "swap"])
        .optional()
        .describe("Filter by transfer type. swap is crypto to crypto"),
      customerId: z.string().optional().describe("Filter by customer ID"),
      pageSize: z.number().optional().describe("Number of transfers per page (default: 20)"),
      pageToken: z.string().optional().describe("Token for the next page of results"),
    },
    async ({ status, type, customerId, pageSize, pageToken }) => {
      try {
        const response = await client.listTransfers({
          status,
          type,
          customerId,
          pageSize,
          pageToken,
        });

        if (response.transfers.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No transfers found matching your criteria.",
              },
            ],
          };
        }

        const transferList = response.transfers
          .map((t) => {
            return `- ${t.id}: ${shortType(t.type)} - ${t.status} (Customer: ${t.customer_id})`;
          })
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Transfers (${response.transfers.length} of ${response.page.total}):

${transferList}
${response.page.next_page_token ? `\nMore results available. Use pageToken: "${response.page.next_page_token}"` : ""}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Failed to list transfers: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}
