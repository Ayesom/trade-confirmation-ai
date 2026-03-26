import os
import sys
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()

from routers import templates, diff, generate, metrics_router
from services import embeddings

app = FastAPI(
    title="Trade Confirmation AI",
    description="AI/ML-Driven Trade Confirmation Automation System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(templates.router, prefix="/api")
app.include_router(diff.router, prefix="/api")
app.include_router(generate.router, prefix="/api")
app.include_router(metrics_router.router, prefix="/api")


@app.on_event("startup")
async def startup_event():
    print("Seeding template library...")
    try:
        result = embeddings.seed_templates()
        print(f"✓ {result['message']}")
    except Exception as e:
        print(f"⚠ Seed warning: {e}")


@app.get("/")
async def root():
    return {
        "service": "Trade Confirmation AI",
        "version": "1.0.0",
        "status": "running",
        "endpoints": ["/templates", "/diff", "/generate", "/metrics"],
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}