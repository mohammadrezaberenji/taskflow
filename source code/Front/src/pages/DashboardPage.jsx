import { Link } from "react-router-dom";
import { getTaskStats, listTasks } from "../api/tasks";
import { DueDate, PriorityBadge, StatusBadge } from "../components/Badges";
import { EmptyState, ErrorState, Skeleton } from "../components/Feedback";
import Icon from "../components/Icon";
import { PageHeader } from "../components/Layout";
import { PRIORITY_OPTIONS, STATUS_OPTIONS } from "../constants";
import { useApi } from "../hooks/useApi";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { formatDate } from "../utils/dates";

async function loadDashboard(signal) {
  const [stats, recent, overdue] = await Promise.all([
    getTaskStats(signal),
    listTasks({ sort: "created_at", order: "desc", limit: 5 }, signal),
    listTasks({ overdue: true, sort: "due_date", order: "asc", limit: 5 }, signal),
  ]);
  return { stats, recent: recent.items, overdue: overdue.items };
}

function StatCard({ label, value, icon, tone, to, hint }) {
  return (
    <Link to={to} className={`stat-card stat-${tone}`}>
      <div className="stat-card-top">
        <span className="stat-label">{label}</span>
        <span className="stat-icon">
          <Icon name={icon} size={16} />
        </span>
      </div>
      <span className="stat-value">{value}</span>
      {hint && <span className="stat-hint">{hint}</span>}
    </Link>
  );
}

function TaskRowLink({ task, meta }) {
  return (
    <li>
      <Link to={`/tasks?task=${task.id}`} className="task-link">
        <div className="task-link-main">
          <span className="task-link-title">{task.title}</span>
          <span className="task-link-meta">{meta}</span>
        </div>
        <StatusBadge status={task.status} />
      </Link>
    </li>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard">
      <div className="stats-grid">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="stat-card">
            <Skeleton width="50%" />
            <Skeleton width="30%" height={28} />
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="card card-padded">
            <Skeleton width="40%" height={16} />
            <Skeleton height={12} />
            <Skeleton width="85%" height={12} />
            <Skeleton width="70%" height={12} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  useDocumentTitle("Dashboard");
  const { data, error, initialLoading, reload } = useApi(loadDashboard);

  const actions = (
    <Link to="/tasks?new=1" className="btn btn-primary">
      <Icon name="plus" size={16} />
      New task
    </Link>
  );

  let content;
  if (initialLoading) {
    content = <DashboardSkeleton />;
  } else if (error && !data) {
    content = <ErrorState title="Unable to load the dashboard" error={error} onRetry={reload} />;
  } else if (data.stats.total === 0) {
    content = (
      <div className="card">
        <EmptyState
          title="No tasks yet"
          message="Create your first task to start tracking your work. Statistics will appear here."
          action={actions}
        />
      </div>
    );
  } else {
    const { stats, recent, overdue } = data;
    content = (
      <>
        <div className="stats-grid">
          <StatCard label="Total tasks" value={stats.total} icon="layers" tone="neutral" to="/tasks" />
          <StatCard label="To do" value={stats.by_status.todo} icon="circle" tone="todo" to="/tasks?status=todo" />
          <StatCard
            label="In progress"
            value={stats.by_status.in_progress}
            icon="clock"
            tone="progress"
            to="/tasks?status=in_progress"
          />
          <StatCard
            label="Completed"
            value={stats.by_status.done}
            icon="checkCircle"
            tone="done"
            to="/tasks?status=done"
          />
          <StatCard
            label="Overdue"
            value={stats.overdue}
            icon="alert"
            tone={stats.overdue > 0 ? "danger" : "neutral"}
            to="/tasks?overdue=true"
            hint={stats.due_soon > 0 ? `${stats.due_soon} due in the next 7 days` : undefined}
          />
        </div>

        <div className="dashboard-grid">
          <section className="card card-padded">
            <div className="card-header">
              <h2 className="card-title">Completion</h2>
            </div>
            <div className="completion">
              <span className="completion-value">{stats.completion_rate}%</span>
              <span className="text-muted">
                {stats.by_status.done} of {stats.total} tasks completed
              </span>
            </div>
            <div
              className="stacked-bar"
              role="img"
              aria-label={STATUS_OPTIONS.map((o) => `${o.label}: ${stats.by_status[o.value]}`).join(", ")}
            >
              {STATUS_OPTIONS.map((option) =>
                stats.by_status[option.value] > 0 ? (
                  <span
                    key={option.value}
                    className={`stacked-bar-segment status-fill-${option.value}`}
                    style={{ width: `${(stats.by_status[option.value] / stats.total) * 100}%` }}
                  />
                ) : null,
              )}
            </div>
            <ul className="legend">
              {STATUS_OPTIONS.map((option) => (
                <li key={option.value}>
                  <span className={`legend-swatch status-fill-${option.value}`} />
                  <span className="legend-label">{option.label}</span>
                  <span className="legend-value">{stats.by_status[option.value]}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="card card-padded">
            <div className="card-header">
              <h2 className="card-title">By priority</h2>
            </div>
            <ul className="bar-list">
              {[...PRIORITY_OPTIONS].reverse().map((option) => {
                const count = stats.by_priority[option.value];
                return (
                  <li key={option.value}>
                    <Link to={`/tasks?priority=${option.value}`} className="bar-list-row">
                      <PriorityBadge priority={option.value} />
                      <span className="bar-track">
                        <span
                          className={`bar-fill priority-fill-${option.value}`}
                          style={{ width: `${stats.total ? (count / stats.total) * 100 : 0}%` }}
                        />
                      </span>
                      <span className="bar-value">{count}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="card">
            <div className="card-header card-header-padded">
              <h2 className="card-title">Recent tasks</h2>
              <Link to="/tasks" className="link">
                View all
              </Link>
            </div>
            <ul className="task-links">
              {recent.map((task) => (
                <TaskRowLink
                  key={task.id}
                  task={task}
                  meta={
                    <>
                      <PriorityBadge priority={task.priority} />
                      <span>Created {formatDate(task.created_at)}</span>
                    </>
                  }
                />
              ))}
            </ul>
          </section>

          <section className="card">
            <div className="card-header card-header-padded">
              <h2 className="card-title">Needs attention</h2>
              {stats.overdue > 0 && (
                <Link to="/tasks?overdue=true" className="link">
                  View overdue
                </Link>
              )}
            </div>
            {overdue.length === 0 ? (
              <EmptyState icon="checkCircle" title="You're all caught up" message="No overdue tasks." />
            ) : (
              <ul className="task-links">
                {overdue.map((task) => (
                  <TaskRowLink
                    key={task.id}
                    task={task}
                    meta={<DueDate dueDate={task.due_date} status={task.status} />}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </>
    );
  }

  return (
    <div className="page">
      <PageHeader title="Dashboard" description="Overview of your team's tasks and progress." actions={actions} />
      {content}
    </div>
  );
}
