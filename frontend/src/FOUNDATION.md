# DeltaZero Phase 0 foundation

This directory contains the typed risk core, BSC web3 configuration, domain
models, and the read-only ERC-8004 adapter for the BNB Agent Studio rebuild.

The existing product is already deployed from `frontend/app` on Next 16.2.10.
Phase 0 does not downgrade that application or introduce a second `src/app`
directory. The new code is App Router compatible and can be moved behind the
new BNB marketplace routes in a later phase without risking the current site.

No UI, hire flow, x402 flow, worker, wallet signing, or deployment change is
part of this foundation.
