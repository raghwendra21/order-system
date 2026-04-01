# Technical answers — order splitter

This document summarizes design choices, edge-case handling, and how tests map to behavior.

## Configuration: `defaultPrices` and `defaultPriceBase`

- **`defaultPrices`**: Symbol-specific fallbacks when the client omits `price` for a known ticker.
- **`defaultPriceBase`**: Default `100`, overridable via `DEFAULT_PRICE_BASE`. Any symbol not in `defaultPrices` and without a client `price` uses this base so the API does not fail on unknown tickers for the challenge scope.

`DEFAULT_PRICE_BASE` is parsed with `readPositiveNumber`: non-finite or non-positive values fall back to `100`.

## Money rounding and `amount` fields

**Problem addressed:** Rounding each line with `toDecimalPlaces` and then applying a second `roundAmount` pass, or mixing floats with allocation remainders, can leave the sum of line `amount` values a penny off from `totalAmount`.

**Approach:**

1. Normalize **`totalAmount`** once to `amountDecimals` (half-up) and store that as the order total.
2. For every line except the last, allocate `total * weight / 100` rounded to `amountDecimals` (half-up), and track running **`allocatedAmount`** in `Decimal`.
3. The **last line** gets `totalAmount.minus(allocatedAmount)` so the breakdown sums **exactly** to the stored total (no drift).
4. **Prices** (resolved or configured) are rounded to `amountDecimals` before quantity math.
5. **Quantity** = `amount / price` rounded to `quantityDecimals` (half-up), using the same line `amount` and `price` decimals as in the response.

Tests: `breakdown line amounts sum to rounded totalAmount`, `quantities use the same rounded amount as each line`.

## Execution date: timezone library and session boundaries

**Library:** [Luxon](https://moment.github.io/luxon/) with IANA zone **`America/New_York`** (configurable via `MARKET_TIMEZONE`).

**Why not `Date#setHours` on a UTC instant?** `setHours` uses the **host** local timezone. The same UTC instant schedules different “9:30” opens on different machines and interacts badly with DST when converting between “local wall time” and UTC. Luxon keeps **wall time and zone** explicit: we interpret `now` as an instant, project it into the market zone, then build **9:30 on the calendar** in that zone and compare in-zone.

**Rules implemented:**

- Candidate time is **open** at `marketOpenHour` / `marketOpenMinute` (default **9:30**) in the market zone.
- **Weekends** (Saturday/Sunday in that zone) are skipped.
- The chosen instant is the **next** open strictly **after** `now` (so pre-market same weekday → that day’s open; at or after that day’s open → next trading day’s open).

**Open vs closed hours:** Regular session is documented in config as **9:30–16:00** Eastern (`marketCloseHour` / `marketCloseMinute`). Scheduling is **always** “next session **open** after `now`”; we do not model early closes, holidays, or auction windows. Extending that would require a market calendar.

Tests: same-day before open, next day after open has passed, weekend roll to Monday, `getExecutionDate` vs `createOrder` consistency.

## Logging

`src/logger.ts` exposes **`debug`**, **`info`**, **`warn`**, **`error`**. Minimum level comes from **`LOG_LEVEL`** (default `info`). Lower-ranked messages are suppressed (e.g. `LOG_LEVEL=warn` shows only `warn` and `error`). HTTP request completion and boot messages use **`info`**.

## DST and “local → UTC” pitfalls

All execution scheduling uses **Luxon** with a fixed **IANA zone** rather than “interpret UTC string as local” or “set local hours then `toISOString`”. DST transitions affect **how many UTC minutes** correspond to **9:30 America/New_York**, but the **wall-clock rule** stays correct in the market zone.

## Tests and coverage

### Running tests

```bash
npm test
```

### Coverage (Node experimental)

```bash
npm run test:coverage
```

This runs `node --test` with `--experimental-test-coverage` on the compiled `dist/tests/*.test.js` output. Thresholds are not enforced in CI here; use the printed summary to track line coverage.

### Edge cases covered

| Area | Cases |
|------|--------|
| Allocation | Custom prices, decimal weights within tolerance, last line remainder, sum equals total |
| Pricing | Explicit price, `defaultPrices`, unknown symbol + `defaultPriceBase` |
| Execution | Pre-open same day, post-open next day, weekend → Monday, helper vs `createOrder` |
| Orders | `BUY`/`SELL` side on each line, weight validation, invalid `orderType`, empty portfolio, bad symbol/weight/price, `maxPortfolioItems` |
| HTTP | Happy path create + paginated history, invalid JSON, invalid pagination, `/health`, 404, missing POST body, negative `totalAmount` |
| Logging | Subprocess checks for `LOG_LEVEL=error` (only error) and `LOG_LEVEL=debug` (debug+info) |

After the expanded suite, run `npm run test:coverage` and use Node’s printed **line % / branch %** for `dist/src/*.js` as the current baseline (figures vary slightly by Node version).

### Gaps / intentional simplifications

- No US market **holiday** calendar.
- **Single** global `LOG_LEVEL`; no per-module levels.
- **defaultPriceBase** must stay positive; invalid env falls back to `100`.
