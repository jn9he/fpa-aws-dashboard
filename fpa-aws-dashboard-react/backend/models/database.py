from sqlalchemy import create_engine, Column, Integer, String, DateTime, Text
from sqlalchemy.orm import sessionmaker, declarative_base
from datetime import datetime
import json
import os
from pathlib import Path

# In production (Azure Container App), DATABASE_URL is set via env var
# pointing to the mounted volume (e.g. sqlite:////mnt/dbdata/scenarios.db).
# Locally, falls back to the data/ directory.
_default_db = f"sqlite:///{Path(__file__).resolve().parent.parent / 'data' / 'scenarios.db'}"
DB_URL = os.environ.get("DATABASE_URL", _default_db)

engine = create_engine(DB_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine)
Base = declarative_base()


class Scenario(Base):
    __tablename__ = "scenarios"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, nullable=False)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow)
    overrides = Column(Text, default="{}")
    project_targets = Column(Text, default="{}")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "overrides": json.loads(self.overrides or "{}"),
            "project_targets": json.loads(self.project_targets or "{}"),
        }


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
