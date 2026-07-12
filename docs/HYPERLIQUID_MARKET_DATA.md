# Hyperliquid Market Data

DeltaZero exposes an on-demand, read-only Hyperliquid market context endpoint:

```http
GET /market/hyperliquid?asset=ETH&lookback_hours=24
```

Optional `dex` supports a named HIP-3 perpetual DEX. Funding lookback defaults to 24 hours and is limited to 168 hours.

The service uses only `https://api.hyperliquid.xyz/info`:

- `metaAndAssetCtxs` for asset metadata, mark price, oracle price, signed current funding, open interest, 24-hour notional volume, and premium when available;
- `fundingHistory` for the optional historical summary.

Current funding APY is calculated as:

```text
hourly funding rate × 24 × 365 × 100
```

The sign is preserved. Positive funding means longs pay shorts; negative funding means shorts pay longs. Historical averages are never presented as current funding.

Market contexts are cached for 30 seconds and funding histories for five minutes. Failures are cached for no more than 10 seconds. Unknown assets, malformed payloads, timeouts, and partial history are returned explicitly.

## Builder economics

The existing Builder input represents a funding cost to the short hedge. Live signed funding is therefore converted as:

```text
short-side funding cost = -current signed market funding APY
```

Positive funding improves projected short-hedge carry. Negative funding reduces it. Funding is variable and may change after analysis.

## Security

The service does not call Hyperliquid's exchange endpoint, place orders, request signatures, or execute the proposed hedge.
