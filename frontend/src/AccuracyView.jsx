import { useEffect, useState } from "react";
import { getSensitivity } from "./api.js";
import ErrorTable from "./ErrorTable.jsx";
import { BarChart, Bar, Cell, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { mw, num, dayLabel } from "./format.js";

function Chart({ title, note, children }) {
  return (
    <figure className="card">
      <figcaption><strong>{title}</strong><span className="muted"> {note}</span></figcaption>
      <div className="chart"><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </figure>
  );
}

const k = (v) => `${(v / 1000).toFixed(1)}k`;

export default function AccuracyView({ accuracy, onOpenDay }) {
  const [sens, setSens] = useState(null);
  useEffect(() => { getSensitivity().then(setSens).catch(() => setSens([])); }, []);
  if (!accuracy) return <p className="muted">Calculating…</p>;
  const { summary: s, by_day, by_hour, by_horizon } = accuracy;
  const direction = s.bias > 0 ? "over-forecast" : "under-forecast";
  const horizon = by_horizon.map((r) => ({ ...r, label: `${r.lo}–${r.hi} h` }));

  return (
    <>
      <h2 className="lede">Plan for wind to land within ±{mw(s.p90_abs)} of the forecast, 9 times in 10.</h2>
      <p className="muted">
        Across {num(s.n)} January half-hours, using the forecast available at {accuracy.cutoff} the day before.
        On average wind was {direction} by {mw(Math.abs(s.bias))}
        {s.bias > 0 ? ", so relying on it alone would have left you slightly short." : ", so you would have bought a little more than needed."}
      </p>

      <dl className="tiles">
        <div><dt>Average miss (MAE)</dt><dd>{mw(s.mae)}{s.nmae_pct != null && ` · ${s.nmae_pct.toFixed(0)}% of mean wind`}</dd></div>
        <div><dt>Typical large miss (RMSE)</dt><dd>{mw(s.rmse)}</dd></div>
        <div><dt>Median miss</dt><dd>{mw(s.p50_abs)}</dd></div>
        <div><dt>Worst 1% of half-hours</dt><dd>{mw(s.p99_abs)} or more</dd></div>
        <div><dt>90% range of error</dt><dd>{mw(s.p05_err)} to {mw(s.p95_err)}</dd></div>
      </dl>
      <p className="muted small">Error = forecast minus actual. Positive means the forecast was too high.</p>

      <h2 className="h" style={{marginTop:28}}>The detail</h2>
      <Chart title="Error grows with lead time" note="All forecasts for January targets, grouped by hours between publication and delivery.">
        <BarChart data={horizon}><CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="label" /><YAxis tickFormatter={k} width={44} />
          <Tooltip formatter={(v) => mw(v)} /><Legend />
          <Bar dataKey="mae" name="Average miss" fill="var(--forecast)" />
          <Bar dataKey="rmse" name="RMSE" fill="var(--band-strong)" />
        </BarChart>
      </Chart>

      <Chart title="By time of day" note="Average miss for each UK hour of the delivery day.">
        <BarChart data={by_hour}><CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="hour" tickFormatter={(h) => `${String(h).padStart(2, "0")}:00`} minTickGap={16} />
          <YAxis tickFormatter={k} width={44} />
          <Tooltip formatter={(v) => mw(v)} labelFormatter={(h) => `${String(h).padStart(2, "0")}:00`} />
          <Bar dataKey="mae" name="Average miss" fill="var(--forecast)" />
        </BarChart>
      </Chart>

      <Chart title="Day by day" note="Average miss and average bias (above zero = over-forecast).">
        <LineChart data={by_day}><CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="day" tickFormatter={(d) => dayLabel(`${d}T12:00:00Z`)} minTickGap={24} />
          <YAxis tickFormatter={k} width={44} />
          <Tooltip formatter={(v) => mw(v)} labelFormatter={(d) => dayLabel(`${d}T12:00:00Z`)} /><Legend />
          <ReferenceLine y={0} stroke="var(--ink)" />
          <Line dataKey="mae" name="Average miss" stroke="var(--forecast)" strokeWidth={2} dot={false} />
          <Line dataKey="bias" name="Bias" stroke="var(--warn)" strokeWidth={2} dot={false} />
        </LineChart>
      </Chart>

      <Chart title="How wrong, and in which direction" note="Number of January half-hours in each error band. Orange = over-forecast (you would be short).">
        <BarChart data={accuracy.error_hist}><CartesianGrid stroke="var(--grid)" vertical={false} />
          <XAxis dataKey="lo" tickFormatter={k} /><YAxis width={44} />
          <Tooltip formatter={(v) => `${num(v)} half-hours`} labelFormatter={(lo) => `${mw(lo)} to ${mw(lo + 1000)}`} />
          <ReferenceLine x={0} stroke="var(--ink)" />
          <Bar dataKey="count" name="Half-hours">{accuracy.error_hist.map((b) => <Cell key={b.lo} fill={b.lo >= 0 ? "var(--warn)" : "var(--forecast)"} />)}</Bar>
        </BarChart>
      </Chart>

      <ErrorTable cutoff={accuracy.cutoff} onOpenDay={onOpenDay} />

      <details className="card gloss"><summary>What do these terms mean?</summary>
        <p><b>Average miss (MAE):</b> how many MW the forecast was off by, on average.</p>
        <p><b>Typical large miss (RMSE):</b> like the average miss, but big misses count extra.</p>
        <p><b>9 in 10 (P90):</b> in 90% of half-hours the miss was no bigger than this.</p>
        <p><b>Bias:</b> positive means wind was usually forecast too high, so you would under-buy.</p>
        <p><b>Cutoff:</b> the time on the day before delivery when you must commit to buying.</p>
      </details>

      {sens && sens.length > 0 && (
        <Chart title="What if you decide earlier?" note="January accuracy using only forecasts published by each cutoff time on the day before.">
          <LineChart data={sens}><CartesianGrid stroke="var(--grid)" vertical={false} />
            <XAxis dataKey="cutoff" /><YAxis tickFormatter={k} width={44} />
            <Tooltip formatter={(v) => mw(v)} labelFormatter={(c) => `Cutoff ${c} UK time`} /><Legend />
            <Line dataKey="p90_abs" name="9-in-10 miss (P90)" stroke="var(--warn)" strokeWidth={2} />
            <Line dataKey="mae" name="Average miss" stroke="var(--forecast)" strokeWidth={2} />
          </LineChart>
        </Chart>
      )}
    </>
  );
}
