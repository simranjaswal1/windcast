"""Loads the January 2026 snapshot (CSV) written by scripts/fetch_data.py."""
from __future__ import annotations

import json
import os
from datetime import date, timedelta
from functools import lru_cache
from pathlib import Path

import pandas as pd

DATA_DIR = Path(os.getenv("WINDCAST_DATA_DIR", Path(__file__).resolve().parents[1] / "data"))
FIRST_DAY, LAST_DAY = date(2026, 1, 1), date(2026, 1, 31)


def delivery_days() -> list[date]:
    return [FIRST_DAY + timedelta(days=i) for i in range((LAST_DAY - FIRST_DAY).days + 1)]


@lru_cache(maxsize=1)
def load() -> tuple[pd.DataFrame, pd.DataFrame, dict]:
    try:
        actuals = pd.read_csv(DATA_DIR / "actuals.csv")
        forecasts = pd.read_csv(DATA_DIR / "forecasts.csv")
    except FileNotFoundError as e:
        raise RuntimeError(
            f"Data snapshot missing in {DATA_DIR}. Run `python -m scripts.fetch_data` "
            "(real Elexon data) or `python -m scripts.make_synthetic` (offline dev data)."
        ) from e
    for df, cols in ((actuals, ["startTime"]), (forecasts, ["startTime", "publishTime"])):
        for c in cols:
            df[c] = pd.to_datetime(df[c], utc=True)
    meta_path = DATA_DIR / "meta.json"
    meta = json.loads(meta_path.read_text()) if meta_path.exists() else {"source": "unknown"}
    return actuals.reset_index(drop=True), forecasts.reset_index(drop=True), meta
