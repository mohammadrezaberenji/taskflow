import Icon from "./Icon";

export function Spinner({ size = 16, label }) {
  return (
    <span className="spinner" role={label ? "status" : undefined} aria-label={label}>
      <Icon name="loader" size={size} />
    </span>
  );
}

export function Skeleton({ width = "100%", height = 14, className = "" }) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}

export function EmptyState({ icon = "inbox", title, message, action }) {
  return (
    <div className="state">
      <div className="state-icon">
        <Icon name={icon} size={22} />
      </div>
      <h3 className="state-title">{title}</h3>
      {message && <p className="state-message">{message}</p>}
      {action && <div className="state-action">{action}</div>}
    </div>
  );
}

export function ErrorState({ title = "Something went wrong", error, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <div className="state-icon">
        <Icon name="alert" size={22} />
      </div>
      <h3 className="state-title">{title}</h3>
      <p className="state-message">{error?.message || "Please try again."}</p>
      {onRetry && (
        <div className="state-action">
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            <Icon name="refresh" size={16} />
            Try again
          </button>
        </div>
      )}
    </div>
  );
}
