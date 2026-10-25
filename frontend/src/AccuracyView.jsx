import { BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { mw, num, dayLabel } from "./format.js";

function Chart({ title, note, children }) {
  return (
    <figure>
      <figcaption><strong>{title}</strong><span className="muted"> {note}</span></figcaption>
      <div className="chart"><ResponsiveContainer>{children}</ResponsiveContainer></div>
    </figure>
  );
}

const k = (v) => `${(v / 1000).toFixed(1)}k`;

export default function AccuracyView({ accuracy }) {
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

      <dl className="facts">
        <div><dt>Average miss (MAE)</dt><dd>{mw(s.mae)}{s.nmae_pct != null && ` · ${s.nmae_pct.toFixed(0)}% of mean wind`}</dd></div>
        <div><dt>Typical large miss (RMSE)</dt><dd>{mw(s.rmse)}</dd></div>
        <div><dt>Median miss</dt><dd>{mw(s.p50_abs)}</dd></div>
        <div><dt>Worst 1% of half-hours</dt><dd>{mw(s.p99_abs)} or more</dd></div>
        <div><dt>90% range of error</dt><dd>{mw(s.p05_err)} to {mw(s.p95_err)}</dd></div>
      </dl>
      <p className="muted small">Error = forecast minus actual. Positive means the forecast was too high.</p>

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
    </>
  );
}
