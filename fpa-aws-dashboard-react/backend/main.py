from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="FPA AWS Dashboard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.data import router as data_router
from api.scenarios import router as scenarios_router
from api.ai import router as ai_router

app.include_router(data_router)
app.include_router(scenarios_router)
app.include_router(ai_router)


@app.on_event("startup")
def startup():
    from models.database import init_db
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
