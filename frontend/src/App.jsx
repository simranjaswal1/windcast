import { useEffect, useState } from "react";
import { getMeta, getDecision, getAccuracy } from "./api.js";
import DecisionView from "./DecisionView.jsx";
import AccuracyView from "./AccuracyView.jsx";

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

  if (error) return <main className="shell"><p className="error">{error}</p></main>;
  if (!meta) return <main className="shell"><p className="muted">Loading data…</p></main>;

  return (
    <main className="shell">
      <header className="top">
        <h1>Windcast</h1>
        <p className="muted">GB wind forecasts for the day-ahead buying decision · January 2026</p>
        <nav role="tablist">
          {[["decision", "Forecast at decision time"], ["accuracy", "How accurate is it?"]].map(([id, label]) => (
            <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)}>{label}</button>
          ))}
        </nav>
      </header>

      {meta.source === "synthetic" && (
        <p className="banner">Showing synthetic demo data, not Elexon data. Run the fetch script to load real figures.</p>
      )}

      <section className="rail">
        <label>
          Decision cutoff (UK time, day before delivery)
          <input type="time" value={cutoff} onChange={(e) => e.target.value && setCutoff(e.target.value)} />
        </label>
        <p className="muted small">
          Only forecasts published at or before this time count. Day-ahead gate closes about 09:20–09:50, so 09:00 is a safe default.
        </p>
      </section>

      {tab === "decision"
        ? <DecisionView meta={meta} cutoff={cutoff} accuracy={accuracy} day={day} setDay={setDay} />
        : <AccuracyView accuracy={accuracy} />}
    </main>
  );
}
