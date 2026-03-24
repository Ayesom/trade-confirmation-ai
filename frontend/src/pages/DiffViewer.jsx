import React, { useState, useEffect } from "react";
import { GitCompare, AlertTriangle, AlertCircle, CheckCircle, ChevronDown, ChevronUp } from "lucide-react";
import toast from "react-hot-toast";
import { runDiff, getAllTemplates, getTradeTypes } from "../utils/api";

const RISK_ICONS = {
  HIGH: <AlertTriangle size={13} />,
  MEDIUM: <AlertCircle size={13} />,
  LOW: <CheckCircle size={13} />,
};

function DiffItem({ diff, expanded, onToggle }) {
  return (
    <div className={`diff-item ${diff.risk_level}`}>
      <div className="diff-header" onClick={onToggle} style={{ cursor: "pointer" }}>
        <div className="diff-field">{diff.field_label}</div>
        <div className="diff-meta">
          {diff.pct_change != null && (
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--amber)" }}>Δ{diff.pct_change.toFixed(2)}%</span>
          )}
          {diff.semantic_similarity != null && (
            <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)" }}>sim:{(diff.semantic_similarity * 100).toFixed(0)}%</span>
          )}
          <span className={`risk-badge risk-${diff.risk_level}`}>{RISK_ICONS[diff.risk_level]} {diff.risk_level}</span>
          <span className={`risk-badge risk-${diff.change_type === "ADDED" ? "LOW" : diff.change_type === "REMOVED" ? "HIGH" : "MEDIUM"}`} style={{ fontSize: 10 }}>{diff.change_type}</span>
          {expanded ? <ChevronUp size={14} style={{ color: "var(--text-muted)" }} /> : <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />}
        </div>
      </div>
      {expanded && (
        <>
          <div className="diff-body">
            <div className="diff-side">
              <div className="diff-side-label">Template Value</div>
              <div className={`diff-value ${diff.template_value != null ? "old" : ""}`}>
                {diff.template_value != null ? String(diff.template_value) : <em style={{ color: "var(--text-muted)" }}>Not present</em>}
              </div>
            </div>
            <div className="diff-side">
              <div className="diff-side-label">New Trade Value</div>
              <div className={`diff-value ${diff.new_value != null ? "new" : ""}`}>
                {diff.new_value != null ? String(diff.new_value) : <em style={{ color: "var(--text-muted)" }}>Not present</em>}
              </div>
            </div>
          </div>
          <div className="diff-desc">{diff.description}</div>
        </>
      )}
    </div>
  );
}

const SAMPLE_NEW_TRADE = {
  fx_spot: {
    trade_type: "fx_spot",
    trade_type_label: "FX Spot",
    counterparty: "Deutsche Bank AG",
    currency_pair: "USD/EUR",
    notional_amount: 7500000,
    exchange_rate: 0.9310,
    settlement_date: "T+2",
    trade_date: "2024-06-15",
    buyer: "Goldman Sachs International",
    seller: "Deutsche Bank AG",
    jurisdiction: "New York State"
  },
  interest_rate_swap: {
    trade_type: "interest_rate_swap",
    trade_type_label: "Interest Rate Swap",
    counterparty: "Morgan Stanley",
    notional_amount: 150000000,
    fixed_rate: 4.75,
    floating_rate_benchmark: "SOFR",
    trade_date: "2024-06-01",
    effective_date: "2024-06-03",
    termination_date: "2031-06-03",
    tenor: "7Y",
    fixed_rate_payer: "Bank of America NA",
    floating_rate_payer: "Morgan Stanley",
    payment_frequency: "Quarterly"
  },
  equity_trade: {
    trade_type: "equity_trade",
    trade_type_label: "Equity Trade",
    counterparty: "UBS Securities LLC",
    security_name: "Microsoft Corp.",
    ticker: "MSFT",
    number_of_shares: 350000,
    price_per_share: 420.75,
    total_consideration: 147262500,
    currency: "USD",
    trade_date: "2024-06-10",
    settlement_date: "2024-06-12",
    buyer: "Vanguard",
    seller: "UBS Securities LLC"
  },
};

export default function DiffViewer() {
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [newTradeJson, setNewTradeJson] = useState("");
  const [diffResult, setDiffResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");
  const [expanded, setExpanded] = useState({});
  const [tradeTypes, setTradeTypes] = useState([]);

  useEffect(() => {
    getAllTemplates().then(r => setTemplates(r.data.templates)).catch(() => {});
    getTradeTypes().then(r => setTradeTypes(r.data.trade_types)).catch(() => {});
    const saved = localStorage.getItem("selectedTemplate");
    if (saved) {
      try {
        const t = JSON.parse(saved);
        setSelectedTemplateId(t.id);
      } catch {}
    }
  }, []);

  const loadSample = (tt) => {
    const sample = SAMPLE_NEW_TRADE[tt];
    if (sample) setNewTradeJson(JSON.stringify(sample, null, 2));
    else toast("No sample available for this trade type");
  };

  const handleDiff = async () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) { toast.error("Select a template first"); return; }
    let newTrade;
    try { newTrade = JSON.parse(newTradeJson); } catch { toast.error("Invalid JSON in new trade"); return; }
    setLoading(true);
    try {
      const r = await runDiff(template, newTrade);
      setDiffResult(r.data);
      const exp = {};
      r.data.differences.forEach((d, i) => { if (d.risk_level === "HIGH") exp[i] = true; });
      setExpanded(exp);
      toast.success(`${r.data.summary.total} differences found`);
      localStorage.setItem("diffTemplate", JSON.stringify(template));
      localStorage.setItem("diffNewTrade", JSON.stringify(newTrade));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const filtered = diffResult?.differences.filter(d => filter === "ALL" || d.risk_level === filter) || [];

  return (
    <div className="page">
      <div className="page-header">
        <div className="iter-badge"><GitCompare size={12} /> Iteration 2</div>
        <div className="page-title">Difference Viewer</div>
        <div className="page-sub">Compare new trade terms against a template — with risk severity tagging and semantic analysis</div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24, alignItems: "start" }}>
        {/* Config */}
        <div className="card">
          <div className="card-title">Configure Comparison</div>
          <div className="form-group">
            <label className="form-label">Select Base Template</label>
            <select className="form-select" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
              <option value="">— Choose template —</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.id} · {t.trade_type_label} · {t.counterparty}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <label className="form-label" style={{ margin: 0 }}>New Trade (JSON)</label>
              <div style={{ display: "flex", gap: 6 }}>
                {tradeTypes.slice(0, 3).map(tt => (
                  <button key={tt.value} className="btn btn-ghost btn-sm" onClick={() => loadSample(tt.value)} style={{ fontSize: 11 }}>
                    {tt.label}
                  </button>
                ))}
              </div>
            </div>
            <textarea
              className="form-textarea"
              style={{ fontFamily: "var(--font-mono)", fontSize: 12, minHeight: 200 }}
              placeholder='{"trade_type": "fx_spot", "notional_amount": 7500000, ...}'
              value={newTradeJson}
              onChange={e => setNewTradeJson(e.target.value)}
            />
          </div>
          <button className="btn btn-primary" style={{ width: "100%" }} onClick={handleDiff} disabled={loading}>
            {loading ? <><div className="spinner" /> Running Analysis…</> : <><GitCompare size={15} /> Run Diff Analysis</>}
          </button>
        </div>

        {/* Summary */}
        <div>
          {diffResult ? (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-title">Analysis Summary</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                {[
                  { label: "Total Differences", value: diffResult.summary.total, color: "var(--text-primary)" },
                  { label: "Overall Risk", value: diffResult.overall_risk, color: diffResult.overall_risk === "HIGH" ? "var(--red)" : diffResult.overall_risk === "MEDIUM" ? "var(--amber)" : "var(--green)" },
                  { label: "High Risk", value: diffResult.summary.high_risk, color: "var(--red)" },
                  { label: "Medium Risk", value: diffResult.summary.medium_risk, color: "var(--amber)" },
                  { label: "Low Risk", value: diffResult.summary.low_risk, color: "var(--green)" },
                  { label: "Clause Changes", value: diffResult.summary.clause_changes, color: "var(--accent)" },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius)", padding: "12px 14px" }}>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>{label}</div>
                    <div style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 20, color }}>{value}</div>
                  </div>
                ))}
              </div>
              <div style={{ padding: "10px 14px", borderRadius: "var(--radius)", background: diffResult.overall_risk === "HIGH" ? "var(--red-bg)" : diffResult.overall_risk === "MEDIUM" ? "var(--amber-bg)" : "var(--green-bg)", border: `1px solid ${diffResult.overall_risk === "HIGH" ? "rgba(239,68,68,0.3)" : diffResult.overall_risk === "MEDIUM" ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`, fontSize: 12.5, color: "var(--text-secondary)" }}>
                {diffResult.overall_risk === "HIGH" && "⚠️ High risk differences detected. Manual review of economic terms required before proceeding."}
                {diffResult.overall_risk === "MEDIUM" && "⚡ Medium risk differences found. Review clause changes before generating confirmation."}
                {diffResult.overall_risk === "LOW" && "✅ Only low risk differences detected. Safe to proceed to confirmation generation."}
              </div>
              {diffResult.overall_risk !== "HIGH" && (
                <div style={{ marginTop: 12 }}>
                  <a href="/generate" className="btn btn-green" style={{ width: "100%", justifyContent: "center" }}>
                    Proceed to Generator →
                  </a>
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-title">Risk Classification</div>
              {[
                { level: "HIGH", desc: "Economic terms: rates, amounts, dates, parties, reference entities. Require mandatory review." },
                { level: "MEDIUM", desc: "Legal clauses: governing law, settlement terms, netting. Should be reviewed by legal team." },
                { level: "LOW", desc: "Administrative: IDs, descriptions, versioning. Low impact on trade economics." },
              ].map(({ level, desc }) => (
                <div key={level} style={{ display: "flex", gap: 12, marginBottom: 16 }}>
                  <span className={`risk-badge risk-${level}`}>{RISK_ICONS[level]} {level}</span>
                  <span style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6 }}>{desc}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Diff Results */}
      {diffResult && diffResult.differences.length > 0 && (
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div className="card-title" style={{ marginBottom: 0 }}>Differences ({filtered.length})</div>
            <div style={{ display: "flex", gap: 6 }}>
              {["ALL", "HIGH", "MEDIUM", "LOW"].map(f => (
                <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-ghost"}`} onClick={() => setFilter(f)}>
                  {f} {f !== "ALL" && `(${diffResult.summary[f.toLowerCase() + "_risk"] || 0})`}
                </button>
              ))}
              <button className="btn btn-ghost btn-sm" onClick={() => {
                const all = {};
                filtered.forEach((_, i) => { all[i] = true; });
                setExpanded(all);
              }}>Expand All</button>
            </div>
          </div>
          <div className="diff-list">
            {filtered.map((diff, i) => (
              <DiffItem
                key={i}
                diff={diff}
                expanded={!!expanded[i]}
                onToggle={() => setExpanded(prev => ({ ...prev, [i]: !prev[i] }))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}