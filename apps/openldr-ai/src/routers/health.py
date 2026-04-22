from fastapi import APIRouter
from models.schemas import HealthResponse
from core.config import settings
from services.inference import get_loaded_model_id

router = APIRouter(prefix="/health", tags=["health"])


@router.get("", response_model=HealthResponse)
async def health_check():
    return HealthResponse(
        status="ok",
        version=settings.AI_APP_VERSION,
        loaded_model=get_loaded_model_id(),
    )
