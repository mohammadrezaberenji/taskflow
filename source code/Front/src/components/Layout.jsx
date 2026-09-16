import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { getHealth } from "../api/tasks";
import academyLogo from "../assets/hamrah-academy-logo.png";
import Icon from "./Icon";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/tasks", label: "Tasks", icon: "tasks" },
  { to: "/status", label: "System status", icon: "activity" },
];

const HEALTH_POLL_MS = 30000;

function ApiStatus() {
  const [state, setState] = useState("checking");

  const check = useCallback(async (signal) => {
    try {
      const health = await getHealth(signal);
      setState(health.status === "ok" ? "ok" : "degraded");
    } catch {
      if (!signal.aborted) setState("down");
    }
  }, []);

  useEffect(() => {
    let controller = new AbortController();
    check(controller.signal);
    const timer = setInterval(() => {
      controller.abort();
      controller = new AbortController();
      check(controller.signal);
    }, HEALTH_POLL_MS);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [check]);

  const labels = {
    checking: "Checking API…",
    ok: "All systems operational",
    degraded: "Degraded performance",
    down: "API unreachable",
  };

  return (
    <NavLink to="/status" className={`api-status api-status-${state}`}>
      <span className="api-status-dot" aria-hidden="true" />
      {labels[state]}
    </NavLink>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  // Close the mobile navigation after navigating
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className={`app-shell ${menuOpen ? "menu-open" : ""}`}>
      <header className="topbar">
        <button
          type="button"
          className="icon-btn topbar-menu"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={menuOpen}
          aria-controls="sidebar"
        >
          <Icon name={menuOpen ? "close" : "menu"} size={20} />
        </button>
        <span className="brand brand-compact">
          <span className="brand-mark">
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
          TaskFlow
        </span>
        <img className="topbar-academy-logo" src={academyLogo} alt="Hamrah Academy" />
      </header>

      <aside id="sidebar" className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="check" size={14} strokeWidth={3} />
          </span>
          TaskFlow
        </div>
        <nav className="nav" aria-label="Main navigation">
          <span className="nav-heading">Workspace</span>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            >
              <Icon name={item.icon} size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div className="academy">
            <img className="academy-logo" src={academyLogo} alt="Hamrah Academy logo" />
            <div className="academy-text">
              <span className="academy-name">Hamrah Academy</span>
              <span className="academy-name-fa" lang="fa" dir="rtl">
                همراه آکادمی
              </span>
            </div>
          </div>
          <ApiStatus />
        </div>
      </aside>
      <div className="sidebar-overlay" onClick={() => setMenuOpen(false)} aria-hidden="true" />

      <main className="main">
        <div className="main-content">
          <Outlet />
        </div>
        <footer className="app-footer">
          <span>
            TaskFlow · Hamrah Academy DevOps Bootcamp ·{" "}
            <span lang="fa" dir="rtl">
              همراه آکادمی
            </span>
          </span>
          <span>Developed by Mentors</span>
        </footer>
      </main>
    </div>
  );
}

export function PageHeader({ title, description, actions }) {
  return (
    <div className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-description">{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  );
}
