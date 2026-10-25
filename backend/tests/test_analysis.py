from datetime import date, time

import pandas as pd

from app import analysis as an


def ts(s):
    return pd.Timestamp(s, tz="UTC")


def make_fc(rows):
    df = pd.DataFrame(rows, columns=["startTime", "publishTime", "generation"])
    for c in ("startTime", "publishTime"):
        df[c] = pd.to_datetime(df[c], utc=True)
    return df


def test_picks_latest_forecast_before_cutoff():
    fc = make_fc([
        ("2026-01-15 12:00", "2026-01-14 06:00", 100.0),
        ("2026-01-15 12:00", "2026-01-14 08:59", 200.0),   # latest allowed
        ("2026-01-15 12:00", "2026-01-14 09:30", 999.0),   # after cutoff: must be ignored
    ])
    out = an.decision_forecasts(fc, date(2026, 1, 15), time(9, 0))
    assert out["generation"].tolist() == [200.0]
    assert out["horizon_h"].iloc[0] > 26


def test_cutoff_is_inclusive_and_day_scoped():
    fc = make_fc([
        ("2026-01-15 12:00", "2026-01-14 09:00", 1.0),      # exactly at cutoff: allowed
        ("2026-01-16 00:00", "2026-01-14 08:00", 2.0),      # next delivery day: excluded
    ])
    out = an.decision_forecasts(fc, date(2026, 1, 15), time(9, 0))
    assert out["generation"].tolist() == [1.0]


def test_no_forecast_before_cutoff_gives_empty():
    fc = make_fc([("2026-01-15 12:00", "2026-01-14 10:00", 5.0)])
    assert an.decision_forecasts(fc, date(2026, 1, 15), time(9, 0)).empty


def test_metrics_and_sign_convention():
    df = pd.DataFrame({"actual": [100.0, 200.0, 300.0], "error": [10.0, -10.0, 30.0]})
    m = an.summarize(df)
    assert m["mae"] == (10 + 10 + 30) / 3
    assert abs(m["bias"] - 10.0) < 1e-9          # forecast - actual, mean
    assert abs(m["rmse"] - ((100 + 100 + 900) / 3) ** 0.5) < 1e-9


def test_horizon_bins_grow_with_lead_time():
    actuals = pd.DataFrame({"startTime": [ts("2026-01-15 12:00")], "generation": [1000.0]})
    fc = make_fc([
        ("2026-01-15 12:00", "2026-01-15 08:00", 1100.0),   # 4h lead, error 100
        ("2026-01-15 12:00", "2026-01-14 08:00", 1500.0),   # 28h lead, error 500
    ])
    rows = {r["lo"]: r for r in an.horizon_table(fc, actuals)}
    assert rows[0]["mae"] == 100 and rows[24]["mae"] == 500
