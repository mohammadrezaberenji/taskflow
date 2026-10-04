import { useEffect, useState } from "react";
import { getHealth } from "../api/tasks";
import { ErrorState, Skeleton, Spinner } from "../components/Feedback";
import Icon from "../components/Icon";
import { PageHeader } from "../components/Layout";
import { useApi } from "../hooks/useApi";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const REFRESH_MS = 10000;

const STATUS_TEXT = {
  ok: { label: "Operational", tone: "ok" },
  degraded: { label: "Degraded", tone: "warning" },
  error: { label: "Unavailable", tone: "danger" },
  disabled: { label: "Not configured", tone: "muted" },
};

function StatusPill({ value }) {
  const { label, tone } = STATUS_TEXT[value] || { label: value, tone: "muted" };
  return (
    <span className={`status-pill status-pill-${tone}`}>
      <span className="api-status-dot" aria-hidden="true" />
      {label}
    </span>
  );
}

function ComponentCard({ icon, name, description, value }) {
  return (
    <div className="card card-padded component-card">
      <div className="component-icon">
        <Icon name={icon} size={20} />
      </div>
      <div className="component-body">
        <h3 className="component-name">{name}</h3>
        <p className="text-muted component-description">{description}</p>
      </div>
      <StatusPill value={value} />
    </div>
  );
}

export default function SystemStatusPage() {
  useDocumentTitle("System status");
  const { data, error, loading, initialLoading, reload } = useApi(getHealth);
  const [checkedAt, setCheckedAt] = useState(null);

  useEffect(() => {
    if (!loading) setCheckedAt(new Date());
  }, [loading]);

  useEffect(() => {
    const timer = setInterval(reload, REFRESH_MS);
    return () => clearInterval(timer);
  }, [reload]);

  const actions = (
    <button type="button" className="btn btn-secondary" onClick={reload} disabled={loading}>
      {loading ? <Spinner /> : <Icon name="refresh" size={16} />}
      Refresh
    </button>
  );

  let content;
  if (initialLoading) {
    content = (
      <div className="status-grid" aria-busy="true">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="card card-padded">
            <Skeleton width="40%" height={16} />
            <Skeleton width="70%" />
          </div>
        ))}
      </div>
    );
  } else if (error) {
    content = (
      <>
        <div className="card card-padded component-card">
          <div className="component-icon">
            <Icon name="server" size={20} />
          </div>
          <div className="component-body">
            <h3 className="component-name">Backend API</h3>
            <p className="text-muted component-description">FastAPI service</p>
          </div>
          <StatusPill value="error" />
        </div>
        <ErrorState title="Server unavailable" error={error} onRetry={reload} />
      </>
    );
  } else {
    content = (
      <>
        <div className={`status-banner status-banner-${data.status === "ok" ? "ok" : "warning"}`}>
          <Icon name={data.status === "ok" ? "checkCircle" : "alert"} size={20} />
          <div>
            <strong>{data.status === "ok" ? "All systems operational" : "Some components are degraded"}</strong>
            <p>
              Version {data.version} · served by <code>{data.instance}</code>
            </p>
          </div>
        </div>
        <div className="status-grid">
          <ComponentCard icon="server" name="Backend API" description="FastAPI service" value="ok" />
          <ComponentCard
            icon="database"
            name="PostgreSQL"
            description="Primary data store"
            value={data.checks?.database}
          />
          <ComponentCard icon="layers" name="Redis" description="Cache layer" value={data.checks?.redis} />
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <PageHeader
        title="System status"
        description={
          checkedAt
            ? `Health of the application components. Last checked ${checkedAt.toLocaleTimeString()}.`
            : "Health of the application components."
        }
        actions={actions}
      />
      {content}
      <section className="card card-padded probe-info">
        <h2 className="card-title">Health endpoints</h2>
        <ul className="probe-list">
          <li>
            <code>GET /health</code>
            <span>Overall status including PostgreSQL and Redis.</span>
          </li>
          <li>
            <code>GET /health/live</code>
            <span>Liveness: the process is running (no dependency checks).</span>
          </li>
          <li>
            <code>GET /health/ready</code>
            <span>Readiness: returns 503 while PostgreSQL is unreachable.</span>
          </li>
        </ul>
      </section>
    </div>
  );
}
