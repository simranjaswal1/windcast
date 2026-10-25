import { useEffect, useState } from "react";
import { getMeta, getAccuracy } from "./api.js";
import DecisionView from "./DecisionView.jsx";
import AccuracyView from "./AccuracyView.jsx";

const TABS = [["decision", "Decision time", "What to expect for a delivery day"], ["accuracy", "Accuracy", "How wrong forecasts have been"]];

export default function App() {
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState("");
  const [init] = useState(() => Object.fromEntries(new URLSearchParams(window.location.hash.slice(1))));
  const [tab, setTab] = useState(init.tab === "accuracy" ? "accuracy" : "decision");
  const [cutoff, setCutoff] = useState(/^\d\d:\d\d$/.test(init.cutoff ?? "") ? init.cutoff : "09:00");
  const [day, setDay] = useState(init.day || "2026-01-15");
  const [accuracy, setAccuracy] = useState(null);

  useEffect(() => {
    getMeta()
      .then((m) => { setMeta(m); if (!init.cutoff) setCutoff(m.default_cutoff); if (!m.days.includes(day)) setDay("2026-01-15"); })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {  // shareable link: #tab=...&day=...&cutoff=...
    window.history.replaceState(null, "", `#${new URLSearchParams({ tab, day, cutoff })}`);
  }, [tab, day, cutoff]);

  useEffect(() => {
    if (!meta) return;
    setAccuracy(null);
    getAccuracy(cutoff).then(setAccuracy).catch((e) => setError(e.message));
  }, [meta, cutoff]);

  if (error) return <main className="solo"><p className="error">{error}</p></main>;
  if (!meta) return <main className="solo"><p className="muted">Loading data…</p></main>;

  return (
    <div className="app">
      <aside className="side">
        <div>
          <h1 className="brand">Windcast</h1>
          <p className="tag">GB wind forecasts for day-ahead buying · January 2026</p>
        </div>
        <nav aria-label="Sections">
          {TABS.map(([id, label, hint]) => (
            <button key={id} aria-current={tab === id ? "page" : undefined} onClick={() => setTab(id)}>
              <span>{label}</span><small>{hint}</small>
            </button>
          ))}
        </nav>
        <div className="cutoff">
          <label>Decision cutoff
            <input type="time" value={cutoff} onChange={(e) => e.target.value && setCutoff(e.target.value)} />
          </label>
          <p>UK time, the day before delivery. Only forecasts published by then count. The market closes around 09:20–09:50, so 09:00 is a safe choice.</p>
          {cutoff !== meta.default_cutoff && <button className="link" onClick={() => setCutoff(meta.default_cutoff)}>Reset to {meta.default_cutoff}</button>}
        </div>
        <p className="src">Source: Elexon, wind actuals (FUELHH) and forecasts (WINDFOR).</p>
      </aside>
      <main>
        {meta.source === "synthetic" && <p className="banner">Showing synthetic demo data, not Elexon data.</p>}
        {tab === "decision"
          ? <DecisionView meta={meta} cutoff={cutoff} accuracy={accuracy} day={day} setDay={setDay} />
          : <AccuracyView accuracy={accuracy} />}
      </main>
    </div>
  );
}
