"""Download January 2026 wind actuals + forecasts from Elexon and save a CSV snapshot.

Usage (from backend/):  python -m scripts.fetch_data
Forecasts are fetched from 29 Dec so early-January targets have their D-1 forecasts.
"""
import json
from datetime import date, datetime, timezone

from app.data import DATA_DIR, FIRST_DAY, LAST_DAY
from app.elexon import fetch_actuals, fetch_forecasts


def main() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    actuals = fetch_actuals(FIRST_DAY, LAST_DAY)
    fc = fetch_forecasts(datetime(2025, 12, 29, tzinfo=timezone.utc),
                         datetime(2026, 2, 1, tzinfo=timezone.utc))
    start = datetime(2026, 1, 1, tzinfo=timezone.utc)
    end = datetime(2026, 2, 1, tzinfo=timezone.utc)
    fc = fc[(fc["startTime"] >= start) & (fc["startTime"] < end)]
    actuals.to_csv(DATA_DIR / "actuals.csv", index=False)
    fc.to_csv(DATA_DIR / "forecasts.csv", index=False)
    (DATA_DIR / "meta.json").write_text(json.dumps({
        "source": "elexon", "fetched_at": datetime.now(timezone.utc).isoformat(),
        "actual_rows": len(actuals), "forecast_rows": len(fc)}))
    print(f"actuals: {len(actuals)} rows, forecasts: {len(fc)} rows -> {DATA_DIR}")


if __name__ == "__main__":
    main()
