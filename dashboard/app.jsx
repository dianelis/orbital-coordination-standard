const { useEffect, useMemo, useState } = React;

const API_BASE = window.SAIL_API_BASE || "http://localhost:8000";
const DASHBOARD_API_URL = `${API_BASE}/api/dashboard-data`;
const STATIC_DASHBOARD_URL = "../models/satellite_coordination_dashboard_data.json";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", ""]);
const FORCE_STATIC =
  new URLSearchParams(window.location.search).get("mode") === "static" ||
  !LOCAL_HOSTS.has(window.location.hostname);

const TIER_COLORS = {
  high: "#fb7185",
  medium: "#fbbf24",
  low: "#10b981",
};

const LAYER_LABELS = {
  spacecraft: "Spacecraft",
  neighborhood: "Neighborhood",
  infrastructure: "Infrastructure",
};

const TABS = [
  { id: "overview", label: "Overview", icon: "layout-dashboard" },
  { id: "layers", label: "Three layers", icon: "layers-3" },
  { id: "scenarios", label: "Stress tests", icon: "activity" },
  { id: "sail", label: "SAIL flow", icon: "workflow" },
  { id: "governance", label: "Governance", icon: "shield-check" },
  { id: "operators", label: "Operators", icon: "building-2" },
  { id: "evidence", label: "Evidence", icon: "file-text" },
];

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

function pct(value) {
  return `${formatNumber(Number(value) * 100, 1)}%`;
}

function normalizeTier(tier) {
  return String(tier || "unknown").toLowerCase();
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
  const response = await fetch(DASHBOARD_API_URL);
  if (!response.ok) throw new Error("Could not load dashboard data from FastAPI.");
  const data = await response.json();
  return {
    ...data,
    metadata: { ...data.metadata, data_source: "FastAPI" },
  };
}

async function loadFromStaticArtifacts() {
  const response = await fetch(STATIC_DASHBOARD_URL);
  if (!response.ok) throw new Error("Could not load static dashboard artifact.");
  const data = await response.json();
  return {
    ...data,
    metadata: { ...data.metadata, data_source: "Static Pages" },
  };
}

function App() {
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [activeTab, setActiveTab] = useState("overview");
  const [tierFilter, setTierFilter] = useState("all");
  const [layerFilter, setLayerFilter] = useState("all");
  const [orbitFilter, setOrbitFilter] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const loaded = FORCE_STATIC
          ? await loadFromStaticArtifacts()
          : await loadFromApi().catch(() => loadFromStaticArtifacts());
        setData(loaded);
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

  const rows = data?.satellites || [];
  const metrics = data?.metadata?.model || {};
  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesTier = tierFilter === "all" || normalizeTier(row.tier) === tierFilter;
      const matchesLayer = layerFilter === "all" || row.dominant_layer === layerFilter;
      const matchesOrbit = orbitFilter === "all" || row.orbit === orbitFilter;
      const matchesSearch =
        !query ||
        String(row.name).toLowerCase().includes(query) ||
        String(row.operator).toLowerCase().includes(query) ||
        String(row.norad).toLowerCase().includes(query);
      return matchesTier && matchesLayer && matchesOrbit && matchesSearch;
    });
  }, [rows, tierFilter, layerFilter, orbitFilter, search]);

  const stats = useMemo(() => {
    const highRows = filteredRows.filter((row) => normalizeTier(row.tier) === "high");
    const avgScore =
      filteredRows.reduce((total, row) => total + (Number(row.score) || 0), 0) /
      Math.max(filteredRows.length, 1);
    return {
      tierCounts: countBy(filteredRows, "tier"),
      layerCounts: countBy(filteredRows, "dominant_layer"),
      orbitCounts: topEntries(countBy(filteredRows, "orbit"), 8),
      topOperators: topEntries(countBy(filteredRows, "operator"), 8),
      topPurposes: topEntries(countBy(filteredRows, "purpose"), 8),
      topHigh: [...highRows].sort((a, b) => b.score - a.score).slice(0, 10),
      avgScore,
      p90: percentile(filteredRows.map((row) => Number(row.score)), 90),
      avgAudit:
        filteredRows.reduce((total, row) => total + (Number(row.audit_priority) || 0), 0) /
        Math.max(filteredRows.length, 1),
    };
  }, [filteredRows]);

  const orbits = useMemo(() => Object.keys(countBy(rows, "orbit")).sort(), [rows]);

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
            sure <code>models/satellite_coordination_dashboard_data.json</code> is published.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-[1480px] px-4 py-5 sm:px-6 lg:px-8">
      <Header data={data} rows={rows} metrics={metrics} />
      <TabNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <Filters
        search={search}
        setSearch={setSearch}
        tierFilter={tierFilter}
        setTierFilter={setTierFilter}
        layerFilter={layerFilter}
        setLayerFilter={setLayerFilter}
        orbitFilter={orbitFilter}
        setOrbitFilter={setOrbitFilter}
        orbits={orbits}
        onReset={() => {
          setSearch("");
          setTierFilter("all");
          setLayerFilter("all");
          setOrbitFilter("all");
        }}
      />

      {activeTab === "overview" && (
        <Overview data={data} rows={rows} filteredRows={filteredRows} metrics={metrics} stats={stats} />
      )}
      {activeTab === "layers" && <LayerView data={data} stats={stats} />}
      {activeTab === "scenarios" && <ScenarioView scenarios={data.scenarios} />}
      {activeTab === "sail" && <SailFlowView flow={data.sail_flow} />}
      {activeTab === "governance" && <GovernanceView governance={data.governance} rows={filteredRows} />}
      {activeTab === "operators" && <OperatorView operators={data.operators} />}
      {activeTab === "evidence" && <EvidenceView reports={data.evidence_reports} />}
    </main>
  );
}

function Header({ data, rows, metrics }) {
  return (
    <header className="flex flex-col gap-4 border-b border-line pb-5 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <h1 className="max-w-4xl text-3xl font-extrabold leading-tight text-bone sm:text-4xl">
          Coordination pressure across orbital infrastructure
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          A proof-of-work dashboard for the paper's thesis: megaconstellations should be evaluated as
          layered autonomous robotic infrastructure, not just individual licensed spacecraft.
        </p>
      </div>
      <div className="panel min-w-[320px] px-4 py-3">
        <div className="text-xs uppercase text-muted">Trained model</div>
        <div className="mt-1 flex items-center justify-between gap-4">
          <div className="text-sm font-semibold text-bone">{metrics.selected_model}</div>
          <div className="rounded-[8px] bg-bottega px-2.5 py-1 text-sm font-bold text-white">
            {pct(metrics.holdout_f1_weighted)} F1
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted">
          <span>{formatNumber(rows.length)} satellites</span>
          <span className="text-right">{data.metadata.data_source}</span>
        </div>
        <a
          href={data.metadata.dataset.url}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex text-xs font-semibold text-bottegaBright hover:text-bone"
        >
          Dataset source
        </a>
      </div>
    </header>
  );
}

function TabNav({ activeTab, setActiveTab }) {
  return (
    <nav className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-7">
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex h-11 items-center justify-center gap-2 rounded-[8px] border px-3 text-sm font-semibold transition ${
              active
                ? "border-bottegaBright bg-bottega text-white"
                : "border-line bg-black/45 text-muted hover:border-bottegaBright hover:text-bone"
            }`}
          >
            <Icon name={tab.icon} />
            {tab.label}
          </button>
        );
      })}
    </nav>
  );
}

function Filters(props) {
  return (
    <section className="panel mt-4 grid gap-3 p-3 lg:grid-cols-[1.3fr_0.65fr_0.8fr_0.8fr_auto]">
      <label className="relative block">
        <span className="sr-only">Search satellites</span>
        <Icon
          name="search"
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
        />
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
      <Select value={props.layerFilter} onChange={props.setLayerFilter} label="Layer">
        <option value="all">All layers</option>
        <option value="spacecraft">Spacecraft</option>
        <option value="neighborhood">Neighborhood</option>
        <option value="infrastructure">Infrastructure</option>
      </Select>
      <Select value={props.orbitFilter} onChange={props.setOrbitFilter} label="Orbit">
        <option value="all">All orbits</option>
        {props.orbits.map((orbit) => (
          <option key={orbit} value={orbit}>
            {orbit}
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

function Overview({ data, rows, filteredRows, metrics, stats }) {
  return (
    <>
      <section className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Kpi label="Filtered satellites" value={formatNumber(filteredRows.length)} sub={`${formatNumber((filteredRows.length / rows.length) * 100, 1)}% of catalog`} icon="satellite" />
        <Kpi label="High pressure" value={formatNumber(stats.tierCounts.high || 0)} sub="coordination tier" icon="activity" />
        <Kpi label="Average pressure" value={formatNumber(stats.avgScore, 3)} sub={`P90 ${formatNumber(stats.p90, 3)}`} icon="gauge" />
        <Kpi label="Audit priority" value={formatNumber(stats.avgAudit, 3)} sub="paper evidence signal" icon="clipboard-check" />
        <Kpi label="Model F1" value={pct(metrics.holdout_f1_weighted)} sub={metrics.target} icon="brain-circuit" />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1fr_1fr]">
        <TierDistribution counts={stats.tierCounts} total={filteredRows.length} />
        <LayerDistribution counts={stats.layerCounts} total={filteredRows.length} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
        <AltitudeScatter rows={filteredRows} />
        <StackedBars title="Orbit mix" icon="orbit" entries={stats.orbitCounts} total={filteredRows.length} />
      </section>

      <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <StackedBars title="Mission purpose mix" icon="network" entries={stats.topPurposes} total={filteredRows.length} />
        <SatelliteTable rows={stats.topHigh} />
      </section>
    </>
  );
}

function LayerView({ data }) {
  const layers = Object.entries(data.layers);
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-3">
      {layers.map(([key, layer]) => (
        <div className="panel p-4" key={key}>
          <SectionTitle icon={key === "spacecraft" ? "satellite" : key === "neighborhood" ? "route" : "globe-2"} title={`${LAYER_LABELS[key]} layer`} value={pct(layer.average_pressure)} />
          <p className="mt-3 min-h-[72px] text-sm leading-6 text-muted">{layer.description}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniMetric label="Avg pressure" value={formatNumber(layer.average_pressure, 3)} />
            <MiniMetric label="High count" value={formatNumber(layer.high_pressure_count)} />
          </div>
          <div className="mt-5 space-y-3">
            {layer.top_satellites.slice(0, 6).map((sat) => (
              <SatelliteLine key={`${key}-${sat.norad}-${sat.name}`} sat={sat} />
            ))}
          </div>
        </div>
      ))}
    </section>
  );
}

function ScenarioView({ scenarios }) {
  const [selectedId, setSelectedId] = useState(scenarios[0]?.id);
  const selected = scenarios.find((scenario) => scenario.id === selectedId) || scenarios[0];
  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="panel p-4">
        <SectionTitle icon="activity" title="Constellation stress tests" value={`${scenarios.length} scenarios`} />
        <div className="mt-4 space-y-2">
          {scenarios.map((scenario) => (
            <button
              key={scenario.id}
              onClick={() => setSelectedId(scenario.id)}
              className={`w-full rounded-[8px] border p-3 text-left transition ${
                scenario.id === selected.id
                  ? "border-bottegaBright bg-bottega/20"
                  : "border-line bg-black/35 hover:border-bottegaBright"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-bone">{scenario.name}</span>
                <span className="text-xs uppercase text-bottegaBright">{scenario.layer}</span>
              </div>
              <p className="mt-1 text-xs leading-5 text-muted">{scenario.description}</p>
            </button>
          ))}
        </div>
      </div>
      <div className="panel p-4">
        <SectionTitle icon="bar-chart-4" title={selected.name} value={selected.residual_risk_class} />
        <p className="mt-3 text-sm leading-6 text-muted">{selected.description}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MiniMetric label="Affected satellites" value={formatNumber(selected.affected_satellites)} />
          <MiniMetric label="SAIL messages" value={formatNumber(selected.required_sail_messages)} />
          <MiniMetric label="Audit records" value={formatNumber(selected.audit_records_required)} />
          <MiniMetric label="Recovery minutes" value={formatNumber(selected.estimated_recovery_minutes)} />
        </div>
        <div className="mt-5">
          <h3 className="text-sm font-bold uppercase text-bone">Top affected satellites</h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {selected.top_affected.map((sat) => (
              <SatelliteLine key={`${selected.id}-${sat.norad}-${sat.name}`} sat={sat} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function SailFlowView({ flow }) {
  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[0.75fr_1.25fr]">
      <div className="panel p-4">
        <SectionTitle icon="satellite" title="Selected high-pressure object" value={flow.selected_satellite.object_id} />
        <p className="mt-4 text-2xl font-extrabold text-bone">{flow.selected_satellite.name}</p>
        <p className="mt-2 text-sm text-muted">{flow.selected_satellite.operator}</p>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MiniMetric label="Pressure score" value={formatNumber(flow.selected_satellite.pressure_score, 3)} />
          <MiniMetric label="Messages" value={formatNumber(flow.messages.length)} />
        </div>
      </div>
      <div className="panel p-4">
        <SectionTitle icon="workflow" title="SAIL message flow" value="shared intent" />
        <div className="mt-5 space-y-3">
          {flow.messages.map((message, index) => (
            <div className="grid gap-3 rounded-[8px] border border-line bg-black/35 p-3 md:grid-cols-[40px_1fr]" key={`${message.message_type}-${index}`}>
              <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-bottega text-sm font-bold text-white">
                {index + 1}
              </div>
              <div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-bold text-bone">{message.message_type}</h3>
                  <span className="rounded-[8px] border border-line px-2 py-1 text-xs text-bottegaBright">{message.status}</span>
                </div>
                <p className="mt-2 text-sm text-muted">
                  {message.object_id} · {message.operator_id} · urgency {message.urgency}
                </p>
                <p className="mt-2 text-xs leading-5 text-muted">{message.audit_relevance}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function GovernanceView({ governance, rows }) {
  const auditRows = [...rows].sort((a, b) => b.audit_priority - a.audit_priority).slice(0, 8);
  return (
    <section className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
      <div className="panel p-4">
        <SectionTitle icon="shield-check" title="Governance readiness" value={pct(governance.average_visibility)} />
        <div className="mt-4 space-y-4">
          {["high", "medium", "low"].map((tier) => (
            <MetricBar
              key={tier}
              label={`${tier} visibility`}
              value={governance.visibility_counts[tier] || 0}
              total={Object.values(governance.visibility_counts).reduce((a, b) => a + b, 0)}
              color={TIER_COLORS[tier]}
            />
          ))}
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <MiniMetric label="Average visibility" value={formatNumber(governance.average_visibility, 3)} />
          <MiniMetric label="High audit priority" value={formatNumber(governance.audit_priority_high_count)} />
        </div>
      </div>
      <div className="panel p-4">
        <SectionTitle icon="clipboard-check" title="Audit priority queue" value="top satellites" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {auditRows.map((sat) => (
            <SatelliteLine
              key={`audit-${sat.norad}-${sat.name}`}
              sat={{ ...sat, score: sat.audit_priority }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function OperatorView({ operators }) {
  return (
    <section className="panel mt-4 p-4">
      <SectionTitle icon="building-2" title="Operator-level comparison" value={`${operators.length} operators`} />
      <div className="scrollbar-thin mt-4 overflow-auto">
        <table className="w-full min-w-[980px] text-left text-sm">
          <thead className="sticky top-0 bg-panel text-xs uppercase text-muted">
            <tr>
              <th className="border-b border-line px-3 py-3">Operator</th>
              <th className="border-b border-line px-3 py-3 text-right">Satellites</th>
              <th className="border-b border-line px-3 py-3 text-right">High pressure</th>
              <th className="border-b border-line px-3 py-3">Dominant orbit</th>
              <th className="border-b border-line px-3 py-3">Dominant purpose</th>
              <th className="border-b border-line px-3 py-3 text-right">Avg score</th>
              <th className="border-b border-line px-3 py-3 text-right">Governance</th>
            </tr>
          </thead>
          <tbody>
            {operators.map((operator) => (
              <tr key={operator.operator} className="border-b border-line/70">
                <td className="px-3 py-3 font-semibold text-bone">{operator.operator}</td>
                <td className="px-3 py-3 text-right text-muted">{formatNumber(operator.satellite_count)}</td>
                <td className="px-3 py-3 text-right text-bottegaBright">{formatNumber(operator.high_pressure_count)}</td>
                <td className="px-3 py-3 text-muted">{operator.dominant_orbit}</td>
                <td className="px-3 py-3 text-muted">{operator.dominant_purpose}</td>
                <td className="px-3 py-3 text-right">{formatNumber(operator.average_score, 3)}</td>
                <td className="px-3 py-3 text-right">{formatNumber(operator.governance_visibility, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function EvidenceView({ reports }) {
  return (
    <section className="mt-4 grid gap-4 lg:grid-cols-2">
      {reports.map((report) => (
        <article className="panel p-4" key={report.scenario}>
          <SectionTitle icon="file-text" title={report.scenario} value={report.residual_risk_class} />
          <p className="mt-3 text-sm leading-6 text-muted">{report.regulator_summary}</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniMetric label="Affected" value={formatNumber(report.affected_satellites)} />
            <MiniMetric label="SAIL messages" value={formatNumber(report.required_sail_messages)} />
            <MiniMetric label="Audit complete" value={pct(report.audit_completeness)} />
            <MiniMetric label="Recovery min" value={formatNumber(report.estimated_recovery_minutes)} />
          </div>
          <div className="mt-4 rounded-[8px] border border-line bg-black/35 p-3">
            <p className="text-xs uppercase text-muted">What recovered</p>
            <p className="mt-2 text-sm leading-6 text-bone">{report.what_recovered}</p>
          </div>
        </article>
      ))}
    </section>
  );
}

function Kpi({ label, value, sub, icon }) {
  return (
    <div className="panel p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase text-muted">{label}</p>
          <p className="mt-2 text-3xl font-extrabold text-bone">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-[8px] border border-bottega/50 bg-bottega/15 text-bottegaBright">
          <Icon name={icon} />
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">{sub}</p>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div className="rounded-[8px] border border-line bg-black/35 p-3">
      <p className="text-xs uppercase text-muted">{label}</p>
      <p className="mt-1 text-xl font-extrabold text-bone">{value}</p>
    </div>
  );
}

function TierDistribution({ counts, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="bar-chart-3" title="Predicted tier distribution" value={`${formatNumber(total)} shown`} />
      <div className="mt-5 space-y-4">
        {["high", "medium", "low"].map((tier) => (
          <MetricBar
            key={tier}
            label={tier}
            value={counts[tier] || 0}
            total={total}
            color={TIER_COLORS[tier]}
          />
        ))}
      </div>
    </section>
  );
}

function LayerDistribution({ counts, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="layers-3" title="Dominant autonomy layer" value={`${formatNumber(total)} shown`} />
      <div className="mt-5 space-y-4">
        {["spacecraft", "neighborhood", "infrastructure"].map((layer) => (
          <MetricBar
            key={layer}
            label={LAYER_LABELS[layer]}
            value={counts[layer] || 0}
            total={total}
            color="#10b981"
          />
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
              r={normalizeTier(point.tier) === "high" ? 3.4 : 2.6}
              fill={TIER_COLORS[normalizeTier(point.tier)] || "#9ca8a2"}
              opacity={normalizeTier(point.tier) === "high" ? 0.88 : 0.58}
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

function StackedBars({ title, icon, entries, total }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon={icon} title={title} value="top categories" />
      <div className="mt-4 space-y-3">
        {entries.map((entry) => (
          <MetricBar key={entry.label} label={entry.label} value={entry.value} total={total} color="#10b981" />
        ))}
      </div>
    </section>
  );
}

function SatelliteTable({ rows }) {
  return (
    <section className="panel p-4">
      <SectionTitle icon="list-filter" title="Highest pressure satellites" value="top 10" />
      <div className="scrollbar-thin mt-4 max-h-[420px] overflow-auto">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="sticky top-0 bg-panel text-xs uppercase text-muted">
            <tr>
              <th className="border-b border-line px-3 py-3">Satellite</th>
              <th className="border-b border-line px-3 py-3">Operator</th>
              <th className="border-b border-line px-3 py-3">Layer</th>
              <th className="border-b border-line px-3 py-3">Orbit</th>
              <th className="border-b border-line px-3 py-3 text-right">Score</th>
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
                <td className="px-3 py-3 text-bottegaBright">{LAYER_LABELS[row.dominant_layer]}</td>
                <td className="px-3 py-3 text-muted">{row.orbit}</td>
                <td className="px-3 py-3 text-right font-semibold">{formatNumber(row.score, 3)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function SatelliteLine({ sat }) {
  return (
    <div className="rounded-[8px] border border-line bg-black/35 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-bone">{sat.name}</p>
          <p className="mt-1 text-xs text-muted">{sat.operator}</p>
        </div>
        <span className="text-sm font-bold text-bottegaBright">{formatNumber(sat.score, 3)}</span>
      </div>
      <p className="mt-2 text-xs text-muted">
        {sat.orbit || "Unknown orbit"} · NORAD {sat.norad || "N/A"}
      </p>
    </div>
  );
}

function MetricBar({ label, value, total, color }) {
  const width = (Number(value) / Math.max(Number(total), 1)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-start justify-between gap-3 text-sm">
        <span className="font-medium text-bone">{label}</span>
        <span className="shrink-0 text-muted">
          {formatNumber(value)} · {formatNumber(width, 1)}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-[8px] bg-white/8">
        <div className="h-full rounded-[8px]" style={{ width: `${width}%`, backgroundColor: color }} />
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
