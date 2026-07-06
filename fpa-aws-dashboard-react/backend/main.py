from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os

load_dotenv()

app = FastAPI(title="FPA AWS Dashboard API")

# In production, set ALLOWED_ORIGINS to the Static Web App URL
# e.g. "https://my-app.azurestaticapps.net"
# Multiple origins can be comma-separated.
origins = os.environ.get("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.data import router as data_router
from api.scenarios import router as scenarios_router
from api.ai import router as ai_router
from api.export import router as export_router

app.include_router(data_router)
app.include_router(scenarios_router)
app.include_router(ai_router)
app.include_router(export_router)


@app.on_event("startup")
def startup():
    from models.database import init_db
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}
