import React from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import {
  LayoutDashboard, Search, GitCompare, FileCheck, ChevronRight,
  Activity, Layers
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import TemplateSearch from "./pages/TemplateSearch";
import DiffViewer from "./pages/DiffViewer";
import Generator from "./pages/Generator";
import "./index.css";

const NAV_ITEMS = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { to: "/search", icon: Search, label: "Template Search", tag: "Iter 1" },
  { to: "/diff", icon: GitCompare, label: "Diff Viewer", tag: "Iter 2" },
  { to: "/generate", icon: FileCheck, label: "Generator", tag: "Iter 3" },
];

function Sidebar() {
  const location = useLocation();
  return (
    <aside className="sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon"><Layers size={22} /></div>
        <div>
          <div className="brand-name">TradeConfirm AI</div>
          <div className="brand-sub">v1.0 · Virtusa</div>
        </div>
      </div>
      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, icon: Icon, label, tag, exact }) => {
          const active = exact ? location.pathname === to : location.pathname.startsWith(to);
          return (
            <NavLink key={to} to={to} className={`nav-item ${active ? "active" : ""}`}>
              <Icon size={17} />
              <span className="nav-label">{label}</span>
              {tag && <span className="nav-tag">{tag}</span>}
              {active && <ChevronRight size={14} className="nav-arrow" />}
            </NavLink>
          );
        })}
      </nav>
      <div className="sidebar-footer">
        <div className="status-dot" />
        <span>System Online</span>
      </div>
    </aside>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        <Sidebar />
        <main className="app-main">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/search" element={<TemplateSearch />} />
            <Route path="/diff" element={<DiffViewer />} />
            <Route path="/generate" element={<Generator />} />
          </Routes>
        </main>
      </div>
      <Toaster position="top-right" toastOptions={{ style: { background: "#1a2235", color: "#e2e8f0", border: "1px solid #2d3f5e" } }} />
    </BrowserRouter>
  );
}