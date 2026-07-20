import { useCallback, useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../api/client";
import type { Animal, TimelineEntry } from "../api/types";
import { StateBadge } from "../components/Badges";
import { QuickAddBreedingEvent } from "../components/QuickAddBreedingEvent";
import { QuickAddMilkRecord } from "../components/QuickAddMilkRecord";
import { QuickAddHealthEvent } from "../components/QuickAddHealthEvent";
import { TimelineItem } from "../components/TimelineItem";

function age(birthDate: string): string {
  const months = Math.floor((Date.now() - new Date(birthDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
  if (months < 24) return `${months} mo`;
  return `${Math.floor(months / 12)} yr ${months % 12} mo`;
}

type QuickAddKind = "breeding" | "milk" | "health" | null;

export function AnimalProfile() {
  const { id } = useParams<{ id: string }>();
  const [animal, setAnimal] = useState<Animal | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [activeWithdrawalUntil, setActiveWithdrawalUntil] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [quickAdd, setQuickAdd] = useState<QuickAddKind>(null);

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    api
      .getTimeline(id)
      .then((data) => {
        setAnimal(data.animal);
        setTimeline(data.timeline);
        setActiveWithdrawalUntil(data.activeWithdrawalUntil);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(load, [load]);

  if (loading) return <p>Loading…</p>;
  if (error) return <p className="error-text">{error}</p>;
  if (!animal) return <p>Animal not found.</p>;

  function closeAndReload() {
    setQuickAdd(null);
    load();
  }

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
        <div style={{ display: "flex", gap: 6 }}>
          <StateBadge state={animal.breedingState} />
        </div>
      </div>

      {activeWithdrawalUntil && (
        <div className="card" style={{ borderColor: "var(--urgent)", background: "rgba(192,57,43,0.08)" }}>
          ⚠️ Milk/meat withdrawal active until <strong>{new Date(activeWithdrawalUntil).toLocaleDateString()}</strong> — do
          not sell milk or meat from this animal before then.
        </div>
      )}

      <div className="quick-add-bar">
        <button className="primary" onClick={() => setQuickAdd("breeding")}>
          + Log Breeding Event
        </button>
        <button onClick={() => setQuickAdd("milk")}>+ Record Milk</button>
        <button onClick={() => setQuickAdd("health")}>+ Log Health Event</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Timeline</h3>
        {timeline.length === 0 ? (
          <p className="empty-state">No events recorded yet.</p>
        ) : (
          <ul className="timeline">
            {timeline.map((entry) => (
              <TimelineItem key={`${entry.kind}-${entry.id}`} entry={entry} />
            ))}
          </ul>
        )}
      </div>

      {quickAdd === "breeding" && (
        <QuickAddBreedingEvent animalId={animal.id} onClose={() => setQuickAdd(null)} onSaved={closeAndReload} />
      )}
      {quickAdd === "milk" && (
        <QuickAddMilkRecord farmId={animal.farmId} animalId={animal.id} onClose={() => setQuickAdd(null)} onSaved={closeAndReload} />
      )}
      {quickAdd === "health" && (
        <QuickAddHealthEvent farmId={animal.farmId} animalId={animal.id} onClose={() => setQuickAdd(null)} onSaved={closeAndReload} />
      )}
    </div>
  );
}
