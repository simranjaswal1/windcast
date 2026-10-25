import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { getDecision } from "./api.js";
import { mw, clock, stamp, longDay } from "./format.js";

export default function DecisionView({ meta, cutoff, accuracy }) {
  const [day, setDay] = useState("2026-01-15");
  const [demand, setDemand] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    getDecision(day, cutoff).then(setData).catch((e) => setError(e.message));
  }, [day, cutoff]);

  const p90 = accuracy?.summary?.p90_abs;
  const rows = useMemo(() => (data?.points ?? []).map((p) => ({
    t: p.startTime,
    forecast: p.forecast,
    actual: p.actual,
    band: p90 != null ? [Math.max(0, p.forecast - p90), p.forecast + p90] : null,
  })), [data, p90]);

  const s = data?.summary;
  const demandMw = Number(demand);
  const toBuy = demand && s ? Math.max(0, demandMw - s.mean_forecast) : null;

  return (
    <>
      <section className="rail">
        <label>
          Delivery day
          <select value={day} onChange={(e) => setDay(e.target.value)}>
            {meta.days.map((d) => <option key={d} value={d}>{longDay(d)}</option>)}
          </select>
        </label>
        <label>
          Your expected demand (MW, optional)
          <input type="number" min="0" placeholder="e.g. 18000" value={demand} onChange={(e) => setDemand(e.target.value)} />
        </label>
      </section>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <h2 className="lede">
            For {longDay(day)}, the latest wind forecast you could have used was published {stamp(s.latest_publish)}.
          </h2>
          <p className="muted">
            Wind averages {mw(s.mean_forecast)} across the day, peaking at {mw(s.peak_forecast)} and dipping to {mw(s.min_forecast)}.
            {p90 != null && ` Treat each half-hour as accurate to about ±${mw(p90)} (9 in 10 January half-hours).`}
          </p>

          <div className="chart tall">
            <ResponsiveContainer>
              <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--grid)" vertical={false} />
                <XAxis dataKey="t" tickFormatter={clock} minTickGap={32} />
                <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} width={44} />
                <Tooltip labelFormatter={stamp} formatter={(v) => (Array.isArray(v) ? `${mw(v[0])} to ${mw(v[1])}` : mw(v))} />
                <Legend />
                {p90 != null && <Area dataKey="band" name={`Forecast ± ${Math.round(p90).toLocaleString("en-GB")} MW`} stroke="none" fill="var(--band)" />}
                <Line dataKey="forecast" name="Forecast at cutoff" stroke="var(--forecast)" strokeWidth={2.5} dot={false} />
                <Line dataKey="actual" name="Actual outturn" stroke="var(--ink)" strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <dl className="facts">
            <div><dt>Forecast lead time</dt><dd>{accuracy?.decision_horizon_h ? `${Math.round(accuracy.decision_horizon_h.min)}–${Math.round(accuracy.decision_horizon_h.max)} h ahead` : "–"}</dd></div>
            <div><dt>Forecast published</dt><dd>{clock(s.earliest_publish)}–{clock(s.latest_publish)} (UK)</dd></div>
            <div><dt>This day's average miss</dt><dd>{mw(s.day_metrics.mae)}</dd></div>
            {toBuy != null && <div><dt>Buy beyond wind (average)</dt><dd>{mw(toBuy)}{p90 != null && ` (up to ${mw(toBuy + p90)} if wind under-delivers)`}</dd></div>}
          </dl>
          {toBuy != null && <p className="muted small">Illustrative only: demand is your own input, and Elexon wind is the only data used here.</p>}
        </>
      )}
    </>
  );
}
