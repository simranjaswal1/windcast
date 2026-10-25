"""Core logic: decision-time forecast selection and error metrics.

Sign convention: error = forecast - actual (MW).
Positive error = wind over-forecast, so a buyer relying on it under-buys.
"""
from __future__ import annotations

from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

import numpy as np
import pandas as pd

LONDON = ZoneInfo("Europe/London")


def parse_cutoff(value: str) -> time:
    hh, mm = value.split(":")
    return time(int(hh), int(mm))


def cutoff_utc(day: date, cutoff: time) -> pd.Timestamp:
    """Decision deadline for delivery `day`: D-1 at `cutoff` UK local time."""
    local = datetime.combine(day - timedelta(days=1), cutoff, tzinfo=LONDON)
    return pd.Timestamp(local).tz_convert("UTC")


def day_bounds_utc(day: date) -> tuple[pd.Timestamp, pd.Timestamp]:
    start = datetime.combine(day, time(0), tzinfo=LONDON)
    end = datetime.combine(day + timedelta(days=1), time(0), tzinfo=LONDON)
    return pd.Timestamp(start).tz_convert("UTC"), pd.Timestamp(end).tz_convert("UTC")


def decision_forecasts(fc: pd.DataFrame, day: date, cutoff: time) -> pd.DataFrame:
    """For each half-hour of `day`, the latest forecast published at or before the cutoff.

    `fc` needs columns startTime, publishTime (UTC) and generation, with a unique index.
    """
    start, end = day_bounds_utc(day)
    cut = cutoff_utc(day, cutoff)
    sub = fc[(fc["startTime"] >= start) & (fc["startTime"] < end) & (fc["publishTime"] <= cut)]
    if sub.empty:
        return sub.assign(horizon_h=pd.Series(dtype=float))
    idx = sub.groupby("startTime")["publishTime"].idxmax()
    out = sub.loc[idx].sort_values("startTime").copy()
    out["horizon_h"] = (out["startTime"] - out["publishTime"]).dt.total_seconds() / 3600
    return out


def decisions_for_days(fc: pd.DataFrame, days: list[date], cutoff: time) -> pd.DataFrame:
    parts = [decision_forecasts(fc, d, cutoff) for d in days]
    parts = [p for p in parts if not p.empty]
    if not parts:
        return fc.iloc[0:0].assign(horizon_h=pd.Series(dtype=float))
    return pd.concat(parts, ignore_index=True)


def join_actuals(fc: pd.DataFrame, actuals: pd.DataFrame) -> pd.DataFrame:
    """Inner-join forecasts to actuals on startTime and add `error` = forecast - actual."""
    a = actuals[["startTime", "generation"]].rename(columns={"generation": "actual"})
    f = fc.rename(columns={"generation": "forecast"})
    out = f.merge(a, on="startTime", how="inner")
    out["error"] = out["forecast"] - out["actual"]
    return out


def summarize(df: pd.DataFrame) -> dict:
    n = int(df["error"].notna().sum()) if len(df) else 0
    if n == 0:
        return {"n": 0}
    err, ae = df["error"], df["error"].abs()
    mean_actual = float(df["actual"].mean())
    mae = float(ae.mean())
    return {
        "n": n,
        "mae": mae,
        "rmse": float(np.sqrt((err**2).mean())),
        "bias": float(err.mean()),
        "p50_abs": float(ae.quantile(0.5)),
        "p90_abs": float(ae.quantile(0.9)),
        "p99_abs": float(ae.quantile(0.99)),
        "p05_err": float(err.quantile(0.05)),
        "p95_err": float(err.quantile(0.95)),
        "mean_actual": mean_actual,
        "nmae_pct": mae / mean_actual * 100 if mean_actual > 0 else None,
    }


def grouped(df: pd.DataFrame, key: str) -> list[dict]:
    rows = []
    for k, g in df.groupby(key):
        rows.append({
            key: k.item() if hasattr(k, "item") else k,
            "n": int(len(g)),
            "mae": float(g["error"].abs().mean()),
            "rmse": float(np.sqrt((g["error"] ** 2).mean())),
            "bias": float(g["error"].mean()),
        })
    return rows


def add_local_fields(df: pd.DataFrame) -> pd.DataFrame:
    local = df["startTime"].dt.tz_convert(LONDON)
    out = df.copy()
    out["day"] = local.dt.strftime("%Y-%m-%d")
    out["hour"] = local.dt.hour
    return out


def horizon_table(fc_all: pd.DataFrame, actuals: pd.DataFrame, width_h: int = 6) -> list[dict]:
    """Accuracy of *all* forecasts by lead time (startTime - publishTime), in `width_h` bins."""
    df = join_actuals(fc_all, actuals)
    df["horizon_h"] = (df["startTime"] - df["publishTime"]).dt.total_seconds() / 3600
    df = df[df["horizon_h"] >= 0].copy()
    df["lo"] = (df["horizon_h"] // width_h * width_h).astype(int)
    rows = grouped(df, "lo")
    for r in rows:
        r["hi"] = r["lo"] + width_h
    return rows
