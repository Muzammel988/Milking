import type { TimelineEntry } from "../api/types";

const BREEDING_LABELS: Record<string, string> = {
  HEAT_OBSERVED: "Heat Observed",
  SYNCHRONIZATION_STEP: "Synchronization Step",
  INSEMINATION: "Insemination",
  PREGNANCY_CHECK: "Pregnancy Check",
  CALVING: "Calving",
  DRY_OFF: "Dry-off",
  ABORTION: "Abortion",
};

const HEALTH_LABELS: Record<string, string> = {
  EXAMINATION: "Examination",
  DIAGNOSIS: "Diagnosis",
  TREATMENT: "Treatment",
  VACCINATION: "Vaccination",
};

const KIND_ICON: Record<TimelineEntry["kind"], string> = {
  breeding: "🐄",
  milk: "🥛",
  health: "🩺",
  financial: "💵",
};

export function TimelineItem({ entry }: { entry: TimelineEntry }) {
  return (
    <li className="timeline-item">
      <div className="date">{new Date(entry.date).toLocaleDateString()}</div>
      {entry.kind === "breeding" && (
        <>
          <div className="type">
            {KIND_ICON.breeding} {BREEDING_LABELS[entry.type] ?? entry.type}
          </div>
          {entry.result && <div>Result: {entry.result}</div>}
          {entry.notes && <div className="meta">{entry.notes}</div>}
          {entry.operator && <div className="meta">Operator: {entry.operator}</div>}
        </>
      )}
      {entry.kind === "milk" && (
        <>
          <div className="type">
            {KIND_ICON.milk} Milk — {entry.session.charAt(0) + entry.session.slice(1).toLowerCase()}
          </div>
          <div>{entry.yieldLiters.toFixed(1)} L</div>
          {(entry.fatPct || entry.proteinPct) && (
            <div className="meta">
              {entry.fatPct && `Fat ${entry.fatPct}%`} {entry.proteinPct && `Protein ${entry.proteinPct}%`}
            </div>
          )}
        </>
      )}
      {entry.kind === "health" && (
        <>
          <div className="type">
            {KIND_ICON.health} {HEALTH_LABELS[entry.type] ?? entry.type}
          </div>
          {(entry.medicine || entry.vaccine) && <div>{entry.medicine ?? entry.vaccine}</div>}
          {entry.dosage && <div className="meta">Dosage: {entry.dosage}</div>}
          {entry.cost != null && <div className="meta">Cost: ${entry.cost.toFixed(2)}</div>}
          {entry.withdrawalEndDate && (
            <div className="meta" style={{ color: "var(--urgent)" }}>
              Withdrawal until {new Date(entry.withdrawalEndDate).toLocaleDateString()}
            </div>
          )}
          {entry.notes && <div className="meta">{entry.notes}</div>}
        </>
      )}
      {entry.kind === "financial" && (
        <>
          <div className="type">
            {KIND_ICON.financial} {entry.category.replace(/_/g, " ")}
          </div>
          <div>
            {entry.type === "INCOME" ? "+" : "-"}
            {entry.currency} {entry.amount.toFixed(2)}
          </div>
          {entry.notes && <div className="meta">{entry.notes}</div>}
        </>
      )}
    </li>
  );
}
