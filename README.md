# Windcast: day-ahead wind forecast desk (GB, January 2026)

Web app for a UK energy buyer who must commit to day-ahead purchases on D-1. It shows
(1) the latest national wind forecast available at decision time and (2) how accurate
those forecasts were in January 2026, using Elexon data only (FUELHH actuals, WINDFOR forecasts).

**Live app:** _add your Heroku/Render URL here_


## The core idea
For delivery day D, the forecast used for each half-hour is the **latest WINDFOR forecast
published at or before D-1 09:00 UK time** (configurable in the UI). Later forecasts could not
have informed the purchase, so excluding them keeps accuracy numbers honest.
Gate closure for the day-ahead auction is roughly 09:20 to 09:50, so 09:00 is deliberately conservative; verify against your market's rules.

Error convention: `error = forecast - actual` in MW. Positive means wind was over-forecast (risk of under-buying).
Headline metrics: MAE, RMSE, bias, P50/P90/P99 absolute error. MAPE is avoided because wind output can approach zero.

## Layout
```
backend/
  app/analysis.py     cutoff selection + metrics (pure pandas, unit tested)
  app/elexon.py       Elexon Insights API client (chunked, retrying)
  app/data.py         loads the CSV snapshot
  app/main.py         FastAPI: /api/meta, /api/decision, /api/accuracy, serves frontend
  scripts/fetch_data.py       download real Jan 2026 data -> backend/data/*.csv
  scripts/make_synthetic.py   SYNTHETIC offline data for development only
  tests/              pytest
  data/               CSV snapshot (commit the real one so deploys are self-contained)
frontend/             React + Vite + Recharts (DecisionView, AccuracyView)
Dockerfile            multi-stage: builds frontend, serves everything from one Python container
render.yaml            Render deploy config (free web service)
.github/workflows/    fetch-data.yml: one-click real-data download
```

## Run it
1. Get data (real Elexon data; needs internet):
   ```
   cd backend && pip install -r requirements.txt && python -m scripts.fetch_data
   ```
   Offline alternative: `python -m scripts.make_synthetic` (UI shows a "synthetic" banner).
2. Docker (recommended): `docker build -t windcast . && docker run -p 8000:8000 windcast` then open http://localhost:8000
3. Dev without Docker: `cd backend && uvicorn app.main:app --reload` and, in another shell, `cd frontend && npm install && npm run dev`
4. Tests: `cd backend && python -m pytest`

## Deploy (Render, free)
1. Run the GitHub Action **Fetch Elexon data** (Actions tab) once; it commits `backend/data/*.csv`.
2. On render.com: New -> Blueprint (or Web Service -> Docker), select this repo, free instance. Render reads `render.yaml`.
3. Free instances sleep after 15 minutes idle; the first request takes about a minute.

## Known limits
- Live Elexon endpoints were not reachable from the environment this was generated in, so
  `elexon.py` parameter names (`settlementDateFrom/To`, `publishDateTimeFrom/To`, `fuelType`) follow the public API docs but have not been run against the live API. Run `fetch_data` once and check row counts.
- National wind only; no demand data, so the "buy beyond wind" figure is illustrative from a user-entered demand.
