"""Monte Carlo sensitivity API route."""

from fastapi import APIRouter

from app.models.monte_carlo import MonteCarloRequest, MonteCarloResponse
from app.services.monte_carlo import run_monte_carlo

router = APIRouter(prefix="/monte-carlo", tags=["monte-carlo"])


@router.post("/run", response_model=MonteCarloResponse)
def monte_carlo_run(request: MonteCarloRequest) -> MonteCarloResponse:
    return run_monte_carlo(request)
