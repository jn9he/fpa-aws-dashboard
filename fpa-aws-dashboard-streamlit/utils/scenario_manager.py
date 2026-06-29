"""Scenario persistence — save/load/compare named scenarios as JSON.

Implemented in Task 9.
"""
import json
from pathlib import Path
from datetime import datetime

SCENARIOS_DIR = Path(__file__).resolve().parent.parent / "scenarios"
SCENARIOS_DIR.mkdir(exist_ok=True)


def list_scenarios():
    """Return list of saved scenario names."""
    return [f.stem for f in SCENARIOS_DIR.glob("*.json")]


def save_scenario(name: str, description: str, overrides: dict, project_targets: dict | None = None):
    """Save scenario to JSON file."""
    data = {
        "name": name,
        "description": description,
        "created_at": datetime.now().isoformat(),
        "overrides": overrides,
        "project_targets": project_targets or {},
    }
    path = SCENARIOS_DIR / f"{name}.json"
    path.write_text(json.dumps(data, indent=2))


def load_scenario(name: str) -> dict:
    """Load scenario from JSON file."""
    path = SCENARIOS_DIR / f"{name}.json"
    return json.loads(path.read_text())


def delete_scenario(name: str):
    """Delete a scenario JSON file."""
    path = SCENARIOS_DIR / f"{name}.json"
    if path.exists():
        path.unlink()
