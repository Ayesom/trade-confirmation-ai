import React, { useEffect, useState } from "react";
import { getMetrics } from "../utils/api";
import { Activity, Search, GitCompare, FileCheck, Clock } from "lucide-react";
import { RadialBarChart, RadialBar, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell, PieChart, Pie } from "recharts";

const TRADE_TYPE_LABELS = {
  fx_spot: "FX Spot", fx_forward: "FX Forward",
  interest_rate_swap: "IRS", equity_trade: "Equity",
  bond_trade: "Bond", credit_default_swap: "CDS",
};

const RISK_COLORS = { HIGH: "#ef4444", MEDIUM: "#f59e0b", LOW: "#10b981" };

function GaugeCard({ label, value, target, unit = "%" }) {
  const pct = Math.min((value / (target * 1.2)) * 100, 100);
  const meets = value >= target;
  const data = [
    { value: pct, fill: meets ? "#10b981" : "#3b82f6" },
    { value: 100 - pct, fill: "#1a2740" }
  ];
  return (
    <div className={`metric-card ${meets ? "green" : ""}`}>
      <div className="metric-label">{label}</div>
      <div style={{ height: 90, position: "relative" }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart innerRadius="60%" outerRadius="90%" startAngle={180} endAngle={0} data={data}>
            <RadialBar dataKey="value" cornerRadius={4} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div style={{ position: "absolute", bottom: 4, left: 0, right: 0, textAlign: "center" }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 800, color: meets ? "var(--green)" : "var(--accent)" }}>
            {typeof value === "number" ? value.toFixed(1) : "—"}{unit}
          </span>
        </div>
      </div>
      <div className="metric-target">
        Target: {target}{unit}
        <span className={meets ? " meets" : " misses"}>{meets ? " ✓" : " ✗"}</span>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color = "blue" }) {
  return (
    <div className="metric-card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div className="metric-label">{label}</div>
        <Icon size={16} style={{ color: "var(--text-muted)" }} />
      </div>
      <div className={`metric-value ${color}`}>{value}</div>
      {sub && <div className="metric-sub">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getMetrics()
      .then(r => { setMetrics(r.data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const tradeTypeData = metrics
    ? Object.entries(metrics.trade_type_distribution || {}).map(([k, v]) => ({
        name: TRADE_TYPE_LABELS[k] || k, value: v,
      }))
    : [];

  const riskData = metrics
    ? Object.entries(metrics.risk_distribution || {}).map(([k, v]) => ({
        name: k, value: v, fill: RISK_COLORS[k],
      }))
    : [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="iter-badge"><Activity size={12} /> Live Metrics</div>
        <div className="page-title">Operations Dashboard</div>
        <div className="page-sub">Real-time performance tracking across all three automation iterations</div>
      </div>

      {loading ? (
        <div className="loading-overlay"><div className="spinner" /><span>Loading metrics…</span></div>
      ) : (
        <>
          {/* KPI Gauges */}
          <div style={{ marginBottom: 8 }}>
            <div className="card-title" style={{ marginBottom: 12 }}>📊 Success Metrics</div>
          </div>
          <div className="grid-3" style={{ marginBottom: 24 }}>
            <GaugeCard label="Precision (Template Retrieval)" value={(metrics?.precision || 0) * 100} target={80} unit="%" />
            <GaugeCard label="Clause Alignment F1" value={(metrics?.clause_alignment_f1 || 0) * 100} target={85} unit="%" />
            <GaugeCard label="Autofill Accuracy" value={metrics?.autofill_accuracy || 0} target={95} unit="%" />
          </div>

          {/* Volume stats */}
          <div className="metric-grid" style={{ marginBottom: 24 }}>
            <StatCard icon={Search} label="Total Searches" value={metrics?.total_searches || 0} sub="Template retrievals" color="blue" />
            <StatCard icon={GitCompare} label="Diff Analyses" value={metrics?.total_diffs || 0} sub="Comparisons run" color="amber" />
            <StatCard icon={FileCheck} label="Confirmations Generated" value={metrics?.total_generations || 0} sub="Documents produced" color="green" />
            <StatCard icon={Activity} label="Total Events" value={metrics?.total_events || 0} sub="All system events" color="blue" />
          </div>

          <div className="grid-2" style={{ marginBottom: 24 }}>
            {/* Trade Type Distribution */}
            <div className="card">
              <div className="card-title">Trade Type Activity</div>
              {tradeTypeData.length > 0 ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={tradeTypeData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                    <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background: "#1a2740", border: "1px solid #1e2f48", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                    <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state"><div className="empty-state-text">No activity yet. Start processing trades!</div></div>
              )}
            </div>

            {/* Risk Distribution */}
            <div className="card">
              <div className="card-title">Risk Distribution (Diffs)</div>
              {riskData.some(d => d.value > 0) ? (
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={riskData} dataKey="value" innerRadius={45} outerRadius={70} paddingAngle={3}>
                        {riskData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#1a2740", border: "1px solid #1e2f48", borderRadius: 8, color: "#e2e8f0", fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {riskData.map(d => (
                      <div key={d.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: 2, background: d.fill }} />
                        <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{d.name}</span>
                        <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, color: d.fill }}>{d.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="empty-state"><div className="empty-state-text">No diff data yet.</div></div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="card">
            <div className="card-title">Recent Activity</div>
            {metrics?.recent_activity?.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {metrics.recent_activity.map((event, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                    <div style={{ width: 30, height: 30, borderRadius: 8, background: "var(--bg-hover)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {event.type === "search" && <Search size={14} style={{ color: "var(--accent)" }} />}
                      {event.type === "diff" && <GitCompare size={14} style={{ color: "var(--amber)" }} />}
                      {event.type === "generation" && <FileCheck size={14} style={{ color: "var(--green)" }} />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                        {event.type === "search" && `Template search · Score: ${event.top_score?.toFixed(1)}%`}
                        {event.type === "diff" && `Diff analysis · ${event.total_diffs} differences · ${event.overall_risk} risk`}
                        {event.type === "generation" && `Confirmation generated · ${event.compliance_rate?.toFixed(1)}% compliance`}
                      </div>
                      <div style={{ fontSize: 11.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {event.trade_type?.replace("_", " ")} · {new Date(event.timestamp).toLocaleString()}
                      </div>
                    </div>
                    {event.type === "diff" && (
                      <span className={`risk-badge risk-${event.overall_risk}`}>{event.overall_risk}</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">
                <Clock size={32} className="empty-state-icon" />
                <div className="empty-state-text">No activity yet. Process your first trade to see data here.</div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}