---
name: NSE API response structures
description: Key structural differences between NSE API endpoints used in this app
---

## option-chain-v3 (index/equity)
- URL: `option-chain-v3?type=Indices|Equity&symbol=X&expiry=DD-Mon-YYYY`
- Response: `{records: {data, expiryDates, underlyingValue, strikePrices}, filtered: {data, CE, PE}}`
- Each record: `{expiryDates: "23-Jun-2026" (string, not array!), CE: {..., expiryDate: "23-06-2026"}, PE: {...}, strikePrice}`
- TOP-LEVEL `expiryDate` is UNDEFINED — it is `expiryDates` (plural string) on each record
- CE/PE inner `expiryDate` format is "DD-MM-YYYY" (dashes), NOT "DD-Mon-YYYY"
- API already filters by expiry in the URL — use `filtered.data || records.data` directly

## option-chain-com (commodities)
- URL: `option-chain-com?symbol=X` (no expiry param — returns ALL expiries at once)
- Response: `{records: {data, expiryDates (array), strikePrices}, filtered: {data, CE, PE}}`
- Each record: `{strikePrice, expiryDate: "09-Jul-2026" (direct, singular), CE: {...}, PE: {...}}`
- `underlyingValue` is UNDEFINED for commodities — use highest OI strike as ATM
- Filter by `expiryDate` CLIENT-SIDE (no extra API call needed when switching expiry)

## quotes-commodity-derivatives-master
- URL: `quotes-commodity-derivatives-master`
- Response: `{SYMBOL: [{instrumentType, expiryDates: [...]}], ...}`
- Filter by `instrumentType` in OPTFUT, OPTBLN, OPTBAS, OPTFUTENR for option-chain symbols
- Commodity symbols with options: COPPER, ZINC, GOLDM, GOLD, SILVER, SILVERM, CRUDEOIL, NATURALGAS

**Why:** These differences caused silent failures when the wrong field names were used.
**How to apply:** Always check field names from fresh API responses before processing.
