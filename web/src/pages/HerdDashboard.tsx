import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { useFarm } from "../api/FarmContext";
import type { AlertUrgency, DashboardData } from "../api/types";
import { StateBadge, UrgencyBadge } from "../components/Badges";

const URGENCY_ORDER: AlertUrgency[] = ["URGENT", "HIGH", "NORMAL", "LOW"];

export function HerdDashboard() {
  const { farm } = useFarm();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [runningJob, setRunningJob] = useState(false);

  const load = useCallback(() => {
    if (!farm) return;
    setLoading(true);
    api
      .getDashboard(farm.id)
      .then(setData)
      .finally(() => setLoading(false));
  }, [farm]);

  useEffect(load, [load]);

  async function resolve(id: string, status: "DONE" | "DISMISSED") {
    await api.resolveAlert(id, status);
    load();
  }

  async function runJob() {
    setRunningJob(true);
    try {
      await api.runReproductionJob();
      load();
    } finally {
      setRunningJob(false);
    }
  }

  if (!farm) return null;
  if (loading || !data) return <p>Loading…</p>;

  return (
    <div>
      <div className="quick-add-bar">
        <button onClick={runJob} disabled={runningJob}>
          {runningJob ? "Evaluating…" : "Run nightly evaluation now"}
        </button>
      </div>

      <div className="grid grid-cols-3" style={{ marginBottom: 16 }}>
        {data.herdCountsByBreedingState.map((c) => (
          <div className="stat-tile" key={c.breedingState}>
            <div className="value">{c.count}</div>
            <div className="label">
              <StateBadge state={c.breedingState} />
            </div>
          </div>
        ))}
        <div className="stat-tile">
          <div className="value">{data.totalPendingAlerts}</div>
          <div className="label">Pending Tasks</div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Today's Tasks</h3>
        {data.totalPendingAlerts === 0 ? (
          <p className="empty-state">Nothing pending — herd is caught up.</p>
        ) : (
          URGENCY_ORDER.map((urgency) => {
            const alerts = data.alertsByUrgency[urgency] ?? [];
            if (alerts.length === 0) return null;
            return (
              <div key={urgency} style={{ marginBottom: 12 }}>
                <UrgencyBadge urgency={urgency} />
                {alerts.map((alert) => (
                  <div className="alert-row" key={alert.id}>
                    <div className="message">
                      {alert.animal && (
                        <Link className="animal-link" to={`/animals/${alert.animal.id}`}>
                          {alert.animal.name ?? alert.animal.earTag}
                        </Link>
                      )}
                      {alert.message}
                      <div className="meta" style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        Due {new Date(alert.dueDate).toLocaleDateString()}
                      </div>
                    </div>
                    <div className="alert-actions">
                      <button onClick={() => resolve(alert.id, "DONE")}>Done</button>
                      <button onClick={() => resolve(alert.id, "DISMISSED")}>Dismiss</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
