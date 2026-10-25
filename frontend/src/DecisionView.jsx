import { useEffect, useMemo, useState } from "react";
import { ComposedChart, Line, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend } from "recharts";
import { getDecision } from "./api.js";
import { mw, clock, stamp, longDay } from "./format.js";

const MONTHS = ["Jan", "Feb"];

function DayStrip({ days, day, setDay, byDay }) {
  const mae = Object.fromEntries((byDay ?? []).map((r) => [r.day, r.mae]));
  const max = Math.max(1, ...Object.values(mae));
  const i = days.indexOf(day);
  return (
    <div className="strip">
      <div className="strip-nav">
        <button disabled={i <= 0} onClick={() => setDay(days[i - 1])}>← Previous day</button>
        <button disabled={i >= days.length - 1} onClick={() => setDay(days[i + 1])}>Next day →</button>
        <span className="muted small">Darker day = the forecast was further off that day.</span>
      </div>
      <div className="days" role="group" aria-label="Pick a delivery day">
        {days.map((d) => (
          <button key={d} aria-pressed={d === day} onClick={() => setDay(d)}
            title={`${longDay(d)}${mae[d] != null ? ` · average miss ${mw(mae[d])}` : ""}`}
            style={mae[d] != null ? { background: `color-mix(in srgb, var(--warn) ${Math.round(15 + 70 * mae[d] / max)}%, transparent)` } : undefined}>
            {Number(d.slice(8))}{(d === days[0] || d.endsWith("-01")) && <small className="mon">{MONTHS[Number(d.slice(5, 7)) - 1]}</small>}
          </button>
        ))}
      </div>
    </div>
  );
}

function downloadCsv(data, day, cutoff) {
  const head = "startTime_utc,publishTime_utc,lead_h,forecast_mw,actual_mw,error_mw";
  const lines = data.points.map((p) => [p.startTime, p.publishTime, p.horizon_h?.toFixed(2) ?? "", p.forecast,
    p.actual ?? "", p.actual != null ? p.forecast - p.actual : ""].join(","));
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([[head, ...lines].join("\n")], { type: "text/csv" }));
  a.download = `windcast_${day}_cutoff${cutoff.replace(":", "")}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

export default function DecisionView({ meta, cutoff, accuracy, day, setDay }) {
  const [demand, setDemand] = useState("");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;  // ignore answers that arrive after a newer request
    setError("");
    getDecision(day, cutoff).then((d) => live && setData(d)).catch((e) => { if (live) { setError(e.message); setData(null); } });
    return () => { live = false; };
  }, [day, cutoff]);

  const p90 = accuracy?.summary?.p90_abs;
  const over95 = Math.max(0, accuracy?.summary?.p95_err ?? 0);  // wind falling short of forecast: the risk when buying
  const demandMw = demand ? Number(demand) : null;
  const rows = useMemo(() => (data?.points ?? []).map((p) => ({
    t: p.startTime, forecast: p.forecast, actual: p.actual, demand: demandMw,
    band: p90 != null ? [Math.max(0, p.forecast - p90), p.forecast + p90] : null,
  })), [data, p90, demandMw]);

  const s = data?.summary;
  const toBuy = demandMw != null && s ? Math.max(0, demandMw - s.mean_forecast) : null;

  return (
    <>
      <section className="card"><h2 className="h">1 · Pick a delivery day</h2><DayStrip days={meta.days} day={day} setDay={setDay} byDay={accuracy?.by_day} /></section>
      <section className="card rail"><h2 className="h" style={{width:"100%"}}>2 · Optional: compare with your demand</h2>
        <label>
          Your expected demand (MW, optional)
          <input type="number" min="0" placeholder="e.g. 18000" value={demand} onChange={(e) => setDemand(e.target.value)} />
        </label>
        {data && <button className="tool" onClick={() => downloadCsv(data, day, cutoff)}>Download this day as CSV</button>}
      </section>

      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Loading…</p>}
      {data && (
        <>
          <h2 className="lede">
            For {longDay(day)}, the latest wind forecast you could have used was published {stamp(s.latest_publish)}.
          </h2>
          {p90 != null && <p className="callout">Plan for each half-hour to land within <b>±{mw(p90)}</b> of this forecast, 9 times out of 10 (based on how far January forecasts were off).</p>}

          <div className="card"><h2 className="h">3 · Forecast vs what actually happened</h2><div className="chart tall">
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
                {demandMw != null && <Line dataKey="demand" name="Your demand" stroke="var(--err)" strokeWidth={1.5} dot={false} />}
              </ComposedChart>
            </ResponsiveContainer>
          </div></div>

          <dl className="tiles">
            <div><dt>Forecast lead time</dt><dd>{accuracy?.decision_horizon_h ? `${Math.round(accuracy.decision_horizon_h.min)}–${Math.round(accuracy.decision_horizon_h.max)} h ahead` : "–"}</dd></div>
            <div><dt>Average wind</dt><dd>{mw(s.mean_forecast)}</dd></div><div><dt>Peak</dt><dd>{mw(s.peak_forecast)}</dd></div><div><dt>Lowest</dt><dd>{mw(s.min_forecast)}</dd></div>
            <div><dt>This day's average miss</dt><dd>{mw(s.day_metrics.mae)}</dd></div>
            {toBuy != null && <div><dt>Buy beyond wind (average)</dt><dd>{mw(toBuy)}</dd></div>}
            {toBuy != null && accuracy && <div><dt>Suggested cover (19 in 20)</dt><dd>{mw(toBuy + over95)}</dd></div>}
          </dl>
          {toBuy != null && <p className="muted small">Illustrative only: demand is your own input. Cover adds the January 95th-percentile over-forecast ({mw(over95)}) to the average gap. Elexon wind is the only data used.</p>}
        </>
      )}
    </>
  );
}
