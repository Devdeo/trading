---
name: NSE caching and rate limit strategy
description: How to avoid NSE API blocks and serve data reliably
---

## Problem
NSE blocks repeated requests from the same IP after the first few calls. A 15s timeout then occurs,
and if the cache is empty for that specific request (e.g. new expiry), the frontend gets an error.

## Solution
- **Cache TTL**: 3 minutes for fresh data, 30 minutes as fallback after NSE blocks
- **Polling interval**: 60 seconds on the frontend (was 10s — too aggressive)
- **Pre-warm**: When contract-info loads all expiry dates, fire background requests for ALL expiries
  so the cache is warm before the user switches expiry
- **Direct filteredData**: Set `filteredData` directly in the fetch effect, not via a separate
  `useEffect([data])` — avoids stale-closure race conditions in React's effect scheduling

**Why:** NSE rate-limits Replit's IP quickly. Cache misses on expiry switches caused blank charts.
**How to apply:** Any new NSE endpoint should use the same pattern (3min TTL + 30min fallback + pre-warm).
