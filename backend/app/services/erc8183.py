"""ERC-8183 job adapter with an explicit safe simulation boundary.

The repository does not currently contain the deployed ERC-8183 ABI or
contract address. This adapter therefore never invents an on-chain
transaction. It creates a deterministic local job identifier until a real
contract address and ABI-backed writer are configured.
"""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass

from app.models.jobs import ERC8183JobTerms


@dataclass(frozen=True)
class ERC8183Creation:
    terms: ERC8183JobTerms
    configured: bool
    message: str


def canonical_hash(value: object) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


class ERC8183Adapter:
    """Prepare ERC-8183 terms and refuse unimplemented live writes."""

    def __init__(self, *, chain_id: int = 56, contract_address: str | None = None) -> None:
        self.chain_id = chain_id
        self.contract_address = contract_address or os.getenv("ERC8183_CONTRACT_ADDRESS", "").strip() or None

    def create_job(
        self,
        *,
        agent_id: str,
        buyer: str,
        provider: str,
        budget_amount: str,
        deadline: str,
        risk_policy_hash: str,
        expected_schema_hash: str,
        request_fingerprint: str,
    ) -> ERC8183Creation:
        if self.contract_address:
            raise RuntimeError(
                "An ERC8183 contract address is configured, but the ABI-backed live writer is not implemented in this adapter. "
                "Refusing to claim an on-chain job. Configure a tested writer before enabling live creation."
            )

        mode = "simulation"
        job_id = "erc8183_" + hashlib.sha256(
            f"{agent_id}:{buyer}:{provider}:{budget_amount}:{deadline}:{request_fingerprint}".encode()
        ).hexdigest()[:32]
        terms = ERC8183JobTerms(
            chain_id=self.chain_id,
            contract_address=self.contract_address,
            job_id=job_id,
            agent_id=agent_id,
            buyer=buyer,
            provider=provider,
            budget_amount=budget_amount,
            deadline=deadline,
            risk_policy_hash=risk_policy_hash,
            expected_schema_hash=expected_schema_hash,
            mode=mode,
            transaction_hash=None,
        )
        if mode == "simulation":
            return ERC8183Creation(
                terms=terms,
                configured=False,
                message=(
                    "ERC-8183 contract is not configured. This job is a local simulation; "
                    "no on-chain transaction was submitted."
                ),
            )
        return ERC8183Creation(terms=terms, configured=False, message="ERC-8183 simulation terms prepared.")
