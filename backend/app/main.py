"""FastAPI app: JSON API under /api plus the built React frontend at /."""
from __future__ import annotations

from datetime import date
from functools import lru_cache
from pathlib import Path

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import analysis as an
from . import data

DEFAULT_CUTOFF = "09:00"  # UK time on D-1; day-ahead gate closure is ~09:20-09:50, so this is conservative

app = FastAPI(title="Windcast API")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"])


def _clean(obj):
    """Make values JSON-safe: NaN -> None, Timestamps -> ISO UTC strings."""
    if isinstance(obj, dict):
        return {k: _clean(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_clean(v) for v in obj]
    if isinstance(obj, pd.Timestamp):
        return obj.tz_convert("UTC").strftime("%Y-%m-%dT%H:%M:%SZ")
    if isinstance(obj, (float, np.floating)):
        return None if np.isnan(obj) else float(obj)
    if isinstance(obj, np.integer):
        return int(obj)
    return obj


def _cutoff(value: str):
    try:
        return an.parse_cutoff(value)
    except ValueError:
        raise HTTPException(422, "cutoff must be HH:MM, e.g. 09:00")


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/meta")
def meta():
    actuals, fc, info = data.load()
    return _clean({
        "source": info.get("source"),
        "days": [d.isoformat() for d in data.delivery_days()],
        "default_cutoff": DEFAULT_CUTOFF,
        "forecast_rows": len(fc),
        "actual_rows": len(actuals),
    })


@app.get("/api/decision")
def decision(day: date, cutoff: str = Query(DEFAULT_CUTOFF)):
    """The forecast a trader would have had at the cutoff, for one delivery day."""
    actuals, fc, _ = data.load()
    cut = _cutoff(cutoff)
    if day not in data.delivery_days():
        raise HTTPException(404, "day outside January 2026")
    sel = an.decision_forecasts(fc, day, cut)
    if sel.empty:
        raise HTTPException(404, "no forecast was published before the cutoff for this day")
    df = sel.rename(columns={"generation": "forecast"}).merge(
        actuals[["startTime", "generation"]].rename(columns={"generation": "actual"}),
        on="startTime", how="left")  # left join: today's/unpublished actuals stay null
    df["error"] = df["forecast"] - df["actual"]
    return _clean({
        "day": day.isoformat(),
        "cutoff_utc": an.cutoff_utc(day, cut),
        "points": df[["startTime", "publishTime", "forecast", "actual", "horizon_h"]].to_dict("records"),
        "summary": {
            "periods": len(df),
            "latest_publish": df["publishTime"].max(),
            "earliest_publish": df["publishTime"].min(),
            "mean_forecast": df["forecast"].mean(),
            "peak_forecast": df["forecast"].max(),
            "min_forecast": df["forecast"].min(),
            "day_metrics": an.summarize(df.dropna(subset=["actual"])),
        },
    })


@lru_cache(maxsize=32)
def _accuracy(cutoff: str) -> dict:
    actuals, fc, _ = data.load()
    days = data.delivery_days()
    dec = an.join_actuals(an.decisions_for_days(fc, days, an.parse_cutoff(cutoff)), actuals)
    if dec.empty:
        raise HTTPException(404, "no decision-time forecasts with matching actuals")
    dec = an.add_local_fields(dec)
    return _clean({
        "cutoff": cutoff,
        "summary": an.summarize(dec),
        "decision_horizon_h": {"min": dec["horizon_h"].min(), "max": dec["horizon_h"].max()},
        "by_day": an.grouped(dec, "day"),
        "by_hour": an.grouped(dec, "hour"),
        "by_horizon": an.horizon_table(fc, actuals),
    })


@app.get("/api/accuracy")
def accuracy(cutoff: str = Query(DEFAULT_CUTOFF)):
    """Error metrics for January 2026 using only the forecast available at the cutoff."""
    _cutoff(cutoff)
    return _accuracy(cutoff)


STATIC = Path(__file__).resolve().parents[1] / "static"
if STATIC.exists():
    app.mount("/", StaticFiles(directory=STATIC, html=True), name="web")
