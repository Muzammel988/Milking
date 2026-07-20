import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useFarm } from "../api/FarmContext";
import type { BreedingEventType, ProfitabilityRow } from "../api/types";
import { BarChart, TrendChart } from "../components/charts";

type Tab = "status" | "exits" | "lactation" | "breeding" | "profitability";

const TABS: { id: Tab; label: string }[] = [
  { id: "status", label: "Herd Status" },
  { id: "exits", label: "Exit Reasons" },
  { id: "lactation", label: "Lactation Curve" },
  { id: "breeding", label: "Breeding History" },
  { id: "profitability", label: "Profitability" },
];

export function Reports() {
  const { farm } = useFarm();
  const [tab, setTab] = useState<Tab>("status");

  if (!farm) return null;

  return (
    <div>
      <div className="report-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "status" && <StatusDistribution farmId={farm.id} />}
      {tab === "exits" && <ExitReasons farmId={farm.id} />}
      {tab === "lactation" && <LactationCurve farmId={farm.id} />}
      {tab === "breeding" && <BreedingHistory farmId={farm.id} />}
      {tab === "profitability" && <Profitability farmId={farm.id} />}
    </div>
  );
}

function StatusDistribution({ farmId }: { farmId: string }) {
  const [data, setData] = useState<{ status: string; count: number }[] | null>(null);
  useEffect(() => {
    api.getStatusDistribution(farmId).then(setData);
  }, [farmId]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Herd Status Distribution</h3>
      {!data ? <p>Loading…</p> : data.length === 0 ? <p className="empty-state">No animals yet.</p> : (
        <BarChart data={data.map((d) => ({ label: d.status, value: d.count }))} />
      )}
    </div>
  );
}

function ExitReasons({ farmId }: { farmId: string }) {
  const [data, setData] = useState<{ exitReason: string; count: number }[] | null>(null);
  useEffect(() => {
    api.getExitReasons(farmId).then(setData);
  }, [farmId]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Herd Exit Reasons</h3>
      {!data ? <p>Loading…</p> : data.length === 0 ? (
        <p className="empty-state">No animals have exited the herd yet.</p>
      ) : (
        <BarChart data={data.map((d) => ({ label: d.exitReason, value: d.count }))} />
      )}
    </div>
  );
}

function LactationCurve({ farmId }: { farmId: string }) {
  const [data, setData] = useState<{ dimBucketStart: number; avgYieldLiters: number }[] | null>(null);
  useEffect(() => {
    api.getLactationCurve(farmId).then(setData);
  }, [farmId]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Herd Lactation Curve</h3>
      <p className="meta">Average total daily yield per animal, bucketed by days in milk (10-day buckets).</p>
      {!data ? (
        <p>Loading…</p>
      ) : (
        <TrendChart
          points={data.map((d) => ({ x: d.dimBucketStart, y: d.avgYieldLiters }))}
          xLabel="Days in milk"
          yLabel="Liters/day"
        />
      )}
    </div>
  );
}

const BREEDING_TYPES: BreedingEventType[] = [
  "HEAT_OBSERVED",
  "SYNCHRONIZATION_STEP",
  "INSEMINATION",
  "PREGNANCY_CHECK",
  "CALVING",
  "DRY_OFF",
  "ABORTION",
];

function BreedingHistory({ farmId }: { farmId: string }) {
  const [type, setType] = useState<string>("");
  const [rows, setRows] = useState<Awaited<ReturnType<typeof api.getBreedingHistory>> | null>(null);

  useEffect(() => {
    api.getBreedingHistory(farmId, type ? { type } : undefined).then(setRows);
  }, [farmId, type]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Insemination & Calving History</h3>
      <div className="filter-bar">
        <label htmlFor="typeFilter" className="meta">
          Filter by type
        </label>
        <select id="typeFilter" value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All</option>
          {BREEDING_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
      </div>
      {!rows ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">No matching events.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Animal</th>
              <th>Type</th>
              <th>Result</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.eventDate).toLocaleDateString()}</td>
                <td>{r.animal.earTag}</td>
                <td>{r.type.replace(/_/g, " ")}</td>
                <td>{r.result ?? "—"}</td>
                <td>{r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function Profitability({ farmId }: { farmId: string }) {
  const [rows, setRows] = useState<ProfitabilityRow[] | null>(null);
  useEffect(() => {
    api.getFarmProfitability(farmId).then(setRows);
  }, [farmId]);

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Per-Animal Profit & Loss</h3>
      <p className="meta">Income (milk sales) minus linked expenses (feed, vet, insemination, purchase).</p>
      {!rows ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p className="empty-state">No financial transactions linked to animals yet.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Animal</th>
              <th>Income</th>
              <th>Expense</th>
              <th>Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.animal?.id}>
                <td>{r.animal?.name ?? r.animal?.earTag}</td>
                <td>${r.income.toFixed(2)}</td>
                <td>${r.expense.toFixed(2)}</td>
                <td className={r.netProfit >= 0 ? "profit-positive" : "profit-negative"}>${r.netProfit.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
