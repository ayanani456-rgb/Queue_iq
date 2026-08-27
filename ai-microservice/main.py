from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.ai_routes import router as ai_router
from app.routes.calendar_routes import router as calendar_router

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

app.include_router(ai_router)
app.include_router(calendar_router)


@app.get("/api/ai/health")
def ai_health():
    return {
        "status": "AI + Calendar running",
        "ai_tasks": 5,
        "calendar": "enabled",
    }
