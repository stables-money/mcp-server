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
| `entitlements` | array of `base_payout` \| `base_pay_in` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | List of entitlements to request |
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
| `entitlements` | array of `base_payout` \| `base_pay_in` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | List of entitlements to request |
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
| `entitlements` | array of `base_payout` \| `base_pay_in` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | No | Updated entitlements |

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
| `entitlements` | array of `base_payout` \| `base_pay_in` \| `virtual_account` \| `eur_virtual_account` \| `gbp_virtual_account` \| `usd_virtual_account` \| `aed_local` | Yes | Entitlement names, e.g. ['aed_local'] |

#### submit_entitlement_requirements

Send further verification data Stables asked for on a requested entitlement. The fields are those of the customer record in snake_case (e.g. tax_id_number, address, financial_profile, id_documents, proof_of_address_documents); send only what is missing. Documents are base64 data.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `entitlement` | string | Yes | The entitlement name, e.g. 'aed_local' |
| `requirements` | object | Yes | The missing fields, snake_case as in the Update Customer reference |

### Quotes

#### create_quote

Get a quote for a currency exchange: the rate, the fees, and what the customer receives. Quotes are short-lived, so create one immediately before the transfer. Off-ramp converts a stablecoin to fiat (source network required, destination country required); on-ramp converts fiat to a stablecoin (destination address required). A swap converts a stablecoin to another stablecoin and/or moves it to another network: USDT or USDC on both sides, sourceNetwork and destinationNetwork both blockchain networks, no destinationCountry. The same stablecoin on the same network is refused. Give sourceAmount to quote what a fixed amount buys, or destinationAmount to quote what an exact amount received costs (only on routes that support it); never both. Set preview to price without committing.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `sourceCurrency` | string | Yes | Source currency: a stablecoin for off-ramp or swap (e.g. 'USDT'), fiat for on-ramp |
| `sourceAmount` | string | No | Amount to convert, in major units (e.g. '125.75'). Give exactly one of sourceAmount and destinationAmount |
| `sourceNetwork` | `arbitrum` \| `avalanche` \| `base` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `tron` | No | Blockchain network of the source. Required for off-ramp and swap, omitted for on-ramp |
| `destinationCurrency` | string | Yes | Destination currency: fiat for off-ramp (e.g. 'EUR'), a stablecoin for on-ramp or swap (e.g. 'USDC') |
| `destinationCountry` | string | No | Destination country, ISO 2-letter. Required for off-ramp |
| `destinationNetwork` | string | No | Off-ramp: the payout network. bank = the default domestic scheme, swift = international wire, payid = PayID alias (AUD), mobile_money = a mobile money wallet (needs walletProvider and walletAccount, and no bank fields). A named domestic scheme (ach, fedwire, fps, chaps, sepa, sepa_instant, fast, chats, unionpay) is refused where it is unavailable for the corridor. unionpay = personal remittance to a bank account in mainland China in CNY: purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL, and the customer needs the cny_unionpay entitlement. On-ramp and swap: the blockchain network to deliver on (required for a swap, e.g. 'base') |
| `destinationAmount` | string | No | Exact amount the recipient must receive, in major units (e.g. '100'), instead of sourceAmount. The quote then says what to send. Refused on routes that do not support an exact destination amount |
| `destinationAddress` | string | No | Destination wallet address. Required for on-ramp |
| `customerId` | string | No | The customer the quote is for. With it, the quote also uses payout routes that need the customer to be set up first, and the transfer must then be created for the same customer. Without it, only routes that need no customer set-up are used |
| `fundingSource` | `fund_transfer` \| `prefund_balance` | No | How the transfer made from this quote will be funded. fund_transfer (default): a deposit for that transfer. prefund_balance prices the quote for payment from your organisation's balance, and the transfer must then use the same fundingSource. Quoting moves no money, but a prefund_balance transfer debits the balance and starts the payout immediately, so it needs explicit human approval |
| `preview` | boolean | No | Price the quote without persisting it, to show an estimate |
| `metadata` | object | No | Optional metadata |

#### get_quote

Get details about an existing quote including its current status

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `quoteId` | string | Yes | The quote ID to look up |

### Transfers

#### validate_payment_method

Check payout details (a bank account or a mobile money wallet) against the corridor's rules without creating anything. Use it before create_transfer to find out which fields a currency and network need (beneficiary address, date of birth, bank codes, wallet details), instead of spending a short-lived quote on a rejected transfer. Networks: bank = the default domestic scheme, swift = international wire, payid = PayID alias (AUD), mobile_money = a mobile money wallet (needs walletProvider and walletAccount, and no bank fields). A named domestic scheme (ach, fedwire, fps, chaps, sepa, sepa_instant, fast, chats, unionpay) is refused where it is unavailable for the corridor. unionpay = personal remittance to a bank account in mainland China in CNY: purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL, and the customer needs the cny_unionpay entitlement. A CNY bank payout needs nameInLocalLanguage and nationalIdentificationNumber, and for goods trade (purposeCode GENERAL_GOODS_TRADES) logisticsTrackingDetails and items.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `swift` \| `bank` \| `payid` \| `mobile_money` \| `ach` \| `fedwire` \| `fps` \| `chaps` \| `sepa` \| `sepa_instant` \| `fast` \| `chats` \| `unionpay` | Yes | Payout network to validate against: bank (default domestic scheme), swift, payid (AUD), mobile_money, or a named domestic scheme |
| `quoteId` | string | No | Validate against this quote's corridor |
| `purposeCode` | `PAYMENT_FOR_SERVICES` \| `PAYMENT_FOR_SOFTWARE` \| `PAYMENT_FOR_IMPORTED_GOODS` \| `TRAVEL_SERVICES` \| `VENDOR_CONTRACTOR_PAYOUTS` \| `TRANSFER_TO_OWN_ACCOUNT` \| `INVESTMENT_IN_SHARES` \| `PURCHASE_OF_PROPERTY` \| `REPAYMENT_OF_LOANS` \| `SALARY` \| `PAYMENT_OF_PROPERTY_RENTAL` \| `INFORMATION_SERVICE_CHARGES` \| `ADVERTISING_PR_EXPENSES` \| `ROYALTY_FEES` \| `BROKER_COMMITMENT_FEES` \| `ADVISOR_TECHNICAL_FEES` \| `REPRESENTATIVE_OFFICE_EXPENSES` \| `TAX_PAYMENT` \| `TRANSPORTATION_FEES_FOR_GOODS` \| `CONSTRUCTION_COSTS` \| `INSURANCE_PREMIUM` \| `GENERAL_GOODS_TRADES` \| `INSURANCE_CLAIMS_PAYMENT` \| `FAMILY_MAINTENANCE` \| `EDUCATION_EXPENSES` \| `MEDICAL_TREATMENT` \| `DONATIONS` \| `MUTUAL_FUND_INVESTMENT` \| `CURRENCY_EXCHANGE` \| `USER_WITHDRAWAL` \| `ADVANCE_PAYMENTS_FOR_GOODS` \| `VENDOR_CONTRACTOR_SOFTWARE_PAYOUTS` \| `MERCHANT_SETTLEMENT` \| `REPATRIATION_FUND_SETTLEMENT` \| `PERSONAL_REMITTANCE` \| `RETURN_OF_FUNDS` | No | The purpose the transfer will carry. Some corridors ask for different supporting details per purpose (CNY: logisticsTrackingDetails and items for goods trade, a document for services); without it every such detail is required |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank. Required unless paying a mobile money wallet |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US'). For mobile money, the country of the wallet |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `phone` | string | No | Beneficiary phone number in E.164 format (e.g. '+5215512345678') |
| `nameInLocalLanguage` | string | No | Account holder name in the local language (e.g. Chinese characters for CNY) |
| `nationalIdentificationNumber` | string | No | National identification number of the account holder |
| `addressStreet` | string | No | Beneficiary street address. Needed, with addressCountry, whenever an address is sent |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `bankAddressStreet` | string | No | Street address of the beneficiary's bank. A bank address is required for a USD SWIFT payout to an account the paying customer does not hold; street and country at minimum |
| `bankAddressCity` | string | No | City of the beneficiary's bank |
| `bankAddressState` | string | No | State or region of the beneficiary's bank |
| `bankAddressPostalCode` | string | No | Postal code of the beneficiary's bank |
| `bankAddressCountry` | string | No | Country of the beneficiary's bank, ISO 2-letter |
| `walletProvider` | string | No | Mobile money only: the wallet provider code, as listed for the corridor (e.g. 'mtn_gh'). Requires walletAccount, and every bank field (bankName, accountNumber, iban, bank codes) must be left out |
| `walletAccount` | string | No | Mobile money only: the wallet's identifier, such as its mobile number (e.g. '+233241234567'). Required with walletProvider |
| `walletAccountType` | `mobile_number` | No | Mobile money only: the kind of identifier in walletAccount. Only needed where the wallet provider accepts more than one |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `branchName` | string | No | Bank branch name |
| `paymentRail` | `ach` \| `wire` | No | USD payouts only: prefer ACH or wire. Omit for the account's default. A rail that is not available is refused |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |
| `logisticsTrackingDetails` | object[] | No | Shipment tracking for the goods the payout pays for. Required, with items, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES |
| `items` | object[] | No | Goods the payout pays for, as invoice lines. Required, with logisticsTrackingDetails, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES |
| `documents` | object[] | No | Supporting documents for the payout, such as an invoice or contract |

#### create_transfer

Create a transfer from an active quote. The quote must not be expired. With fundingSource fund_transfer (the default) this only creates the transfer and returns deposit instructions; no money moves until someone deposits the funds. With prefund_balance it debits your organisation's balance and starts the payout immediately, so this moves real money: get explicit human approval first. For payouts in AED, CAD, EUR, GBP, MXN, USD you must also supply recipientType, the full beneficiary address, and dateOfBirth when the recipient is an individual. To pay one of the organisation's saved beneficiaries, set destinationType to beneficiary and pass its beneficiaryId instead of bank details. The payout network comes from the quote. To pay a mobile money wallet (a mobile_money quote), keep destinationType bank and send walletProvider and walletAccount with accountHolderName, bankCountry and bankCurrency, and no bank fields. A CNY bank payout needs nameInLocalLanguage and nationalIdentificationNumber, and for goods trade (purposeCode GENERAL_GOODS_TRADES) logisticsTrackingDetails and items. A unionpay quote is a personal remittance to mainland China: purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL. For a swap (a quote between two stablecoins or two networks), set destinationType to crypto with destinationCurrency, destinationNetwork and destinationAddress; currency and network must match the quote. A swap is funded by a deposit (fund_transfer) and needs no bank details or purposeCode.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID for this transfer |
| `quoteId` | string | Yes | The quote ID to execute |
| `destinationType` | `bank` \| `crypto` \| `beneficiary` | No | Payout target: a bank account (off-ramp), a wallet address (swap), or a saved beneficiary. Default: `"bank"`. |
| `beneficiaryId` | string | No | Saved beneficiary id when destinationType is beneficiary. It supplies the recipient and bank details, so the bank fields are ignored (logisticsTrackingDetails, items and documents still travel with the payout); archived beneficiaries are refused |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank. Required unless paying a mobile money wallet |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US'). For mobile money, the country of the wallet |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `phone` | string | No | Beneficiary phone number in E.164 format (e.g. '+5215512345678') |
| `nameInLocalLanguage` | string | No | Account holder name in the local language (e.g. Chinese characters for CNY) |
| `nationalIdentificationNumber` | string | No | National identification number of the account holder |
| `addressStreet` | string | No | Beneficiary street address. Needed, with addressCountry, whenever an address is sent |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `bankAddressStreet` | string | No | Street address of the beneficiary's bank. A bank address is required for a USD SWIFT payout to an account the paying customer does not hold; street and country at minimum |
| `bankAddressCity` | string | No | City of the beneficiary's bank |
| `bankAddressState` | string | No | State or region of the beneficiary's bank |
| `bankAddressPostalCode` | string | No | Postal code of the beneficiary's bank |
| `bankAddressCountry` | string | No | Country of the beneficiary's bank, ISO 2-letter |
| `walletProvider` | string | No | Mobile money only: the wallet provider code, as listed for the corridor (e.g. 'mtn_gh'). Requires walletAccount, and every bank field (bankName, accountNumber, iban, bank codes) must be left out |
| `walletAccount` | string | No | Mobile money only: the wallet's identifier, such as its mobile number (e.g. '+233241234567'). Required with walletProvider |
| `walletAccountType` | `mobile_number` | No | Mobile money only: the kind of identifier in walletAccount. Only needed where the wallet provider accepts more than one |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `branchName` | string | No | Bank branch name |
| `paymentRail` | `ach` \| `wire` | No | USD payouts only: prefer ACH or wire. Omit for the account's default. A rail that is not available is refused |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |
| `logisticsTrackingDetails` | object[] | No | Shipment tracking for the goods the payout pays for. Required, with items, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES |
| `items` | object[] | No | Goods the payout pays for, as invoice lines. Required, with logisticsTrackingDetails, for a CNY bank payout with purposeCode GENERAL_GOODS_TRADES |
| `documents` | object[] | No | Supporting documents for the payout, such as an invoice or contract |
| `destinationCurrency` | string | No | Stablecoin to deliver when destinationType is crypto (e.g. 'USDT'). Must match the quote's destination currency |
| `destinationNetwork` | string | No | Blockchain network when destinationType is crypto (e.g. 'polygon'). Must match the quote's destination network |
| `destinationAddress` | string | No | Wallet address when destinationType is crypto. It must be valid on destinationNetwork: funds sent to a wrong address cannot be recovered |
| `purposeCode` | `PAYMENT_FOR_SERVICES` \| `PAYMENT_FOR_SOFTWARE` \| `PAYMENT_FOR_IMPORTED_GOODS` \| `TRAVEL_SERVICES` \| `VENDOR_CONTRACTOR_PAYOUTS` \| `TRANSFER_TO_OWN_ACCOUNT` \| `INVESTMENT_IN_SHARES` \| `PURCHASE_OF_PROPERTY` \| `REPAYMENT_OF_LOANS` \| `SALARY` \| `PAYMENT_OF_PROPERTY_RENTAL` \| `INFORMATION_SERVICE_CHARGES` \| `ADVERTISING_PR_EXPENSES` \| `ROYALTY_FEES` \| `BROKER_COMMITMENT_FEES` \| `ADVISOR_TECHNICAL_FEES` \| `REPRESENTATIVE_OFFICE_EXPENSES` \| `TAX_PAYMENT` \| `TRANSPORTATION_FEES_FOR_GOODS` \| `CONSTRUCTION_COSTS` \| `INSURANCE_PREMIUM` \| `GENERAL_GOODS_TRADES` \| `INSURANCE_CLAIMS_PAYMENT` \| `FAMILY_MAINTENANCE` \| `EDUCATION_EXPENSES` \| `MEDICAL_TREATMENT` \| `DONATIONS` \| `MUTUAL_FUND_INVESTMENT` \| `CURRENCY_EXCHANGE` \| `USER_WITHDRAWAL` \| `ADVANCE_PAYMENTS_FOR_GOODS` \| `VENDOR_CONTRACTOR_SOFTWARE_PAYOUTS` \| `MERCHANT_SETTLEMENT` \| `REPATRIATION_FUND_SETTLEMENT` \| `PERSONAL_REMITTANCE` \| `RETURN_OF_FUNDS` | No | Purpose of the transfer (e.g. 'SALARY'). Required on some corridors |
| `paymentReference` | string | No | Text sent with a bank payout so the recipient can tell what it is for, such as an invoice number. Up to 35 characters: letters, digits, spaces and / - ? : ( ) . , ' + only. Some payouts carry less and refuse a reference that does not fit. No effect on a crypto destination |
| `accountOwnership` | `first_party` \| `third_party` | No | Whose bank account the payout pays: the customer's own (first_party) or someone else's (third_party). A third_party payout needs a purposeCode, and is refused where this type of customer may only pay their own account. No effect on a crypto destination |
| `sourceWallet` | object | No | Custody of the wallet the customer will send from, for the travel rule. Defaults to self_hosted when omitted |
| `fundingSource` | `fund_transfer` \| `prefund_balance` | No | fund_transfer (default) creates the transfer and returns deposit instructions; nothing moves until a person deposits the funds. prefund_balance debits your organisation's balance and starts the payout immediately, so it needs explicit human approval. Check get_balance first: transfers_enabled must be true and the quote's source asset must be held on its network |
| `metadata` | object | No | Optional metadata |

#### get_transfer

Get the current status and details of a transfer, including its payment reference, a SWIFT payout's tracking (UETR, then the MT103 once issued), an open compliance hold and any refund

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer ID to look up |

#### list_transfers

List transfers with optional filters for status, type, or customer

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | `created` \| `compliance_hold` \| `awaiting_funds_collection` \| `funds_collected` \| `in_progress` \| `payment_submitted` \| `payment_processed` \| `completed` \| `failed` \| `cancelled` \| `expired` \| `refund_pending` \| `refunded` \| `refund_failed` | No | Filter by transfer status |
| `type` | `onramp` \| `offramp` \| `swap` | No | Filter by transfer type. swap is crypto to crypto |
| `customerId` | string | No | Filter by customer ID |
| `pageSize` | number | No | Number of transfers per page (default: 20) |
| `pageToken` | string | No | Token for the next page of results |

### Saved beneficiaries

#### list_beneficiaries

List the organisation's saved beneficiaries, most recently paid first. Use it to find the beneficiaryId that create_transfer takes with destinationType 'beneficiary'.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `currency` | string | No | Only beneficiaries paid in this currency (e.g. 'EUR') |
| `network` | `bank` \| `swift` \| `mobile_money` \| `unionpay` | No | Only beneficiaries paid by this network: bank, swift, mobile_money (a wallet) or unionpay (personal remittance to mainland China in CNY) |
| `status` | `active` \| `archived` \| `all` | No | Defaults to active. Archived beneficiaries cannot be paid |
| `search` | string | No | Case-insensitive match on label, account holder or bank name |
| `pageSize` | number | No | Beneficiaries per page (default 50, max 100) |
| `pageToken` | string | No | Token for the next page of results |

#### get_beneficiary

Get a saved beneficiary's recipient and bank details, and whether it still passes today's payout rules. Rules tighten over time, so an older beneficiary can need more fields before it can be paid.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `beneficiaryId` | string | Yes | The beneficiary ID to look up |

#### create_beneficiary

Save a recipient and their bank account or mobile money wallet for a currency and network, so later transfers can pay it by id. The details are validated exactly as a transfer on that network would be. Saving an account that is already saved returns the existing beneficiary with its details refreshed, and revives it if archived. For mobile_money send walletProvider and walletAccount with accountHolderName, bankCountry and bankCurrency, and no bank fields. A CNY bank payout needs nameInLocalLanguage and nationalIdentificationNumber, and for goods trade (purposeCode GENERAL_GOODS_TRADES) logisticsTrackingDetails and items; the goods details travel with each transfer, not the saved beneficiary. PayID aliases are paid per transfer and cannot be saved.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `bank` \| `swift` \| `mobile_money` \| `unionpay` | Yes | Network the beneficiary is paid by: bank = local transfer, swift = international wire, mobile_money = a mobile money wallet (walletProvider and walletAccount, no bank fields), unionpay = personal remittance to a bank account in mainland China in CNY (purposeCode PERSONAL_REMITTANCE or USER_WITHDRAWAL on the transfer, and the customer needs the cny_unionpay entitlement) |
| `label` | string | No | Display name (e.g. 'Acme Supplies (EUR)'). Defaults to the account holder name |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank. Required unless paying a mobile money wallet |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US'). For mobile money, the country of the wallet |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `phone` | string | No | Beneficiary phone number in E.164 format (e.g. '+5215512345678') |
| `nameInLocalLanguage` | string | No | Account holder name in the local language (e.g. Chinese characters for CNY) |
| `nationalIdentificationNumber` | string | No | National identification number of the account holder |
| `addressStreet` | string | No | Beneficiary street address. Needed, with addressCountry, whenever an address is sent |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `bankAddressStreet` | string | No | Street address of the beneficiary's bank. A bank address is required for a USD SWIFT payout to an account the paying customer does not hold; street and country at minimum |
| `bankAddressCity` | string | No | City of the beneficiary's bank |
| `bankAddressState` | string | No | State or region of the beneficiary's bank |
| `bankAddressPostalCode` | string | No | Postal code of the beneficiary's bank |
| `bankAddressCountry` | string | No | Country of the beneficiary's bank, ISO 2-letter |
| `walletProvider` | string | No | Mobile money only: the wallet provider code, as listed for the corridor (e.g. 'mtn_gh'). Requires walletAccount, and every bank field (bankName, accountNumber, iban, bank codes) must be left out |
| `walletAccount` | string | No | Mobile money only: the wallet's identifier, such as its mobile number (e.g. '+233241234567'). Required with walletProvider |
| `walletAccountType` | `mobile_number` | No | Mobile money only: the kind of identifier in walletAccount. Only needed where the wallet provider accepts more than one |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `branchName` | string | No | Bank branch name |
| `paymentRail` | `ach` \| `wire` | No | USD payouts only: prefer ACH or wire. Omit for the account's default. A rail that is not available is refused |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |

#### archive_beneficiary

Archive a saved beneficiary. It leaves active listings and is refused as a transfer destination; transfers already made to it are unaffected. Saving the same account again revives it.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `beneficiaryId` | string | Yes | The beneficiary ID to archive |

### Payment routes

#### create_payment_route

Create a payment route for a customer. fiat_to_crypto (the default) issues a virtual bank account: fiat deposits convert to a stablecoin and pay out to a wallet, so destinationAddress and destinationPaymentRail are required. Set sourcePaymentRail to 'swift' for a SWIFT collection account: an IBAN that receives international SWIFT transfers, for business customers whose verification is approved and who hold the base_pay_in entitlement; it is not in the customer's name, and settles in USDT on Tron. crypto_to_fiat (an off-ramp route) issues a permanent USDT or USDC deposit address on sourceNetwork: every deposit converts and pays out to one bank account, given as a saved beneficiary (payoutType beneficiary + beneficiaryId) or as bank details. On a crypto_to_fiat route, swiftCode or bicCode is needed only when payoutNetwork is swift. Its deposits are route transactions, read with get_payment_route_history, never transfers. crypto_to_crypto (a swap route) issues a permanent USDT or USDC deposit address on sourceNetwork: every deposit is swapped and delivered to destinationAddress as destinationCurrency on destinationPaymentRail, which must differ from the source in stablecoin, network or both. Its deposits are route transactions too. Deposit handling is set server-side and defaults to auto_payout; change it afterwards with update_payment_route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID to create the payment route for |
| `workflowType` | `fiat_to_crypto` \| `crypto_to_fiat` \| `crypto_to_crypto` | No | fiat_to_crypto: a virtual bank account paying out to a wallet. crypto_to_fiat: a permanent stablecoin address paying out to a bank account. crypto_to_crypto: a permanent stablecoin address whose deposits are swapped to another stablecoin and/or network and sent to a wallet. Default: `"fiat_to_crypto"`. |
| `sourceCurrency` | string | Yes | What the customer deposits: a fiat currency for fiat_to_crypto (e.g. 'AUD', 'USD'), or 'USDT' / 'USDC' for crypto_to_fiat and crypto_to_crypto |
| `sourcePaymentRail` | `swift` | No | fiat_to_crypto only. Omit for the currency's local rail. 'swift' opens a SWIFT collection account (business customers with approved verification and base_pay_in). SWIFT currencies: AED, AUD, CAD, CHF, CZK, DKK, EUR, GBP, GEL, HKD, HUF, JPY, NZD, PLN, SEK, SGD, THB, USD; payout USDT on tron |
| `sourceNetwork` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | No | crypto_to_fiat and crypto_to_crypto, required: the network the deposit address is issued on |
| `destinationAddress` | string | No | fiat_to_crypto and crypto_to_crypto, required: wallet address deposits are paid out to. Validated against the chosen network |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | No | fiat_to_crypto and crypto_to_crypto, required: blockchain network the payout address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | fiat_to_crypto and crypto_to_crypto: stablecoin to receive. Default: `"usdt"`. |
| `payoutType` | `bank` \| `beneficiary` | No | crypto_to_fiat only: pay out to bank details given here, or to a saved beneficiary. Default: `"bank"`. |
| `beneficiaryId` | string | No | crypto_to_fiat with payoutType beneficiary: a saved beneficiary id. Its bank details are copied onto the route; archived beneficiaries are refused |
| `accountHolderName` | string | No | Account holder's full name, or the company name when recipientType is business |
| `bankName` | string | No | Name of the destination bank. Required unless paying a mobile money wallet |
| `bankCountry` | string | No | Bank country, ISO 2-letter (e.g. 'AU', 'US'). For mobile money, the country of the wallet |
| `bankCurrency` | string | No | Payout currency, ISO 3-letter (e.g. 'EUR') |
| `recipientType` | `individual` \| `business` | No | Beneficiary type. Required for AED, CAD, EUR, GBP, MXN, USD |
| `dateOfBirth` | string | No | Beneficiary date of birth, YYYY-MM-DD. Required when recipientType is individual for AED, CAD, EUR, GBP, MXN, USD |
| `phone` | string | No | Beneficiary phone number in E.164 format (e.g. '+5215512345678') |
| `nameInLocalLanguage` | string | No | Account holder name in the local language (e.g. Chinese characters for CNY) |
| `nationalIdentificationNumber` | string | No | National identification number of the account holder |
| `addressStreet` | string | No | Beneficiary street address. Needed, with addressCountry, whenever an address is sent |
| `addressCity` | string | No | Beneficiary city |
| `addressState` | string | No | Beneficiary state or region |
| `addressPostalCode` | string | No | Beneficiary postal code |
| `addressCountry` | string | No | Beneficiary country, ISO 2-letter. The complete address is required for AED, CAD, EUR, GBP, MXN, USD |
| `bankAddressStreet` | string | No | Street address of the beneficiary's bank. A bank address is required for a USD SWIFT payout to an account the paying customer does not hold; street and country at minimum |
| `bankAddressCity` | string | No | City of the beneficiary's bank |
| `bankAddressState` | string | No | State or region of the beneficiary's bank |
| `bankAddressPostalCode` | string | No | Postal code of the beneficiary's bank |
| `bankAddressCountry` | string | No | Country of the beneficiary's bank, ISO 2-letter |
| `walletProvider` | string | No | Mobile money only: the wallet provider code, as listed for the corridor (e.g. 'mtn_gh'). Requires walletAccount, and every bank field (bankName, accountNumber, iban, bank codes) must be left out |
| `walletAccount` | string | No | Mobile money only: the wallet's identifier, such as its mobile number (e.g. '+233241234567'). Required with walletProvider |
| `walletAccountType` | `mobile_number` | No | Mobile money only: the kind of identifier in walletAccount. Only needed where the wallet provider accepts more than one |
| `iban` | string | No | IBAN (EU/international) |
| `accountNumber` | string | No | Bank account number, if not using IBAN |
| `accountType` | `savings` \| `checking` \| `payment` | No | Account type. Required for CAD and USD bank payouts |
| `payId` | string | No | PayID alias (AUD only). Requires payIdType |
| `payIdType` | `email` \| `phone_number` \| `abn` \| `acn` \| `organisation_id` | No | PayID alias type. Required when payId is given |
| `branchName` | string | No | Bank branch name |
| `paymentRail` | `ach` \| `wire` | No | USD payouts only: prefer ACH or wire. Omit for the account's default. A rail that is not available is refused |
| `swiftCode` | string | No | SWIFT code |
| `bicCode` | string | No | BIC (EUR/GBP international) |
| `routingNumber` | string | No | ABA routing number (US) |
| `sortCode` | string | No | Sort code (UK) |
| `ifscCode` | string | No | IFSC code (India) |
| `bsbCode` | string | No | BSB code (Australia) |
| `bankCode` | string | No | Bank code / institution number (CAD) |
| `branchCode` | string | No | Branch code / transit number (CAD) |
| `cnaps` | string | No | CNAPS (China) |
| `payoutNetwork` | `swift` \| `bank` \| `payid` \| `mobile_money` \| `ach` \| `fedwire` \| `fps` \| `chaps` \| `sepa` \| `sepa_instant` \| `fast` \| `chats` \| `unionpay` | No | crypto_to_fiat only: how each deposit is paid out. Defaults to the saved beneficiary's payment method, else bank (domestic). swift requires swiftCode or bicCode |
| `purposeCode` | `PAYMENT_FOR_SERVICES` \| `PAYMENT_FOR_SOFTWARE` \| `PAYMENT_FOR_IMPORTED_GOODS` \| `TRAVEL_SERVICES` \| `VENDOR_CONTRACTOR_PAYOUTS` \| `TRANSFER_TO_OWN_ACCOUNT` \| `INVESTMENT_IN_SHARES` \| `PURCHASE_OF_PROPERTY` \| `REPAYMENT_OF_LOANS` \| `SALARY` \| `PAYMENT_OF_PROPERTY_RENTAL` \| `INFORMATION_SERVICE_CHARGES` \| `ADVERTISING_PR_EXPENSES` \| `ROYALTY_FEES` \| `BROKER_COMMITMENT_FEES` \| `ADVISOR_TECHNICAL_FEES` \| `REPRESENTATIVE_OFFICE_EXPENSES` \| `TAX_PAYMENT` \| `TRANSPORTATION_FEES_FOR_GOODS` \| `CONSTRUCTION_COSTS` \| `INSURANCE_PREMIUM` \| `GENERAL_GOODS_TRADES` \| `INSURANCE_CLAIMS_PAYMENT` \| `FAMILY_MAINTENANCE` \| `EDUCATION_EXPENSES` \| `MEDICAL_TREATMENT` \| `DONATIONS` \| `MUTUAL_FUND_INVESTMENT` \| `CURRENCY_EXCHANGE` \| `USER_WITHDRAWAL` \| `ADVANCE_PAYMENTS_FOR_GOODS` \| `VENDOR_CONTRACTOR_SOFTWARE_PAYOUTS` \| `MERCHANT_SETTLEMENT` \| `REPATRIATION_FUND_SETTLEMENT` \| `PERSONAL_REMITTANCE` \| `RETURN_OF_FUNDS` | No | crypto_to_fiat only: the purpose every payout carries. Required where an off-ramp transfer to the same destination requires one |
| `metadata` | object | No | Optional key-value data returned on the route |

#### get_payment_route

Get one payment route by ID, including its deposit instructions (bank details, or an off-ramp or swap route's deposit address) and payout destination

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID |

#### list_payment_routes

List payment routes for one customer, or across every customer when customerId is omitted

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | No | Only this customer's routes; omit to list routes across all customers |
| `status` | `activated` \| `deactivated` \| `pending` \| `closed` | No | Filter by route status |
| `limit` | number | No | Maximum number of routes to return |
| `startingAfter` | string | No | Return routes after this route ID (the last ID of the previous page) |

#### update_payment_route

Update a payment route's settings (e.g., deposit handling mode)

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID to update |
| `depositHandlingMode` | `auto_payout` \| `hold` \| `manual` | Yes | New deposit handling mode |

#### set_payment_route_status

Deactivate a payment route so it stops accepting new deposits, or reactivate it. You can reactivate only a route your organization deactivated (deactivation_reason TENANT_REQUEST); a route Stables deactivated can only be reactivated by Stables support. Reactivating may charge the current month's account fee from the prefund balance if it has not been paid.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID |
| `status` | `deactivated` \| `activated` | Yes | 'deactivated' to switch the route off, 'activated' to switch it back on |

#### get_payment_route_history

Get the activity history for a payment route: each deposit and the payout it triggered

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID |
| `limit` | number | No | Maximum number of events to return (default: 10) |

#### update_route_destination

Change the payout wallet on an existing payment route. Deposits after this point are paid out to the new address; use it when a customer rotates wallets rather than creating a second route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID |
| `destinationAddress` | string | Yes | New payout wallet address |
| `destinationPaymentRail` | `arbitrum` \| `avalanche_c_chain` \| `base` \| `celo` \| `ethereum` \| `optimism` \| `polygon` \| `solana` \| `stellar` \| `tron` | Yes | Blockchain network the new address belongs to |
| `destinationCurrency` | `usdc` \| `usdt` \| `dai` \| `pyusd` \| `eurc` | No | Stablecoin to receive. Default: `"usdt"`. |

#### list_route_whitelist

List the bank accounts whitelisted to pay into an AUD payment route. Some Australian routes only accept deposits from whitelisted source accounts.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route ID |

#### add_route_whitelist_account

Whitelist an Australian bank account (BSB and account number) to pay into an AUD payment route.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route ID |
| `bsbNumber` | string | Yes | Source account BSB |
| `accountNumber` | string | Yes | Source account number |
| `enabled` | boolean | No | Whether deposits from it are accepted now. Default: `true`. |

#### update_route_whitelist_account

Change or disable a whitelisted source account on an AUD payment route. Send the full record: BSB, account number and status.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route ID |
| `sourceAccountId` | integer | Yes | The whitelist entry ID (from list_route_whitelist) |
| `bsbNumber` | string | Yes | Source account BSB |
| `accountNumber` | string | Yes | Source account number |
| `enabled` | boolean | Yes | false to stop accepting deposits from it |

#### register_route_payid

Register a PayID for an activated AUD payment route, so payers can send to an email-style alias instead of a BSB and account number. Calling it again on a route that already has one returns the existing PayID.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The AUD payment route ID |

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
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_payment_route_history |
| `fileName` | string | Yes | File name shown to Stables, e.g. 'invoice-2041.pdf' |
| `base64Url` | string | Yes | The file as a data URL: 'data:<mime>;base64,<data>' |
| `type` | `invoice` \| `contract` \| `other` | No | What the document is (default other) |

#### list_documents

List the documents attached to a transfer or a payment route deposit, newest first.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_payment_route_history |

#### get_document_download_url

Get a short-lived link to download a document attached to a transfer or a payment route deposit.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_payment_route_history |
| `documentId` | string | Yes | The document ID from list_documents |

#### delete_document

Remove a document from a transfer or a payment route deposit. This cannot be undone, so confirm with a human first.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `on` | `transfer` \| `deposit` | Yes | What the document belongs to: a transfer, or a deposit on a payment route |
| `transactionId` | string | Yes | The transfer ID, or the deposit ID from get_payment_route_history |
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

### Developer fee

#### get_developer_fee

Get your developer fee: what you charge your customers on top of Stables' fees on every routing onramp and offramp, as a percent, a fixed USD amount per transaction, or both.

_No parameters._

#### set_developer_fee

Set or change your developer fee. Fields you omit keep their value; null stops charging that part, but at least one part must remain (use remove_developer_fee to stop it altogether). Applies to transactions quoted after the change.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `percent` | string,null | No | Percent of every routing onramp and offramp, as a decimal string with at most 2 decimals, above 0 and at most 10. Omit to keep the current value; null to stop charging it. |
| `fixedAmountUsd` | string,null | No | Fixed USD amount per routing onramp and offramp, as a decimal string with at most 2 decimals, above 0 and at most 10. Omit to keep the current value; null to stop charging it. |

#### remove_developer_fee

Stop charging any developer fee on new routing transactions. Transactions already quoted keep their fees.

_No parameters._

### Sandbox

#### simulate_route_deposit

SANDBOX ONLY. Simulate a deposit into a payment route so you can watch the conversion and payout complete without real money: a fiat deposit for an on-ramp or fiat-to-fiat route, or the route's USDT/USDC arriving on its address for an off-ramp (crypto_to_fiat) or swap (crypto_to_crypto) route. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `customerId` | string | Yes | The customer ID |
| `virtualAccountId` | string | Yes | The payment route ID |
| `amount` | string | Yes | Deposit amount in major units of the route's source currency (e.g. '500.00') |
| `scenario` | `create_only` \| `completed` \| `failed` | No | 'completed' runs the deposit through to payout, 'failed' exercises the failure path, 'create_only' stops at the deposit. Off-ramp routes take 'completed' only |
| `senderName` | string | No | Name to attribute the deposit to (fiat routes) |
| `senderReference` | string | No | Payment reference on the deposit; for an off-ramp or swap route, the sending wallet address |
| `externalDepositId` | string | No | Your own reference for this deposit |

#### simulate_transfer_deposit

SANDBOX ONLY. Simulate the customer sending the crypto an off-ramp transfer is waiting on, so the transfer can progress to payout without an on-chain payment. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `transferId` | string | Yes | The transfer awaiting funds |

#### simulate_balance_deposit

SANDBOX ONLY. Simulate a stablecoin deposit into your balance wallet on a network. The sender defaults to your first allowed (whitelisted) wallet, so a plain call credits the balance; an unknown sender is held for review, as it would be in production. Fails on production.

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `network` | `ethereum` \| `polygon` \| `solana` \| `tron` | Yes | Balance network |
| `amount` | string | Yes | Amount in major units, e.g. '250' or '250.5' (at most 6 decimals) |
| `currency` | `USDT` \| `USDC` | No | Stablecoin deposited. Default: `"USDT"`. |
| `senderAddress` | string | No | On-chain sender. Defaults to your first allowed wallet on the network |

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

### Deprecated names

These old names still work for one release and behave exactly like the tool they were renamed to. Move to the new name.

- `create_virtual_account` → `create_payment_route`
- `get_virtual_account` → `get_payment_route`
- `list_virtual_accounts` → `list_payment_routes`
- `update_virtual_account` → `update_payment_route`
- `set_virtual_account_status` → `set_payment_route_status`
- `get_virtual_account_history` → `get_payment_route_history`
