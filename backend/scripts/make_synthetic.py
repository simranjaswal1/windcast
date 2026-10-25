"""Generate SYNTHETIC wind data for offline development and tests. Not real Elexon data."""
import json
from datetime import datetime, timedelta, timezone

import numpy as np
import pandas as pd

from app.data import DATA_DIR


def main(seed: int = 7) -> None:
    rng = np.random.default_rng(seed)
    t0 = datetime(2026, 1, 1, tzinfo=timezone.utc)
    targets = [t0 + timedelta(minutes=30 * i) for i in range(48 * 31)]
    x = np.zeros(len(targets))
    for i in range(1, len(x)):
        x[i] = 0.995 * x[i - 1] + rng.normal(0, 0.12)
    actual = np.clip(7000 + 3500 * x, 200, 15500)

    rows = []
    for i, t in enumerate(targets):
        for h in range(2, 50, 2):  # forecasts issued every 2h, up to 48h ahead
            pub = t - timedelta(hours=h)
            sd = 250 + 70 * h
            rows.append((t, pub, max(0.0, actual[i] + rng.normal(0, sd))))
    fc = pd.DataFrame(rows, columns=["startTime", "publishTime", "generation"])
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    pd.DataFrame({"startTime": targets, "generation": actual}).to_csv(DATA_DIR / "actuals.csv", index=False)
    fc.to_csv(DATA_DIR / "forecasts.csv", index=False)
    (DATA_DIR / "meta.json").write_text(json.dumps({"source": "synthetic"}))
    print(f"synthetic data written to {DATA_DIR}")


if __name__ == "__main__":
    main()
