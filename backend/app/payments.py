"""x402 payment configuration for DeltaZero's paid API resources.

The implementation delegates challenge creation to the official OKX x402 SDK.
When facilitator credentials are configured, signature verification and on-chain
settlement are delegated as well. Without those credentials, the service remains
in challenge-only mode and never releases a protected resource.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal, InvalidOperation
import os
import re

from x402.http import (
    OKXAuthConfig,
    OKXFacilitatorClient,
    OKXFacilitatorConfig,
    PaymentOption,
    RouteConfig,
)
from x402 import SettleResponse, SupportedKind, SupportedResponse, VerifyResponse
from x402.mechanisms.evm.deferred.server import AggrDeferredEvmScheme
from x402.mechanisms.evm.exact.server import ExactEvmScheme
from x402.server import x402ResourceServer


_EVM_ADDRESS_RE = re.compile(r"^0x[a-fA-F0-9]{40}$")
_CAIP2_EVM_NETWORK_RE = re.compile(r"^eip155:[1-9][0-9]*$")


@dataclass(frozen=True)
class PaymentSettings:
    """Validated configuration for OKX-facilitated x402 payments."""

    receiver: str
    price_usdt: str
    network: str
    okx_api_key: str | None = None
    okx_secret_key: str | None = None
    okx_passphrase: str | None = None
    okx_base_url: str = "https://web3.okx.com"

    @classmethod
    def from_environment(cls) -> PaymentSettings | None:
        """Load payment settings, returning ``None`` for an unconfigured local app.

        The three payment variables are sufficient for safe challenge-only mode.
        Facilitator credentials are optional as a group; when absent, no paid
        request can reach business logic. A partially configured credential group
        is rejected.
        """

        values = {
            "PAYMENT_RECEIVER": os.getenv("PAYMENT_RECEIVER", "").strip(),
            "PAYMENT_PRICE_USDT": os.getenv("PAYMENT_PRICE_USDT", "").strip(),
            "PAYMENT_NETWORK": os.getenv("PAYMENT_NETWORK", "").strip(),
            "OKX_API_KEY": os.getenv("OKX_API_KEY", "").strip(),
            "OKX_SECRET_KEY": os.getenv("OKX_SECRET_KEY", "").strip(),
            "OKX_PASSPHRASE": os.getenv("OKX_PASSPHRASE", "").strip(),
        }

        payment_keys = ("PAYMENT_RECEIVER", "PAYMENT_PRICE_USDT", "PAYMENT_NETWORK")
        if not any(values[key] for key in payment_keys):
            return None

        missing_payment = [key for key in payment_keys if not values[key]]
        if missing_payment:
            raise RuntimeError(
                "Incomplete x402 payment configuration; missing environment variables: "
                + ", ".join(missing_payment)
            )

        credential_keys = ("OKX_API_KEY", "OKX_SECRET_KEY", "OKX_PASSPHRASE")
        credential_count = sum(bool(values[key]) for key in credential_keys)
        if credential_count not in (0, len(credential_keys)):
            missing_credentials = [key for key in credential_keys if not values[key]]
            raise RuntimeError(
                "Incomplete OKX facilitator configuration; missing environment variables: "
                + ", ".join(missing_credentials)
            )

        receiver = values["PAYMENT_RECEIVER"]
        if not _EVM_ADDRESS_RE.fullmatch(receiver):
            raise RuntimeError("PAYMENT_RECEIVER must be a 42-character EVM address")

        network = values["PAYMENT_NETWORK"]
        if not _CAIP2_EVM_NETWORK_RE.fullmatch(network):
            raise RuntimeError("PAYMENT_NETWORK must use CAIP-2 EVM format, such as eip155:196")

        price = _normalize_price(values["PAYMENT_PRICE_USDT"])
        base_url = os.getenv("OKX_BASE_URL", "https://web3.okx.com").strip()
        if not base_url.startswith("https://"):
            raise RuntimeError("OKX_BASE_URL must be an HTTPS URL")

        return cls(
            receiver=receiver,
            price_usdt=price,
            network=network,
            okx_api_key=values["OKX_API_KEY"] or None,
            okx_secret_key=values["OKX_SECRET_KEY"] or None,
            okx_passphrase=values["OKX_PASSPHRASE"] or None,
            okx_base_url=base_url.rstrip("/"),
        )

    @property
    def has_facilitator_credentials(self) -> bool:
        """Return whether live verification and settlement can be enabled."""

        return bool(self.okx_api_key and self.okx_secret_key and self.okx_passphrase)


def _normalize_price(value: str) -> str:
    """Validate a positive USDT amount with at most six decimal places."""

    try:
        price = Decimal(value)
    except InvalidOperation as exc:
        raise RuntimeError("PAYMENT_PRICE_USDT must be a positive decimal amount") from exc

    if not price.is_finite() or price <= 0:
        raise RuntimeError("PAYMENT_PRICE_USDT must be greater than zero")
    if price.as_tuple().exponent < -6:
        raise RuntimeError("PAYMENT_PRICE_USDT supports at most six decimal places")

    return format(price.normalize(), "f")


class ChallengeOnlyFacilitator:
    """Advertise supported X Layer schemes without accepting any payment.

    This mode exists solely to verify a production 402 challenge before official
    facilitator credentials are available. Verification always fails closed, so
    a forged or otherwise unverified payment header cannot release a resource.
    """

    def __init__(self, network: str) -> None:
        self.network = network

    def get_supported(self) -> SupportedResponse:
        return SupportedResponse(
            kinds=[
                SupportedKind(x402Version=2, scheme="exact", network=self.network),
                SupportedKind(
                    x402Version=2,
                    scheme="aggr_deferred",
                    network=self.network,
                ),
            ]
        )

    async def verify(self, payload, requirements) -> VerifyResponse:
        return VerifyResponse(
            isValid=False,
            invalidReason="facilitator_credentials_unavailable",
            invalidMessage=(
                "Paid settlement is disabled until official OKX facilitator "
                "credentials are configured."
            ),
        )

    async def settle(self, payload, requirements) -> SettleResponse:
        return SettleResponse(
            success=False,
            errorReason="facilitator_credentials_unavailable",
            errorMessage="Paid settlement is not configured.",
            transaction="",
            network=self.network,
        )


def create_payment_server(settings: PaymentSettings) -> x402ResourceServer:
    """Create a challenge-only or facilitator-backed x402 resource server."""

    if settings.has_facilitator_credentials:
        facilitator = OKXFacilitatorClient(
            OKXFacilitatorConfig(
                auth=OKXAuthConfig(
                    api_key=settings.okx_api_key or "",
                    secret_key=settings.okx_secret_key or "",
                    passphrase=settings.okx_passphrase or "",
                ),
                base_url=settings.okx_base_url,
                sync_settle=True,
                timeout=30.0,
            )
        )
    else:
        facilitator = ChallengeOnlyFacilitator(settings.network)

    server = x402ResourceServer(facilitator)
    server.register(settings.network, ExactEvmScheme())
    server.register(settings.network, AggrDeferredEvmScheme())
    return server


def paid_routes(settings: PaymentSettings) -> dict[str, RouteConfig]:
    """Return the exact set of paid DeltaZero resources."""

    price = f"${settings.price_usdt}"

    def route(path: str, description: str) -> RouteConfig:
        return RouteConfig(
            accepts=[
                PaymentOption(
                    scheme="exact",
                    price=price,
                    network=settings.network,
                    pay_to=settings.receiver,
                ),
                PaymentOption(
                    scheme="aggr_deferred",
                    price=price,
                    network=settings.network,
                    pay_to=settings.receiver,
                ),
            ],
            resource=path,
            description=description,
            mime_type="application/json",
        )

    return {
        "POST /strategy/build": route(
            "/strategy/build",
            "Build and evaluate a deterministic pseudo-delta-neutral strategy",
        ),
        "POST /wallet/analyze": route(
            "/wallet/analyze",
            "Analyze supported public wallet positions and portfolio risk",
        ),
        "POST /monte-carlo/run": route(
            "/monte-carlo/run",
            "Run deterministic Monte Carlo sensitivity analysis",
        ),
    }
