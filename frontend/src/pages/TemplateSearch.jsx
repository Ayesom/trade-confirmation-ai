import React, { useState, useCallback, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { Search, Upload, FileText, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";
import { searchTemplates, searchByFile, getTradeTypes } from "../utils/api";

const SCORE_COLOR = (s) => s >= 85 ? "var(--green)" : s >= 65 ? "var(--amber)" : "var(--red)";

function TemplateCard({ result, onSelect, selected }) {
  const { template, similarity_score, rank } = result;
  return (
    <div className={`template-card ${selected ? "selected" : ""}`} onClick={() => onSelect(result)}>
      <div className="template-rank">#{rank}</div>
      <div className="template-score" style={{ color: SCORE_COLOR(similarity_score) }}>
        {similarity_score.toFixed(1)}<span>%</span>
      </div>
      <div style={{ marginTop: 8 }}>
        <div className="template-id">{template.id}</div>
        <div className="template-type">{template.trade_type_label}</div>
        <div className="template-counterparty">↔ {template.counterparty}</div>
        <div className="template-desc">{template.description}</div>
        <div className="template-tags">
          {template.jurisdiction && <span className="template-tag">{template.jurisdiction}</span>}
          {template.tenor && <span className="template-tag">{template.tenor}</span>}
          {template.currency_pair && <span className="template-tag">{template.currency_pair}</span>}
          {template.floating_rate_benchmark && <span className="template-tag">{template.floating_rate_benchmark}</span>}
          <span className="template-tag">v{template.version}</span>
        </div>
      </div>
      {selected && (
        <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, color: "var(--accent)", fontSize: 12.5, fontWeight: 500 }}>
          <ChevronRight size={14} /> Selected for comparison
        </div>
      )}
    </div>
  );
}

export default function TemplateSearch({ onTemplateSelected }) {
  const [mode, setMode] = useState("text");
  const [query, setQuery] = useState("");
  const [tradeType, setTradeType] = useState("");
  const [topK, setTopK] = useState(3);
  const [tradeTypes, setTradeTypes] = useState([]);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [uploadedFile, setUploadedFile] = useState(null);
  const [extractedFields, setExtractedFields] = useState(null);

  useEffect(() => {
    getTradeTypes().then(r => setTradeTypes(r.data.trade_types)).catch(() => {});
  }, []);

  const handleSearch = async () => {
    if (!query.trim()) { toast.error("Enter a search query"); return; }
    setLoading(true);
    try {
      const r = await searchTemplates(query, tradeType || null, topK);
      setResults(r.data.results);
      if (r.data.results.length === 0) toast("No templates found. Try a broader query.", { icon: "🔍" });
    } catch (e) {
      toast.error("Search failed: " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  };

  const onDrop = useCallback(async (files) => {
    const file = files[0];
    if (!file) return;
    setUploadedFile(file);
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("top_k", topK);
      const r = await searchByFile(fd);
      setResults(r.data.results);
      setExtractedFields(r.data.extracted_fields);
      if (r.data.detected_trade_type) {
        toast.success(`Detected: ${r.data.detected_trade_type.replace(/_/g, " ")}`);
      }
    } catch (e) {
      toast.error("File search failed: " + (e.response?.data?.detail || e.message));
    } finally { setLoading(false); }
  }, [topK]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"]
    },
    maxFiles: 1
  });

  return (
    <div className="page">
      <div className="page-header">
        <div className="iter-badge"><Search size={12} /> Iteration 1</div>
        <div className="page-title">Template Search</div>
        <div className="page-sub">Semantic retrieval of the most relevant trade confirmation templates using embeddings</div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24, alignItems: "start" }}>
        {/* Search Panel */}
        <div className="card">
          <div className="tabs">
            <button className={`tab ${mode === "text" ? "active" : ""}`} onClick={() => setMode("text")}>Text Search</button>
            <button className={`tab ${mode === "file" ? "active" : ""}`} onClick={() => setMode("file")}>Upload File</button>
          </div>

          {mode === "text" ? (
            <>
              <div className="form-group">
                <label className="form-label">Search Query</label>
                <textarea
                  className="form-textarea"
                  placeholder="e.g. USD EUR spot trade with Deutsche Bank, England jurisdiction, 5 million notional..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && e.ctrlKey && handleSearch()}
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Trade Type Filter</label>
                  <select className="form-select" value={tradeType} onChange={e => setTradeType(e.target.value)}>
                    <option value="">All Types</option>
                    {tradeTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Results (Top K)</label>
                  <select className="form-select" value={topK} onChange={e => setTopK(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>Top {n}</option>)}
                  </select>
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleSearch} disabled={loading} style={{ width: "100%" }}>
                {loading ? <><div className="spinner" /> Searching…</> : <><Search size={15} /> Search Templates</>}
              </button>
            </>
          ) : (
            <>
              <div {...getRootProps()} className={`dropzone ${isDragActive ? "active" : ""}`}>
                <input {...getInputProps()} />
                <div className="dropzone-icon"><Upload size={32} /></div>
                <div className="dropzone-text">{uploadedFile ? uploadedFile.name : "Drop your trade document here"}</div>
                <div className="dropzone-sub">PDF or DOCX · System auto-detects trade type</div>
              </div>
              {extractedFields && Object.keys(extractedFields).length > 0 && (
                <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--bg-elevated)", borderRadius: "var(--radius)", border: "1px solid var(--border)" }}>
                  <div style={{ fontSize: 11.5, fontFamily: "var(--font-mono)", color: "var(--text-muted)", marginBottom: 8 }}>EXTRACTED FIELDS</div>
                  {Object.entries(extractedFields).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, paddingBottom: 4 }}>
                      <span style={{ color: "var(--text-secondary)" }}>{k.replace(/_/g, " ")}</span>
                      <span style={{ color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Instructions */}
        <div className="card">
          <div className="card-title">How It Works</div>
          {[
            { step: "1", title: "Describe your trade", desc: "Enter natural language describing the trade — counterparty, type, currency, jurisdiction, etc." },
            { step: "2", title: "Semantic matching", desc: "The system uses sentence embeddings to find the most semantically similar templates, not just keyword matches." },
            { step: "3", title: "Select a template", desc: "Review ranked results with similarity scores. Select the best match to proceed to Diff Viewer." },
          ].map(({ step, title, desc }) => (
            <div key={step} style={{ display: "flex", gap: 14, marginBottom: 18 }}>
              <div style={{ width: 28, height: 28, borderRadius: 8, background: "var(--accent-glow)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--accent)", fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 13, flexShrink: 0 }}>{step}</div>
              <div>
                <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 3, fontSize: 13.5 }}>{title}</div>
                <div style={{ color: "var(--text-muted)", fontSize: 12.5, lineHeight: 1.6 }}>{desc}</div>
              </div>
            </div>
          ))}
          <div className="divider" />
          <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            Model: all-MiniLM-L6-v2 · Vector DB: ChromaDB
          </div>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 600 }}>
              {results.length} Template{results.length > 1 ? "s" : ""} Found
            </div>
            {selectedTemplate && (
              <div style={{ display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12.5, color: "var(--text-muted)", alignSelf: "center" }}>
                  Selected: <span style={{ color: "var(--accent)" }}>{selectedTemplate.template.id}</span>
                </span>
                <a href="/diff" className="btn btn-primary btn-sm">
                  <ChevronRight size={14} /> Go to Diff Viewer
                </a>
              </div>
            )}
          </div>
          <div className="template-grid">
            {results.map((r) => (
              <TemplateCard
                key={r.template.id}
                result={r}
                selected={selectedTemplate?.template.id === r.template.id}
                onSelect={(res) => {
                  setSelectedTemplate(res);
                  localStorage.setItem("selectedTemplate", JSON.stringify(res.template));
                  toast.success(`Selected: ${res.template.id}`);
                  if (onTemplateSelected) onTemplateSelected(res.template);
                }}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="empty-state">
          <FileText size={40} className="empty-state-icon" />
          <div className="empty-state-text">Search for templates using text or upload a trade document to begin</div>
        </div>
      )}
    </div>
  );
}