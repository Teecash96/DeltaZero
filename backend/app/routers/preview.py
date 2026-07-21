"""Public product-preview route using the production strategy engine."""

from fastapi import APIRouter

from app.models.preview import StrategyPreviewRequest, StrategyPreviewResponse
from app.models.schemas import BuildRequest
from app.services.builder import build_strategy

router = APIRouter(prefix="/preview", tags=["preview"])


@router.post("/compare", response_model=StrategyPreviewResponse)
def compare_strategy_styles(request: StrategyPreviewRequest) -> StrategyPreviewResponse:
    """Compare two policy styles without a wallet or paid analysis.

    The preview intentionally uses manual assumptions and the same deterministic
    builder as the full product. It does not read positions or market data.
    """

    shared = request.model_dump()
    conservative = build_strategy(BuildRequest(**shared, target_style="conservative_income"))
    aggressive = build_strategy(BuildRequest(**shared, target_style="aggressive_carry"))
    return StrategyPreviewResponse(
        conservative=conservative,
        aggressive=aggressive,
        limitation=(
            "Public comparison using submitted assumptions. It is not live market data, "
            "a wallet assessment, or a profitability forecast."
        ),
    )
