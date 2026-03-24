import React, { useState, useEffect } from "react";
import { FileCheck, Download, CheckCircle, XCircle, AlertCircle, Sparkles, FileText } from "lucide-react";
import toast from "react-hot-toast";
import { generateConfirmation, exportConfirmation, getAllTemplates, getTradeTypes } from "../utils/api";

const TRADE_FIELDS = {
  fx_spot: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "currency_pair", label: "Currency Pair", type: "text", placeholder: "USD/EUR" },
    { key: "notional_amount", label: "Notional Amount", type: "number" },
    { key: "notional_currency", label: "Notional Currency", type: "text", placeholder: "USD" },
    { key: "exchange_rate", label: "Exchange Rate", type: "number" },
    { key: "trade_date", label: "Trade Date", type: "date" },
    { key: "settlement_date", label: "Settlement Date", type: "text", placeholder: "T+2" },
    { key: "buyer", label: "Buyer", type: "text" },
    { key: "seller", label: "Seller", type: "text" },
    { key: "jurisdiction", label: "Jurisdiction", type: "text" },
  ],
  fx_forward: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "currency_pair", label: "Currency Pair", type: "text" },
    { key: "notional_amount", label: "Notional Amount", type: "number" },
    { key: "forward_rate", label: "Forward Rate", type: "number" },
    { key: "trade_date", label: "Trade Date", type: "date" },
    { key: "value_date", label: "Value Date", type: "date" },
    { key: "tenor", label: "Tenor", type: "text", placeholder: "3M / 6M / 1Y" },
    { key: "jurisdiction", label: "Jurisdiction", type: "text" },
  ],
  interest_rate_swap: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "notional_amount", label: "Notional Amount", type: "number" },
    { key: "notional_currency", label: "Currency", type: "text", placeholder: "USD" },
    { key: "fixed_rate", label: "Fixed Rate (%)", type: "number" },
    { key: "floating_rate_benchmark", label: "Floating Rate Benchmark", type: "select", options: ["SOFR", "EURIBOR", "SONIA", "HIBOR"] },
    { key: "spread", label: "Spread (%)", type: "number" },
    { key: "effective_date", label: "Effective Date", type: "date" },
    { key: "termination_date", label: "Termination Date", type: "date" },
    { key: "tenor", label: "Tenor", type: "text", placeholder: "5Y" },
    { key: "fixed_rate_payer", label: "Fixed Rate Payer", type: "text" },
    { key: "floating_rate_payer", label: "Floating Rate Payer", type: "text" },
    { key: "payment_frequency", label: "Payment Frequency", type: "select", options: ["Monthly", "Quarterly", "Semi-Annual", "Annual"] },
  ],
  equity_trade: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "security_name", label: "Security Name", type: "text" },
    { key: "ticker", label: "Ticker", type: "text" },
    { key: "isin", label: "ISIN", type: "text" },
    { key: "number_of_shares", label: "Number of Shares", type: "number" },
    { key: "price_per_share", label: "Price per Share", type: "number" },
    { key: "total_consideration", label: "Total Consideration", type: "number" },
    { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
    { key: "trade_date", label: "Trade Date", type: "date" },
    { key: "settlement_date", label: "Settlement Date", type: "date" },
    { key: "buyer", label: "Buyer", type: "text" },
    { key: "seller", label: "Seller", type: "text" },
  ],
  bond_trade: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "issuer", label: "Issuer", type: "text" },
    { key: "bond_name", label: "Bond Name", type: "text" },
    { key: "isin", label: "ISIN", type: "text" },
    { key: "face_value", label: "Face Value", type: "number" },
    { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
    { key: "coupon_rate", label: "Coupon Rate (%)", type: "number" },
    { key: "yield", label: "Yield (%)", type: "number" },
    { key: "clean_price", label: "Clean Price", type: "number" },
    { key: "maturity_date", label: "Maturity Date", type: "date" },
    { key: "trade_date", label: "Trade Date", type: "date" },
    { key: "settlement_date", label: "Settlement Date", type: "date" },
    { key: "buyer", label: "Buyer", type: "text" },
    { key: "seller", label: "Seller", type: "text" },
  ],
  credit_default_swap: [
    { key: "counterparty", label: "Counterparty", type: "text" },
    { key: "reference_entity", label: "Reference Entity", type: "text" },
    { key: "reference_obligation", label: "Reference Obligation", type: "text" },
    { key: "notional_amount", label: "Notional Amount", type: "number" },
    { key: "currency", label: "Currency", type: "text", placeholder: "USD" },
    { key: "premium_rate", label: "Premium Rate (%)", type: "number" },
    { key: "trade_date", label: "Trade Date", type: "date" },
    { key: "effective_date", label: "Effective Date", type: "date" },
    { key: "scheduled_termination_date", label: "Termination Date", type: "date" },
    { key: "tenor", label: "Tenor", type: "text", placeholder: "5Y" },
    { key: "protection_buyer", label: "Protection Buyer", type: "text" },
    { key: "protection_seller", label: "Protection Seller", type: "text" },
    { key: "payment_frequency", label: "Payment Frequency", type: "select", options: ["Monthly", "Quarterly", "Semi-Annual"] },
    { key: "settlement_method", label: "Settlement Method", type: "select", options: ["Auction Settlement", "Cash Settlement", "Physical Settlement"] },
  ],
};

function ValidationRow({ result }) {
  const icon = result.status === "APPROVED"
    ? <CheckCircle size={14} style={{ color: "var(--green)" }} />
    : result.status === "NEAR_MATCH"
    ? <AlertCircle size={14} style={{ color: "var(--amber)" }} />
    : <XCircle size={14} style={{ color: "var(--red)" }} />;
  return (
    <div className="validation-row">
      <div className="validation-icon">{icon}</div>
      <div>
        <div className="validation-clause">{result.clause.replace(/_/g, " ")}</div>
        <div className="validation-msg">{result.message}</div>
        {result.best_match_score != null && (
          <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginTop: 2 }}>
            Match score: {(result.best_match_score * 100).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  );
}

export default function Generator() {
  const [tradeType, setTradeType] = useState("fx_spot");
  const [tradeTypes, setTradeTypes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [formData, setFormData] = useState({});
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(null);
  const [activeTab, setActiveTab] = useState("confirmation");

  useEffect(() => {
    getTradeTypes().then(r => setTradeTypes(r.data.trade_types)).catch(() => {});
    getAllTemplates().then(r => setTemplates(r.data.templates)).catch(() => {});
    const saved = localStorage.getItem("selectedTemplate");
    if (saved) {
      try {
        const t = JSON.parse(saved);
        setSelectedTemplateId(t.id);
        setTradeType(t.trade_type);
      } catch {}
    }
  }, []);

  const fields = TRADE_FIELDS[tradeType] || [];
  const templateOptions = templates.filter(t => !tradeType || t.trade_type === tradeType);

  const handleGenerate = async () => {
    const template = templates.find(t => t.id === selectedTemplateId);
    if (!template) { toast.error("Select a base template"); return; }
    const tradeData = { trade_type: tradeType, ...formData };
    setLoading(true);
    try {
      const r = await generateConfirmation(tradeData, template);
      setResult(r.data);
      toast.success("Confirmation generated!");
      localStorage.setItem("generatedConfirmation", JSON.stringify(r.data.confirmation));
    } catch (e) {
      toast.error(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  };

  const handleExport = async (format) => {
    if (!result?.confirmation) return;
    setExporting(format);
    try {
      await exportConfirmation(result.confirmation, format);
      toast.success(`Downloaded as ${format.toUpperCase()}`);
    } catch (e) {
      toast.error("Export failed: " + (e.response?.data?.detail || e.message));
    } finally { setExporting(null); }
  };

  return (
    <div className="page">
      <div className="page-header">
        <div className="iter-badge"><Sparkles size={12} /> Iteration 3</div>
        <div className="page-title">Confirmation Generator</div>
        <div className="page-sub">AI-powered pre-population with approved clause library validation</div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24, alignItems: "start" }}>
        {/* Form */}
        <div className="card">
          <div className="card-title">Trade Details</div>
          <div className="form-row" style={{ marginBottom: 16 }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Trade Type</label>
              <select className="form-select" value={tradeType} onChange={e => { setTradeType(e.target.value); setFormData({}); setSelectedTemplateId(""); }}>
                {tradeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label">Base Template</label>
              <select className="form-select" value={selectedTemplateId} onChange={e => setSelectedTemplateId(e.target.value)}>
                <option value="">— Select template —</option>
                {templateOptions.map(t => <option key={t.id} value={t.id}>{t.id} · {t.counterparty}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 14px" }}>
            {fields.map(field => (
              <div key={field.key} className="form-group">
                <label className="form-label">{field.label}</label>
                {field.type === "select" ? (
                  <select
                    className="form-select"
                    value={formData[field.key] || ""}
                    onChange={e => setFormData(p => ({ ...p, [field.key]: e.target.value }))}
                  >
                    <option value="">— Select —</option>
                    {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    className="form-input"
                    type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
                    placeholder={field.placeholder || ""}
                    value={formData[field.key] || ""}
                    onChange={e => setFormData(p => ({
                      ...p,
                      [field.key]: field.type === "number" ? parseFloat(e.target.value) || "" : e.target.value
                    }))}
                  />
                )}
              </div>
            ))}
          </div>

          <button
            className="btn btn-primary"
            style={{ width: "100%", marginTop: 8 }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? <><div className="spinner" /> Generating with AI…</> : <><Sparkles size={15} /> Generate Confirmation</>}
          </button>
        </div>

        {/* Result */}
        <div>
          {result ? (
            <div className="card">
              {/* Export buttons */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => handleExport("pdf")} disabled={!!exporting}>
                  {exporting === "pdf" ? <div className="spinner" /> : <Download size={14} />} PDF
                </button>
                <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => handleExport("docx")} disabled={!!exporting}>
                  {exporting === "docx" ? <div className="spinner" /> : <FileText size={14} />} DOCX
                </button>
              </div>

              {/* Compliance summary */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                <div style={{
                  flex: 1, background: result.validation.overall_status === "PASS" ? "var(--green-bg)" : "var(--amber-bg)",
                  borderRadius: "var(--radius)", padding: "12px 14px",
                  border: `1px solid ${result.validation.overall_status === "PASS" ? "rgba(16,185,129,0.3)" : "rgba(245,158,11,0.3)"}`
                }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>COMPLIANCE</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: result.validation.overall_status === "PASS" ? "var(--green)" : "var(--amber)" }}>
                    {result.validation.compliance_rate}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>{result.validation.overall_status}</div>
                </div>
                <div style={{ flex: 1, background: "var(--bg-elevated)", borderRadius: "var(--radius)", padding: "12px 14px", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>FIELD COMPLETENESS</div>
                  <div style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 22, color: "var(--accent)" }}>
                    {result.field_validation?.completeness_pct || 0}%
                  </div>
                  <div style={{ fontSize: 11.5, color: "var(--text-secondary)" }}>
                    {result.field_validation?.missing_fields?.length === 0 ? "All fields present" : `${result.field_validation?.missing_fields?.length} missing`}
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="tabs">
                <button className={`tab ${activeTab === "confirmation" ? "active" : ""}`} onClick={() => setActiveTab("confirmation")}>Confirmation</button>
                <button className={`tab ${activeTab === "clauses" ? "active" : ""}`} onClick={() => setActiveTab("clauses")}>Clauses</button>
                <button className={`tab ${activeTab === "validation" ? "active" : ""}`} onClick={() => setActiveTab("validation")}>Validation</button>
              </div>

              {activeTab === "confirmation" && (
                <div>
                  {result.confirmation.generated_narrative && (
                    <div style={{ padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", marginBottom: 14, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7, borderLeft: "3px solid var(--accent)" }}>
                      {result.confirmation.generated_narrative}
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
                    {Object.entries(result.confirmation)
                      .filter(([k]) => !["clauses", "generated_narrative", "compliance_notes"].includes(k) && result.confirmation[k] != null)
                      .map(([k, v]) => (
                        <div key={k} style={{ background: "var(--bg-elevated)", borderRadius: 7, padding: "8px 12px", border: "1px solid var(--border)" }}>
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 2 }}>{k.replace(/_/g, " ").toUpperCase()}</div>
                          <div style={{ fontSize: 12.5, color: "var(--text-primary)" }}>{String(v)}</div>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {activeTab === "clauses" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.entries(result.confirmation.clauses || {}).map(([k, v]) => (
                    <div key={k} style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius)", padding: "12px 14px", border: "1px solid var(--border)" }}>
                      <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 6, textTransform: "uppercase" }}>{k.replace(/_/g, " ")}</div>
                      <div style={{ fontSize: 12.5, color: "var(--text-secondary)", lineHeight: 1.7 }}>{v}</div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "validation" && (
                <div>
                  {result.validation.clause_results.map((r, i) => (
                    <ValidationRow key={i} result={r} />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card">
              <div className="card-title">Generation Process</div>
              {[
                { step: "1", title: "Fill trade details", desc: "Enter all relevant fields for your specific trade on the left." },
                { step: "2", title: "AI fills clauses", desc: "Claude selects the best matching approved clause for each legal field." },
                { step: "3", title: "Compliance validation", desc: "System validates all clauses against the approved library (≥95% accuracy target)." },
                { step: "4", title: "Download document", desc: "Export your ready-to-send confirmation as PDF or DOCX." },
              ].map(({ step, title, desc }) => (
                <div key={step} style={{ display: "flex", gap: 14, marginBottom: 16 }}>
                  <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{step}</div>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, fontSize: 13.5 }}>{title}</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.6 }}>{desc}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}