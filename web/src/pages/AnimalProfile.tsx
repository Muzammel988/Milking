import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Animal, TimelineEntry } from "../api/types";
import { StateBadge } from "../components/Badges";
import { QuickAddBreedingEvent } from "../components/QuickAddBreedingEvent";

const EVENT_TYPE_LABELS: Record<string, string> = {
  HEAT_OBSERVED: "Heat Observed",
  SYNCHRONIZATION_STEP: "Synchronization Step",
  INSEMINATION: "Insemination",
  PREGNANCY_CHECK: "Pregnancy Check",
  CALVING: "Calving",
  DRY_OFF: "Dry-off",
  ABORTION: "Abortion",
};

function age(birthDate: string): string {
  const months = Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

export function AnimalProfile() {
  const { id } = useParams<{ id: string }>();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .getTimeline(id)
      .then((data) => {
        setAnimal(data.animal);
        setTimeline(data.timeline);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!animal) return <p>Animal not found.</p>;

  return (
    <div>
      <p>
        <Link to="/animals">&larr; Back to herd</Link>
      </p>

      <div className="card profile-header">
        <div>
          <h2 style={{ margin: "0 0 4px" }}>
            {animal.name ?? animal.earTag} <span className="meta">#{animal.earTag}</span>
          </h2>
          <p className="meta">
            {animal.breed} · {animal.sex === "FEMALE" ? "Female" : "Male"} · Age {age(animal.birthDate)} · Status{" "}
            {animal.status} · Lactation #{animal.lactationNumber}
          </p>
        </div>
        <StateBadge state={animal.breedingState} />
      </div>

      <div className="quick-add-bar">
        <button className="primary" onClick={() => setShowQuickAdd(true)}>
          + Log Breeding Event
        </button>
        <button disabled title="Milk recording ships in the next phase">
          + Record Milk
        </button>
        <button disabled title="Health events ship in the next phase">
          + Log Health Event
        </button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Timeline</h3>
        {timeline.length === 0 ? (
          <p className="empty-state">No events recorded yet.</p>
        ) : (
          <ul className="timeline">
            {timeline.map((entry) => (
              <li key={entry.id} className="timeline-item">
                <div className="date">{new Date(entry.date).toLocaleDateString()}</div>
                <div className="type">{EVENT_TYPE_LABELS[entry.type] ?? entry.type}</div>
                {entry.result && <div>Result: {entry.result}</div>}
                {entry.notes && <div className="meta">{entry.notes}</div>}
                {entry.operator && <div className="meta">Operator: {entry.operator}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {showQuickAdd && (
        <QuickAddBreedingEvent
          animalId={animal.id}
          onClose={() => setShowQuickAdd(false)}
          onSaved={() => {
            setShowQuickAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}
