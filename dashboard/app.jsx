const { useEffect, useMemo, useState } = React;

const API_BASE = window.SAIL_API_BASE || "http://localhost:8000";
const METRICS_URL = `${API_BASE}/api/metrics`;
const PREDICTIONS_URL = `${API_BASE}/api/predictions?limit=10000`;
const STATIC_METRICS_URL = "../models/satellite_coordination_pressure_metrics.json";
const STATIC_PREDICTIONS_URL = "../models/satellite_coordination_pressure_predictions.csv";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", ""]);
const FORCE_STATIC =
  new URLSearchParams(window.location.search).get("mode") === "static" ||
  !LOCAL_HOSTS.has(window.location.hostname);

const TIER_COLORS = {
  high: "#fb7185",
  medium: "#fbbf24",
  low: "#10b981",
};

const ORBIT_ORDER = ["LEO", "MEO", "GEO", "Elliptical"];

function Icon({ name, className = "h-4 w-4" }) {
  return <i data-lucide={name} className={className} aria-hidden="true"></i>;
}

function formatNumber(value, digits = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "0";
  return numeric.toLocaleString(undefined, {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function normalizeRow(row) {
  return {
    name: row.name || row["Official Name of Satellite"] || "Unknown satellite",
    norad: row.norad || row["NORAD Number"] || "",
    operator: row.operator || row["Operator/Owner"] || "Unknown operator",
    purpose: row.purpose || row.Purpose || "Unknown purpose",
    orbit: (row.orbit || row["Class of Orbit"] || "Unknown").trim(),
    altitude: Number(row.altitude ?? row.mean_altitude_km),
    score: Number(row.score ?? row.coordination_pressure_score),
    tier: row.tier || row.predicted_coordination_pressure_tier || row.coordination_pressure_tier || "unknown",
  };
}

function countBy(rows, key) {
  return rows.reduce((acc, row) => {
    const value = row[key] || "Unknown";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function topEntries(counts, limit = 7) {
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function percentile(values, p) {
  const filtered = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!filtered.length) return 0;
  const index = Math.min(filtered.length - 1, Math.floor((p / 100) * filtered.length));
  return filtered[index];
}

async function loadFromApi() {
  const [metricsResponse, predictionsResponse] = await Promise.all([
    fetch(METRICS_URL),
    fetch(PREDICTIONS_URL),
  ]);

  if (!metricsResponse.ok || !predictionsResponse.ok) {
    throw new Error("Could not load model dashboard data from FastAPI.");
  }

  const metrics = await metricsResponse.json();
  const predictions = await predictionsResponse.json();
  return {
    metrics: { ...metrics, data_source: "FastAPI" },
    rows: predictions.items.map(normalizeRow).filter((row) => row.name),
  };
}

async function loadFromStaticArtifacts() {
  const [metricsResponse, csvResponse] = await Promise.all([
    fetch(STATIC_METRICS_URL),
    fetch(STATIC_PREDICTIONS_URL),
  ]);

  if (!metricsResponse.ok || !csvResponse.ok) {
    throw new Error("Could not load static model artifacts.");
  }

  const metrics = await metricsResponse.json();
  const csvText = await csvResponse.text();
  const parsed = Papa.parse(csvText, { header: true, skipEmptyLines: true });
  return {
    metrics: { ...metrics, data_source: "Static Pages" },
    rows: parsed.data.map(normalizeRow).filter((row) => row.name),
  };
}

function App() {
  const [rows, setRows] = useState([]);
  const [metrics, setMetrics] = useState(null);
  const [status, setStatus] = useState("loading");
  const [tierFilter, setTierFilter] = useState("all");
  const [orbitFilter, setOrbitFilter] = useState("all");
  const [purposeFilter, setPurposeFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = FORCE_STATIC
          ? await loadFromStaticArtifacts()
          : await loadFromApi().catch(() => loadFromStaticArtifacts());
        setMetrics(data.metrics);
        setRows(data.rows);
        setStatus("ready");
      } catch (error) {
        console.error(error);
        setStatus("error");
      }
    }

    load();
  }, []);

  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  const purposes = useMemo(() => {
    return topEntries(countBy(rows, "purpose"), 12).map((entry) => entry.label);
  }, [rows]);

  const orbits = useMemo(() => {
    const available = Object.keys(countBy(rows, "orbit"));
    return [
      ...ORBIT_ORDER.filter((orbit) => available.includes(orbit)),
      ...available.filter((orbit) => !ORBIT_ORDER.includes(orbit)).sort(),
    ];
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTier = tierFilter === "all" || row.tier === tierFilter;
      const matchesOrbit = orbitFilter === "all" || row.orbit === orbitFilter;
      const matchesPurpose = purposeFilter === "all" || row.purpose === purposeFilter;
      const matchesSearch =
        !query ||
        row.name.toLowerCase().includes(query) ||
        row.operator.toLowerCase().includes(query) ||
        String(row.norad).toLowerCase().includes(query);
      return matchesTier && matchesOrbit && matchesPurpose && matchesSearch;
    });
  }, [rows, tierFilter, orbitFilter, purposeFilter, search]);

  const modelStats = useMemo(() => {
    const tierCounts = countBy(filteredRows, "tier");
    const allTierCounts = countBy(rows, "tier");
    const highRows = filteredRows.filter((row) => row.tier === "high");
    const avgScore =
      filteredRows.reduce((total, row) => total + (Number.isFinite(row.score) ? row.score : 0), 0) /
      Math.max(filteredRows.length, 1);

    return {
      tierCounts,
      allTierCounts,
      highRows,
      avgScore,
      p90: percentile(filteredRows.map((row) => row.score), 90),
      topHigh: [...highRows].sort((a, b) => b.score - a.score).slice(0, 8),
      topOperators: topEntries(countBy(filteredRows, "operator"), 7),
      topPurposes: topEntries(countBy(filteredRows, "purpose"), 7),
      orbitCounts: topEntries(countBy(filteredRows, "orbit"), 8),
    };
  }, [filteredRows, rows]);

  if (status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="panel px-6 py-5 text-sm text-muted">Loading model results...</div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center px-6">
        <div className="panel max-w-xl px-6 py-5">
          <p className="text-lg font-semibold text-bone">Dashboard data unavailable</p>
          <p className="mt-2 text-sm text-muted">
            Run <code>uvicorn api.main:app --reload --port 8000</code> for API mode, or make
            sure the static model artifacts are published beside the dashboard.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1440px] px-4 py-5 sm:px-6 lg:px-8">
      <Header metrics={metrics} rows={rows} />
      <Filters
        tierFilter={tierFilter}
        setTierFilter={setTierFilter}
        orbitFilter={orbitFilter}
        setOrbitFilter={setOrbitFilter}
        purposeFilter={purposeFilter}
        setPurposeFilter={setPurposeFilter}
        search={search}
        setSearch={setSearch}
        purposes={purposes}
        orbits={orbits}
        onReset={() => {
          setTierFilter("all");
          setOrbitFilter("all");
          setPurposeFilter("all");
          setSearch("");
        }}
      />
      <KpiGrid
        rows={rows}
        filteredRows={filteredRows}
        metrics={metrics}
        stats={modelStats}
      />
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <TierDistribution counts={modelStats.tierCounts} total={filteredRows.length} />
        <OrbitMix counts={modelStats.orbitCounts} total={filteredRows.length} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <AltitudeScatter rows={filteredRows} />
        <TopOperators entries={modelStats.topOperators} total={filteredRows.length} />
      </section>
      <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <PurposeBars entries={modelStats.topPurposes} total={filteredRows.length} />
        <SatelliteTable rows={modelStats.topHigh} />
      </section>
    </main>
  );
}

function Header({ metrics, rows }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="max-w-4xl text-3xl font-extrabold leading-tight text-bone sm:text-4xl">
          Coordination pressure across orbital infrastructure
        </h1>
      </div>
      <div className="panel min-w-[280px] px-4 py-3">
        <div className="text-xs uppercase text-muted">Trained model</div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-bone">{metrics.selected_model}</div>
          <div className="rounded-[8px] bg-bottega px-2.5 py-1 text-sm font-bold text-white">
            {formatNumber(metrics.holdout_f1_weighted * 100, 1)} F1
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>{formatNumber(rows.length)} satellites</span>
          <span className="text-right">{metrics.data_source || `API v${metrics.api_version}`}</span>
        </div>
      </div>
    </header>
  );
}

function Filters(props) {
  return (
    <section className="panel mt-4 grid gap-3 p-3 lg:grid-cols-[1.4fr_0.7fr_0.7fr_1fr_auto]">
      <label className="relative block">
        <span className="sr-only">Search satellites</span>
        <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          value={props.search}
          onChange={(event) => props.setSearch(event.target.value)}
          placeholder="Search satellite, operator, NORAD"
          className="h-11 w-full rounded-[8px] border border-line bg-black/60 pl-9 pr-3 text-sm text-bone outline-none transition focus:border-bottegaBright"
        />
      </label>
      <Select value={props.tierFilter} onChange={props.setTierFilter} label="Tier">
        <option value="all">All tiers</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </Select>
      <Select value={props.orbitFilter} onChange={props.setOrbitFilter} label="Orbit">
        <option value="all">All orbits</option>
        {props.orbits.map((orbit) => (
          <option key={orbit} value={orbit}>
            {orbit}
          </option>
        ))}
      </Select>
      <Select value={props.purposeFilter} onChange={props.setPurposeFilter} label="Purpose">
        <option value="all">All purposes</option>
        {props.purposes.map((purpose) => (
          <option key={purpose} value={purpose}>
            {purpose}
          </option>
        ))}
      </Select>
      <button
        onClick={props.onReset}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-[8px] border border-line bg-black/60 px-4 text-sm font-semibold text-bone transition hover:border-bottegaBright hover:text-bottegaBright"
      >
        <Icon name="rotate-ccw" />
        Reset
      </button>
    </section>
  );
}

function Select({ value, onChange, label, children }) {
  return (
    <label>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 w-full rounded-[8px] border border-line bg-black/60 px-3 text-sm text-bone outline-none transition focus:border-bottegaBright"
      >
        {children}
      </select>
    </label>
  );
}

function KpiGrid({ rows, filteredRows, metrics, stats }) {
  const cards = [
    {
      label: "Filtered satellites",
      value: formatNumber(filteredRows.length),
      sub: `${formatNumber((filteredRows.length / rows.length) * 100, 1)}% of catalog`,
      icon: "satellite",
    },
    {
      label: "High pressure",
      value: formatNumber(stats.tierCounts.high || 0),
      sub: `${formatNumber(((stats.tierCounts.high || 0) / Math.max(filteredRows.length, 1)) * 100, 1)}% filtered`,
      icon: "activity",
    },
    {
      label: "Average score",
      value: formatNumber(stats.avgScore, 3),
      sub: `P90 ${formatNumber(stats.p90, 3)}`,
      icon: "gauge",
    },
    {
      label: "Model F1",
      value: `${formatNumber(metrics.holdout_f1_weighted * 100, 1)}%`,
      sub: metrics.target,
      icon: "brain-circuit",
    },
  ];

  return (
    <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <div className="panel p-4" key={card.label}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase text-muted">{card.label}</p>
              <p className="mt-2 text-3xl font-extrabold text-bone">{card.value}</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-bottega/50 bg-bottega/15 text-bottegaBright">
              <Icon name={card.icon} />
            </div>
          </div>
          <p className="mt-3 text-sm text-muted">{card.sub}</p>
        </div>
      ))}
    </section>
  );
}

function TierDistribution({ counts, total }) {
  const tiers = ["high", "medium", "low"];
  return (
    <section className="panel p-4">
      <SectionTitle icon="bar-chart-3" title="Predicted tier distribution" value={`${formatNumber(total)} shown`} />
      <div className="mt-5 space-y-4">
        {tiers.map((tier) => {
          const value = counts[tier] || 0;
          const pct = (value / Math.max(total, 1)) * 100;
          return (
            <div key={tier}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className={`font-semibold tier-${tier}`}>{tier}</span>
                <span className="text-muted">
                  {formatNumber(value)} · {formatNumber(pct, 1)}%
                </span>
              </div>
              <div className="h-3 overflow-hidden rounded-[8px] bg-white/8">
                <div
                  className="h-full rounded-[8px]"
                  style={{ width: `${pct}%`, backgroundColor: TIER_COLORS[tier] }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function OrbitMix({ counts, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="orbit" title="Orbit mix" value={`${formatNumber(total)} records`} />
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {counts.map((entry) => (
          <MetricBar key={entry.label} label={entry.label} value={entry.value} total={total} />
        ))}
      </div>
    </section>
  );
}

function AltitudeScatter({ rows }) {
  const points = useMemo(() => {
    const finiteRows = rows.filter((row) => Number.isFinite(row.altitude) && Number.isFinite(row.score));
    const maxAltitude = Math.max(...finiteRows.map((row) => row.altitude), 1);
    return finiteRows.slice(0, 900).map((row) => ({
      ...row,
      x: 42 + (Math.min(row.altitude, maxAltitude) / maxAltitude) * 500,
      y: 248 - row.score * 210,
    }));
  }, [rows]);

  return (
    <section className="panel p-4">
      <SectionTitle icon="scatter-chart" title="Altitude and coordination pressure" value={`${formatNumber(points.length)} points`} />
      <div className="mt-4 overflow-hidden rounded-[8px] border border-line bg-black/35">
        <svg viewBox="0 0 600 280" className="h-[320px] w-full">
          {[0, 0.25, 0.5, 0.75, 1].map((tick) => (
            <g key={tick}>
              <line x1="42" x2="560" y1={248 - tick * 210} y2={248 - tick * 210} className="gridline" />
              <text x="12" y={252 - tick * 210} className="axis-label">
                {tick.toFixed(2)}
              </text>
            </g>
          ))}
          <line x1="42" x2="560" y1="248" y2="248" stroke="rgba(243,244,239,.35)" />
          <line x1="42" x2="42" y1="28" y2="248" stroke="rgba(243,244,239,.35)" />
          {points.map((point, index) => (
            <circle
              key={`${point.norad}-${index}`}
              cx={point.x}
              cy={point.y}
              r={point.tier === "high" ? 3.4 : 2.6}
              fill={TIER_COLORS[point.tier] || "#9ca8a2"}
              opacity={point.tier === "high" ? 0.88 : 0.58}
            >
              <title>{`${point.name} · ${point.orbit} · ${formatNumber(point.score, 3)}`}</title>
            </circle>
          ))}
          <text x="250" y="272" className="axis-label">mean altitude</text>
          <text x="72" y="22" className="axis-label">pressure score</text>
        </svg>
      </div>
    </section>
  );
}

function TopOperators({ entries, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="building-2" title="Operator concentration" value="filtered" />
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <MetricBar key={entry.label} label={entry.label} value={entry.value} total={total} />
        ))}
      </div>
    </section>
  );
}

function PurposeBars({ entries, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="network" title="Mission purpose mix" value="top categories" />
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <MetricBar key={entry.label} label={entry.label} value={entry.value} total={total} />
        ))}
      </div>
    </section>
  );
}

function SatelliteTable({ rows }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="list-filter" title="Highest pressure satellites" value="top 8" />
      <div className="scrollbar-thin mt-4 max-h-[360px] overflow-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="sticky top-0 bg-panel text-xs uppercase text-muted">
            <tr>
              <th className="border-b border-line px-3 py-3 font-semibold">Satellite</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Operator</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Orbit</th>
              <th className="border-b border-line px-3 py-3 font-semibold">Altitude</th>
              <th className="border-b border-line px-3 py-3 text-right font-semibold">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.norad}-${row.name}`} className="border-b border-line/70">
                <td className="px-3 py-3">
                  <div className="font-semibold text-bone">{row.name}</div>
                  <div className="text-xs text-muted">NORAD {row.norad || "N/A"}</div>
                </td>
                <td className="px-3 py-3 text-muted">{row.operator}</td>
                <td className="px-3 py-3">{row.orbit}</td>
                <td className="px-3 py-3 text-muted">{formatNumber(row.altitude, 1)} km</td>
                <td className="px-3 py-3 text-right font-semibold text-bottegaBright">
                  {formatNumber(row.score, 3)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MetricBar({ label, value, total }) {
  const pct = (value / Math.max(total, 1)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3 text-sm">
        <span className="line-clamp-1 font-medium text-bone">{label}</span>
        <span className="shrink-0 text-muted">{formatNumber(value)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-[8px] bg-white/8">
        <div className="h-full rounded-[8px] bg-bottegaBright" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function SectionTitle({ icon, title, value }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase text-bone">
        <span className="text-bottegaBright">
          <Icon name={icon} />
        </span>
        {title}
      </h2>
      <span className="rounded-[8px] border border-line bg-black/45 px-2.5 py-1 text-xs text-muted">
        {value}
      </span>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
