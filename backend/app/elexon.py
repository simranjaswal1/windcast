"""Thin client for the Elexon Insights (BMRS) stream endpoints. No API key needed."""
from __future__ import annotations

import time
from datetime import date, datetime, timedelta, timezone

import httpx
import pandas as pd

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"


def _get(client: httpx.Client, path: str, params: dict) -> list[dict]:
    for attempt in range(4):
        try:
            r = client.get(f"{BASE}/{path}", params=params, timeout=90)
            r.raise_for_status()
            body = r.json()
            return body["data"] if isinstance(body, dict) else body
        except (httpx.HTTPError, ValueError):
            if attempt == 3:
                raise
            time.sleep(2 ** attempt)
    return []


def _iso(d: datetime) -> str:
    return d.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%MZ")


def fetch_actuals(first: date, last: date, chunk_days: int = 7) -> pd.DataFrame:
    """FUELHH half-hourly outturn, WIND only, settlement dates first..last inclusive."""
    rows: list[dict] = []
    with httpx.Client() as c:
        d = first
        while d <= last:
            end = min(d + timedelta(days=chunk_days - 1), last)
            rows += _get(c, "FUELHH/stream", {
                "settlementDateFrom": d.isoformat(),
                "settlementDateTo": end.isoformat(),
                "fuelType": ["WIND"],
            })
            d = end + timedelta(days=1)
    df = pd.DataFrame(rows)
    df = df[df["fuelType"] == "WIND"]
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    return (df[["startTime", "generation"]].dropna()
            .drop_duplicates("startTime", keep="last").sort_values("startTime"))


def fetch_forecasts(pub_from: datetime, pub_to: datetime, chunk_days: int = 2) -> pd.DataFrame:
    """WINDFOR forecasts published between pub_from and pub_to (tz-aware datetimes)."""
    rows: list[dict] = []
    with httpx.Client() as c:
        t = pub_from
        while t < pub_to:
            end = min(t + timedelta(days=chunk_days), pub_to)
            rows += _get(c, "WINDFOR/stream", {
                "publishDateTimeFrom": _iso(t),
                "publishDateTimeTo": _iso(end),
            })
            t = end
    df = pd.DataFrame(rows)
    for col in ("startTime", "publishTime"):
        df[col] = pd.to_datetime(df[col], utc=True)
    return (df[["startTime", "publishTime", "generation"]].dropna()
            .drop_duplicates(["startTime", "publishTime"], keep="last")
            .sort_values(["startTime", "publishTime"]))
