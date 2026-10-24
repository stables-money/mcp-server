### Customers

#### create_customer

Create a new customer in Stables for KYC verification and transfers. Use 'individual' for personal accounts or 'business' for company accounts. Include entitlements like 'base_payout' to enable transactions.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | No | Customer's email address |
| `customerType` | `individual` \| `business` | Yes | Type of customer - 'individual' for personal, 'business' for companies |
| `firstName` | string | No | First name (required for individuals) |
| `lastName` | string | No | Last name (required for individuals) |
| `middleName` | string | No | Middle name |
| `dob` | string | No | Date of birth in YYYY-MM-DD format (e.g., '1990-01-15') |
| `nationality` | string | No | Two-letter country code (e.g., 'US', 'GB') |
| `companyName` | string | No | Company name (required for businesses) |
| `country` | string | No | Country code ISO 3166-1 alpha-2 (required for businesses, e.g., 'US') |
| `registrationNumber` | string | No | Business registration number |
| `incorporatedOn` | string | No | Date of incorporation in YYYY-MM-DD format |
| `type` | string | No | Company type (e.g., 'Private Company Limited by Shares') |
| `taxId` | string | No | Tax ID (e.g., '12-3456789') |
| `registrationLocation` | string | No | Registration location (e.g., state for USA) |
| `website` | string | No | Website URL |
| `describeBusiness` | string | No | Description of the business |
| `conductMoneyServices` | boolean | No | Whether the company conducts money services |
| `describeMoneyServices` | string | No | Describe money services (required if conductMoneyServices is true) |
| `describeComplianceControls` | string | No | Description of compliance controls |
| `accountPurpose` | `CHARITABLE_DONATIONS` \| `ECOMMERCE_RETAIL_PAYMENTS` \| `INVESTMENT_PURPOSES` \| `PAYMENTS_TO_FRIENDS_OR_FAMILY_ABROAD` \| `PAYROLL` \| `PERSONAL_OR_LIVING_EXPENSES` \| `PROTECT_WEALTH` \| `PURCHASE_GOODS_AND_SERVICES` \| `RECEIVE_PAYMENTS_FOR_GOODS_AND_SERVICES` \| `TAX_OPTIMIZATION` \| `THIRD_PARTY_MONEY_TRANSMISSION` \| `TREASURY_MANAGEMENT` \| `OTHER` | No | What will you use Stables for? |
| `accountPurposeOther` | string | No | Explain purpose (required if accountPurpose is OTHER) |
| `expectedAnnualRevenue` | `0_99999` \| `100000_999999` \| `1000000_9999999` \| `10000000_49999999` \| `50000000_249999999` \| `250000000_plus` | No | Estimated annual revenue in USD |
| `expectedMonthlyPayments` | string | No | Expected monthly payments in USD |
| `sourceOfFunds` | `BUSINESS_LOANS` \| `GRANTS` \| `INTER_COMPANY_FUNDS` \| `INVESTMENT_PROCEEDS` \| `LEGAL_SETTLEMENT` \| `OWNERS_CAPITAL` \| `PENSION_RETIREMENT` \| `SALE_OF_ASSETS` \| `SALES_OF_GOODS_AND_SERVICES` \| `THIRD_PARTY_FUNDS` \| `TREASURY_RESERVES` | No | Source of funds |
| `sourceOfFundsDescription` | string | No | Describe where your business funds come from |
| `operateInProhibitedCountry` | boolean | No | Does your business operate in any prohibited countries? |
| `doesYourBusinessEngageInHighRiskActivities` | `yes` \| `no` | No | Does your business engage in high risk activities? |
| `acceptTerms` | boolean | No | Accept Stables' terms of service and privacy policy |
| `externalCustomerId` | string | No | Your own reference ID for this customer |
| `phone` | string | No | Phone number with country code (e.g., '+14155552671') |
| `entitlements` | array of `base_payout` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | List of entitlements to request |
| `addressLine1` | string | No | Street address line 1 |
| `addressLine2` | string | No | Street address line 2 |
| `addressCity` | string | No | City |
| `addressState` | string | No | State or region |
| `addressPostalCode` | string | No | Postal/ZIP code |
| `addressCountry` | string | No | Two-letter country code (e.g., 'US') |
| `legalAddressLine1` | string | No | Legal address line 1 (for businesses) |
| `legalAddressLine2` | string | No | Legal address line 2 (for businesses) |
| `legalAddressCity` | string | No | Legal address city (for businesses) |
| `legalAddressState` | string | No | Legal address state (for businesses) |
| `legalAddressPostalCode` | string | No | Legal address postal code (for businesses) |
| `legalAddressCountry` | string | No | Legal address country code (for businesses) |

#### create_customer_onboarding_link

Create a customer and get a hosted verification link for them in one call, so the customer enters their own KYC/KYB details. An existing customer with the same email is reused (customer_created is false) and the fields sent are ignored. Takes the same fields as create_customer; send what you already know.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `email` | string | No | Customer's email address |
| `customerType` | `individual` \| `business` | Yes | Type of customer - 'individual' for personal, 'business' for companies |
| `firstName` | string | No | First name (required for individuals) |
| `lastName` | string | No | Last name (required for individuals) |
| `middleName` | string | No | Middle name |
| `dob` | string | No | Date of birth in YYYY-MM-DD format (e.g., '1990-01-15') |
| `nationality` | string | No | Two-letter country code (e.g., 'US', 'GB') |
| `companyName` | string | No | Company name (required for businesses) |
| `country` | string | No | Country code ISO 3166-1 alpha-2 (required for businesses, e.g., 'US') |
| `registrationNumber` | string | No | Business registration number |
| `incorporatedOn` | string | No | Date of incorporation in YYYY-MM-DD format |
| `type` | string | No | Company type (e.g., 'Private Company Limited by Shares') |
| `taxId` | string | No | Tax ID (e.g., '12-3456789') |
| `registrationLocation` | string | No | Registration location (e.g., state for USA) |
| `website` | string | No | Website URL |
| `describeBusiness` | string | No | Description of the business |
| `conductMoneyServices` | boolean | No | Whether the company conducts money services |
| `describeMoneyServices` | string | No | Describe money services (required if conductMoneyServices is true) |
| `describeComplianceControls` | string | No | Description of compliance controls |
| `accountPurpose` | `CHARITABLE_DONATIONS` \| `ECOMMERCE_RETAIL_PAYMENTS` \| `INVESTMENT_PURPOSES` \| `PAYMENTS_TO_FRIENDS_OR_FAMILY_ABROAD` \| `PAYROLL` \| `PERSONAL_OR_LIVING_EXPENSES` \| `PROTECT_WEALTH` \| `PURCHASE_GOODS_AND_SERVICES` \| `RECEIVE_PAYMENTS_FOR_GOODS_AND_SERVICES` \| `TAX_OPTIMIZATION` \| `THIRD_PARTY_MONEY_TRANSMISSION` \| `TREASURY_MANAGEMENT` \| `OTHER` | No | What will you use Stables for? |
| `accountPurposeOther` | string | No | Explain purpose (required if accountPurpose is OTHER) |
| `expectedAnnualRevenue` | `0_99999` \| `100000_999999` \| `1000000_9999999` \| `10000000_49999999` \| `50000000_249999999` \| `250000000_plus` | No | Estimated annual revenue in USD |
| `expectedMonthlyPayments` | string | No | Expected monthly payments in USD |
| `sourceOfFunds` | `BUSINESS_LOANS` \| `GRANTS` \| `INTER_COMPANY_FUNDS` \| `INVESTMENT_PROCEEDS` \| `LEGAL_SETTLEMENT` \| `OWNERS_CAPITAL` \| `PENSION_RETIREMENT` \| `SALE_OF_ASSETS` \| `SALES_OF_GOODS_AND_SERVICES` \| `THIRD_PARTY_FUNDS` \| `TREASURY_RESERVES` | No | Source of funds |
| `sourceOfFundsDescription` | string | No | Describe where your business funds come from |
| `operateInProhibitedCountry` | boolean | No | Does your business operate in any prohibited countries? |
| `doesYourBusinessEngageInHighRiskActivities` | `yes` \| `no` | No | Does your business engage in high risk activities? |
| `acceptTerms` | boolean | No | Accept Stables' terms of service and privacy policy |
| `externalCustomerId` | string | No | Your own reference ID for this customer |
| `phone` | string | No | Phone number with country code (e.g., '+14155552671') |
| `entitlements` | array of `base_payout` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | List of entitlements to request |
| `addressLine1` | string | No | Street address line 1 |
| `addressLine2` | string | No | Street address line 2 |
| `addressCity` | string | No | City |
| `addressState` | string | No | State or region |
| `addressPostalCode` | string | No | Postal/ZIP code |
| `addressCountry` | string | No | Two-letter country code (e.g., 'US') |
| `legalAddressLine1` | string | No | Legal address line 1 (for businesses) |
| `legalAddressLine2` | string | No | Legal address line 2 (for businesses) |
| `legalAddressCity` | string | No | Legal address city (for businesses) |
| `legalAddressState` | string | No | Legal address state (for businesses) |
| `legalAddressPostalCode` | string | No | Legal address postal code (for businesses) |
| `legalAddressCountry` | string | No | Legal address country code (for businesses) |
| `ttlInSecs` | integer | No | Link lifetime in seconds (default 1800) |
| `successUrl` | string | No | Where to send the customer after verification succeeds |
| `rejectUrl` | string | No | Where to send the customer if verification is rejected |
| `verificationType` | `liveness` \| `age_risk` \| `passport` \| `source_of_wealth` \| `proof_of_address` | No | Run one verification step instead of the full flow |

#### get_customer

Get details about a specific customer including their verification status

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to look up |
| `include` | array of `verification-profile` \| `doc-images` \| `all` | No | Also return the normalized KYC/KYB data ('verification-profile') or submitted document images ('doc-images'). Slower; only to sync verification data |

#### list_customers

List customers for the authenticated tenant. Without pageSize the API returns its default first page; pass pageSize and follow pageToken to read them all

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pageSize` | integer | No | Customers per page |
| `pageToken` | string | No | next_page_token from the previous page |

#### get_verification_link

Generate a KYC verification link for a customer. The customer must complete verification before they can make transfers.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to generate verification link for |
| `ttlInSecs` | number | No | Time-to-live for the KYC link in seconds (default: 1800) |
| `successUrl` | string | No | URL to redirect to after successful verification |
| `rejectUrl` | string | No | URL to redirect to after rejected verification |
| `verificationType` | `liveness` \| `passport` \| `source_of_wealth` \| `proof_of_address` \| `business_edd` | No | Run one verification step instead of the full flow, e.g. 'proof_of_address' when an RFI asks for it |

#### update_customer

Update customer details, entitlements, or verification information

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to update |
| `email` | string | No | Updated email address |
| `phone` | string | No | Updated phone number |
| `firstName` | string | No | Updated first name |
| `lastName` | string | No | Updated last name |
| `middleName` | string | No | Updated middle name |
| `dob` | string | No | Updated date of birth (YYYY-MM-DD) |
| `nationality` | string | No | Updated nationality (two-letter country code) |
| `companyName` | string | No | Updated company name (for businesses) |
| `entitlements` | array of `base_payout` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | Updated entitlements |

#### update_customer_metadata

Update customer metadata key-value pairs

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to update metadata for |
| `metadata` | object | Yes | Metadata key-value pairs to set |

### Entitlements

#### list_available_entitlements

List the entitlements (products and payment rails, e.g. 'aed_local') a customer has not applied for yet, whether each is available to them now, and the verification it needs.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |

#### request_entitlements

Apply for one or more entitlements for an existing customer, e.g. to add a payment rail. Check list_available_entitlements first. If Stables needs more verification, the response lists what is missing; send it with submit_entitlement_requirements.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `entitlements` | array of `base_payout` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | Yes | Entitlement names, e.g. ['aed_local'] |

#### submit_entitlement_requirements

Send further verification data Stables asked for on a requested entitlement. The fields are those of the customer record in snake_case (e.g. tax_id_number, address, financial_profile, id_documents, proof_of_address_documents); send only what is missing. Documents are base64 data.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `entitlement` | string | Yes | The entitlement name, e.g. 'aed_local' |
| `requirements` | object | Yes | The missing fields, snake_case as in the Update Customer reference |

### Quotes

#### create_quote

Get a quote for a currency exchange: the rate, the fees, and what the customer receives. Quotes are short-lived, so create one immediately before the transfer. Off-ramp converts a stablecoin to fiat (source network required, destination country required); on-ramp converts fiat to a stablecoin (destination address required). Set preview to price without committing.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sourceCurrency` | string | Yes | Source currency: a stablecoin for off-ramp (e.g. 'USDT'), fiat for on-ramp |
| `sourceAmount` | string | Yes | Amount to convert, in major units (e.g. '125.75') |
| `sourceNetwork` | `arbitrum` \| `avalanche` \| `base` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `tron` | No | Blockchain network of the source. Required for off-ramp, omitted for on-ramp |
| `destinationCurrency` | string | Yes | Destination currency: fiat for off-ramp (e.g. 'EUR'), a stablecoin for on-ramp |
| `destinationCountry` | string | No | Destination country, ISO 2-letter. Required for off-ramp |
| `destinationNetwork` | string | No | Off-ramp: payment network, 'swift' or 'bank'. On-ramp: blockchain network. Replaces the old paymentMethodType |
| `destinationAddress` | string | No | Destination wallet address. Required for on-ramp |
| `preview` | boolean | No | Price the quote without persisting it, to show an estimate |
| `metadata` | object | No | Optional metadata |

#### get_quote

Get details about an existing quote including its current status

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `quoteId` | string | Yes | The quote ID to look up |

### Transfers

#### validate_payment_method

Check bank payout details against the corridor's rules without creating anything. Use it before create_transfer to find out which fields a currency needs (beneficiary address, date of birth, bank codes), instead of spending a short-lived quote on a rejected transfer.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `bank` \| `swift` \| `payid` | Yes | Payout network: local bank rails, SWIFT, or PayID (AUD) |
| `quoteId` | string | No | Validate against this quote's corridor |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US') |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `addressStreet` | string | No | Beneficiary street address |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |

#### create_transfer

Execute a transfer using an active quote. The quote must not be expired. This initiates real money movement, so get explicit human approval first. For payouts in AED, CAD, EUR, GBP, MXN, USD you must also supply recipientType, the full beneficiary address, and dateOfBirth when the recipient is an individual.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID for this transfer |
| `quoteId` | string | Yes | The quote ID to execute |
| `destinationType` | `bank` \| `crypto` | No | Payout target: a bank account (off-ramp) or a wallet address. Default: `"bank"`. |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US') |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `addressStreet` | string | No | Beneficiary street address |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |
| `destinationCurrency` | string | No | Stablecoin to deliver when destinationType is crypto (e.g. 'USDT') |
| `destinationNetwork` | string | No | Blockchain network when destinationType is crypto (e.g. 'polygon') |
| `destinationAddress` | string | No | Wallet address when destinationType is crypto |
| `purposeCode` | `PAYMENT_FOR_SERVICES` \| `PAYMENT_FOR_SOFTWARE` \| `PAYMENT_FOR_IMPORTED_GOODS` \| `TRAVEL_SERVICES` \| `VENDOR_CONTRACTOR_PAYOUTS` \| `TRANSFER_TO_OWN_ACCOUNT` \| `INVESTMENT_IN_SHARES` \| `PURCHASE_OF_PROPERTY` \| `REPAYMENT_OF_LOANS` \| `SALARY` \| `PAYMENT_OF_PROPERTY_RENTAL` \| `INFORMATION_SERVICE_CHARGES` \| `ADVERTISING_PR_EXPENSES` \| `ROYALTY_FEES` \| `BROKER_COMMITMENT_FEES` \| `ADVISOR_TECHNICAL_FEES` \| `REPRESENTATIVE_OFFICE_EXPENSES` \| `TAX_PAYMENT` \| `TRANSPORTATION_FEES_FOR_GOODS` \| `CONSTRUCTION_COSTS` \| `INSURANCE_PREMIUM` \| `GENERAL_GOODS_TRADES` \| `INSURANCE_CLAIMS_PAYMENT` \| `FAMILY_MAINTENANCE` \| `EDUCATION_EXPENSES` \| `MEDICAL_TREATMENT` \| `DONATIONS` \| `MUTUAL_FUND_INVESTMENT` \| `CURRENCY_EXCHANGE` \| `USER_WITHDRAWAL` \| `ADVANCE_PAYMENTS_FOR_GOODS` \| `VENDOR_CONTRACTOR_SOFTWARE_PAYOUTS` \| `MERCHANT_SETTLEMENT` \| `REPATRIATION_FUND_SETTLEMENT` \| `PERSONAL_REMITTANCE` \| `RETURN_OF_FUNDS` | No | Purpose of the transfer (e.g. 'SALARY'). Required on some corridors |
| `fundingSource` | `fund_transfer` \| `prefund_balance` | No | fund_transfer (default) returns deposit instructions for the customer; prefund_balance pays from your organisation's balance and starts immediately. Check get_balance first: transfers_enabled must be true and the quote's source asset must be held on its network |
| `metadata` | object | No | Optional metadata |

#### get_transfer

Get the current status and details of a transfer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer ID to look up |

#### list_transfers

List transfers with optional filters for status, type, or customer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `created` \| `compliance_hold` \| `awaiting_funds_collection` \| `funds_collected` \| `in_progress` \| `payment_submitted` \| `payment_processed` \| `completed` \| `failed` \| `cancelled` \| `expired` | No | Filter by transfer status |
| `type` | `onramp` \| `offramp` | No | Filter by transfer type |
| `customerId` | string | No | Filter by customer ID |
| `pageSize` | number | No | Number of transfers per page (default: 20) |
| `pageToken` | string | No | Token for the next page of results |

### Payment routes

#### create_virtual_account

Create a payment route (virtual bank account) so a customer can receive fiat deposits that convert to a stablecoin and pay out to a wallet. The payout destination is mandatory: the API refuses a fiat-to-crypto route without one. Deposit handling is set server-side and defaults to auto_payout; change it afterwards with update_virtual_account.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to create the payment route for |
| `sourceCurrency` | string | Yes | Fiat currency the route collects in (e.g. 'AUD', 'USD', 'EUR') |
| `destinationAddress` | string | Yes | Wallet address deposits are paid out to. Validated against the chosen network |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | Yes | Blockchain network the payout address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | Stablecoin to receive. Default: `"usdt"`. |

#### list_virtual_accounts

List payment routes (virtual accounts) for one customer, or across every customer when customerId is omitted

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | No | Only this customer's routes; omit to list routes across all customers |
| `status` | `activated` \| `deactivated` \| `pending` \| `closed` | No | Filter by account status |
| `limit` | number | No | Maximum number of accounts to return |
| `startingAfter` | string | No | Return routes after this route ID (the last ID of the previous page) |

#### update_virtual_account

Update virtual account settings (e.g., deposit handling mode)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The virtual account ID to update |
| `depositHandlingMode` | `auto_payout` \| `hold` \| `manual` | Yes | New deposit handling mode |

#### get_virtual_account_history

Get the activity history for a virtual account (deposits, payouts, etc.)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The virtual account ID |
| `limit` | number | No | Maximum number of events to return (default: 10) |

#### update_route_destination

Change the payout wallet on an existing payment route. Deposits after this point are paid out to the new address; use it when a customer rotates wallets rather than creating a second route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route (virtual account) ID |
| `destinationAddress` | string | Yes | New payout wallet address |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | Yes | Blockchain network the new address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | Stablecoin to receive. Default: `"usdt"`. |

#### list_route_whitelist

List the bank accounts whitelisted to pay into an AUD payment route. Some Australian routes only accept deposits from whitelisted source accounts.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route (virtual account) ID |

#### add_route_whitelist_account

Whitelist an Australian bank account (BSB and account number) to pay into an AUD payment route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route (virtual account) ID |
| `bsbNumber` | string | Yes | Source account BSB |
| `accountNumber` | string | Yes | Source account number |
| `enabled` | boolean | No | Whether deposits from it are accepted now. Default: `true`. |

#### update_route_whitelist_account

Change or disable a whitelisted source account on an AUD payment route. Send the full record: BSB, account number and status.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route (virtual account) ID |
| `sourceAccountId` | integer | Yes | The whitelist entry ID (from list_route_whitelist) |
| `bsbNumber` | string | Yes | Source account BSB |
| `accountNumber` | string | Yes | Source account number |
| `enabled` | boolean | Yes | false to stop accepting deposits from it |

#### register_route_payid

Register a PayID for an activated AUD payment route, so payers can send to an email-style alias instead of a BSB and account number. Calling it again on a route that already has one returns the existing PayID.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route (virtual account) ID |

### Compliance requests (RFIs)

#### list_rfis

List the organisation's compliance requests for information (RFIs), newest first: what Stables compliance needs before it releases a held payment or verification. Open and submitted ones by default. Check this when a transfer or deposit is held, or subscribe to the rfi.* webhooks.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | array of `open` \| `submitted` \| `satisfied` \| `expired` \| `waived` \| `rejected` | No | Only these statuses (default: open and submitted) |
| `type` | array of `verification` \| `transaction` \| `manual` | No | Only these RFI types |
| `customerId` | string | No | Only this customer's RFIs |
| `transactionReferenceId` | string | No | Only RFIs about this transfer or deposit |
| `limit` | integer | No | Results per page |
| `cursor` | string | No | next_cursor from the previous page |

#### list_customer_rfis

List one customer's compliance requests for information (RFIs), with what each requirement needs next.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `status` | `open` \| `submitted` \| `satisfied` \| `expired` \| `waived` \| `rejected` | No | Only this status |

#### get_rfi

Get one compliance request for information (RFI): why it was raised, its requirements and how to answer each.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `rfiId` | string | Yes | The RFI ID |

#### get_rfi_evidence_form

Get the form an `evidence` requirement on an RFI asks for (for example the source of funds behind one held payment), with the current submission if one was sent. Build the submit_rfi_evidence answers from its fields and documents.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `rfiId` | string | Yes | The RFI ID |
| `requirementId` | string | Yes | The requirement ID (type 'evidence') |

#### submit_rfi_evidence

Submit the answers and documents an `evidence` requirement asks for, in one request, keyed as get_rfi_evidence_form lists them. Files are base64 data URLs ('data:application/pdf;base64,...'). The requirement moves to 'submitted' for Stables compliance to review; approving it releases the held payment once nothing else is outstanding. Confirm the content with a human before sending: it goes to compliance as the customer's answer.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `rfiId` | string | Yes | The RFI ID |
| `requirementId` | string | Yes | The requirement ID (type 'evidence') |
| `answers` | object | Yes | Answers keyed by the form's field keys and document wire_field names, e.g. { funds_origin, funds_origin_explanation, supporting_documents: ['data:application/pdf;base64,...'] } |

#### get_kyc_capabilities

List the verification capabilities a customer holds (for example proof_of_address), the level that granted each, and when. A `kyc_capability` requirement on an RFI is satisfied once the customer holds that capability.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |

### Documents

#### add_document

Attach a supporting document (invoice, contract or other) to a transfer or a payment route deposit, for example when Stables compliance asks for one. The file goes as a base64 data URL ('data:application/pdf;base64,...').

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_virtual_account_history |
| `fileName` | string | Yes | File name shown to Stables, e.g. 'invoice-2041.pdf' |
| `base64Url` | string | Yes | The file as a data URL: 'data:<mime>;base64,<data>' |
| `type` | `invoice` \| `contract` \| `other` | No | What the document is (default other) |

#### list_documents

List the documents attached to a transfer or a payment route deposit, newest first.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_virtual_account_history |

#### get_document_download_url

Get a short-lived link to download a document attached to a transfer or a payment route deposit.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_virtual_account_history |
| `documentId` | string | Yes | The document ID from list_documents |

#### delete_document

Remove a document from a transfer or a payment route deposit. This cannot be undone, so confirm with a human first.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_virtual_account_history |
| `documentId` | string | Yes | The document ID from list_documents |

### Balances

#### get_balance

Get your organisation's stablecoin balance, one entry per asset and network held. Also says whether transfers may be paid from it (transfers_enabled), which create_transfer with fundingSource 'prefund_balance' needs.

_No parameters._

#### get_balance_wallet

Get the deposit wallet that tops up your balance on one network, and its status. The address is only present once the status is 'active'.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `ethereum` \| `polygon` \| `solana` \| `tron` | No | Network (default polygon) |

#### create_balance_wallet

Create the deposit wallet that tops up your balance on a network. Creation is asynchronous: the first answer is 'creating'; poll get_balance_wallet until it is 'active'. Safe to call again while creation is in flight.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `ethereum` \| `polygon` \| `solana` \| `tron` | Yes | Network for the wallet |

#### list_balance_activity

List deposits that have credited your balance, newest first, with amount, network, transaction hash and sender.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `ethereum` \| `polygon` \| `solana` \| `tron` | No | Only this network |
| `pageSize` | integer | No | Results per page (default 20) |
| `pageToken` | string | No | next_page_token from the previous page |

#### list_pending_balance_deposits

List deposits seen on-chain but held before crediting your balance, with the reason: the sender is not a whitelisted wallet, or compliance review.

_No parameters._

#### list_whitelisted_wallets

List the wallets whitelisted to deposit into and receive withdrawals from your balance. Only 'active' wallets can. Whitelisting a wallet is done in the dashboard; there is no API for it.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `pending_review` \| `active` \| `rejected` \| `deactivated` \| `archived` | No | Only this status. Archived wallets appear only when asked for |
| `network` | `ethereum` \| `polygon` \| `solana` \| `tron` | No | Only this network |
| `pageSize` | integer | No | Results per page (default 20) |
| `pageToken` | string | No | next_page_token from the previous page |

### Sandbox

#### simulate_route_deposit

SANDBOX ONLY. Simulate a fiat deposit into a payment route so you can watch the conversion and payout complete without a real bank transfer. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route (virtual account) ID |
| `amount` | string | Yes | Deposit amount in major units (e.g. '500.00') |
| `scenario` | `create_only` \| `completed` \| `failed` | No | 'completed' runs the deposit through to payout, 'failed' exercises the failure path, 'create_only' stops at the deposit |
| `senderName` | string | No | Name to attribute the deposit to |
| `senderReference` | string | No | Payment reference on the deposit |
| `externalDepositId` | string | No | Your own reference for this deposit |

#### simulate_transfer_deposit

SANDBOX ONLY. Simulate the customer sending the crypto an off-ramp transfer is waiting on, so the transfer can progress to payout without an on-chain payment. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer awaiting funds |

### API keys

#### create_api_key

Create a new API key for accessing the Stables API. The secret key is only shown once on creation - save it immediately.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | A descriptive name for this API key (e.g., 'Production Bot', 'Agent Smith') |
| `metadata` | object | No | Optional metadata to attach to the key |

#### list_api_keys

List all API keys for the current account

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pageSize` | number | No | Number of keys per page |
| `pageToken` | string | No | Token for the next page |

#### get_api_key

Get details about a specific API key

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKeyId` | string | Yes | The API key ID to look up |

#### revoke_api_key

Revoke an API key. This permanently disables the key and cannot be undone.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `apiKeyId` | string | Yes | The API key ID to revoke |

### Webhooks

#### create_webhook

Subscribe to Stables events via webhook. You'll receive POST requests to your URL when events occur.

Event types are dotted and lowercase. Use 'all' to receive everything.

Security: Set a secret to enable HMAC-SHA256 signature verification via X-Webhook-Signature header.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `name` | string | Yes | A descriptive name for this webhook (e.g., 'Transfer status notifications') |
| `url` | string | Yes | The HTTPS URL to receive webhook POST requests |
| `eventTypes` | array of `customer.created` \| `customer.updated` \| `kyc_link.updated.status_transitioned` \| `transfer.created` \| `transfer.updated.status_transitioned` \| `transfer.action_required` \| `quote.created` \| `quote.updated.status_transitioned` \| `virtual_account.created` \| `virtual_account.activity.created` \| `virtual_account.activity.updated.status_transitioned` \| `virtual_account.fee_charge_failed` \| `virtual_account.deactivated` \| `virtual_account.reactivated` \| `travel_rule.wallet_verification_required` \| `rfi.created` \| `rfi.updated` \| `rfi.resolved` \| `entitlement.requested` \| `entitlement.updated.status_transitioned` \| `entitlement.updated.requirements_changed` \| `prefund.wallet.created` \| `prefund.deposit.received` \| `prefund.withdrawal.completed` \| `prefund.withdrawal.failed` \| `all` | Yes | Event types to subscribe to (e.g. ['transfer.updated.status_transitioned']), or ['all'] |
| `secret` | string | No | Optional signing secret for HMAC-SHA256 webhook signature verification |

#### list_webhooks

List all webhook subscriptions for the current account

_No parameters._

#### delete_webhook

Delete a webhook subscription. You will stop receiving events at this endpoint.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `webhookId` | string | Yes | The webhook subscription ID to delete |

#### list_webhook_deliveries

List recent webhook delivery attempts with their HTTP status and retry state. This is the first place to look when an integration is not receiving events: it shows whether Stables sent them and what the endpoint answered.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `pageSize` | number | No | How many attempts to return (default 10, max 50) |
| `status` | `PENDING` \| `SUCCESS` \| `FAILED` \| `RETRYING` | No | Filter by delivery status |
| `eventType` | string | No | Filter by event type (e.g. 'transfer.created') |
