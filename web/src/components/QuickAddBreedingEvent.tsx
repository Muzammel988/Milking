import { useState } from "react";
import { api } from "../api/client";
import type { BreedingEventResult, BreedingEventType } from "../api/types";

const EVENT_LABELS: Record<BreedingEventType, string> = {
  HEAT_OBSERVED: "Heat Observed",
  SYNCHRONIZATION_STEP: "Synchronization Step",
  INSEMINATION: "Insemination",
  PREGNANCY_CHECK: "Pregnancy Check",
  CALVING: "Calving",
  DRY_OFF: "Dry-off",
  ABORTION: "Abortion",
};

export function QuickAddBreedingEvent({
  animalId,
  onClose,
  onSaved,
}: {
  animalId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<BreedingEventType>("HEAT_OBSERVED");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [result, setResult] = useState<BreedingEventResult>("POSITIVE");
  const [semenOrSireRef, setSemenOrSireRef] = useState("");
  const [notes, setNotes] = useState("");
  const [calvingType, setCalvingType] = useState<"NORMAL" | "ASSISTED" | "CAESAREAN">("NORMAL");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createBreedingEvent({
        animalId,
        type,
        eventDate: new Date(eventDate).toISOString(),
        notes: notes || undefined,
        semenOrSireRef: type === "INSEMINATION" ? semenOrSireRef || undefined : undefined,
        result: type === "PREGNANCY_CHECK" ? result : undefined,
        calvingDetail: type === "CALVING" ? { calvingType } : undefined,
      });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Log Breeding Event</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="type">Event type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as BreedingEventType)}>
              {Object.entries(EVENT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </div>

          {type === "INSEMINATION" && (
            <div className="field">
              <label htmlFor="semen">Semen / sire reference</label>
              <input id="semen" value={semenOrSireRef} onChange={(e) => setSemenOrSireRef(e.target.value)} />
            </div>
          )}

          {type === "PREGNANCY_CHECK" && (
            <div className="field">
              <label htmlFor="result">Result</label>
              <select id="result" value={result} onChange={(e) => setResult(e.target.value as BreedingEventResult)}>
                <option value="POSITIVE">Positive</option>
                <option value="NEGATIVE">Negative</option>
                <option value="INCONCLUSIVE">Inconclusive</option>
              </select>
            </div>
          )}

          {type === "CALVING" && (
            <div className="field">
              <label htmlFor="calvingType">Calving type</label>
              <select id="calvingType" value={calvingType} onChange={(e) => setCalvingType(e.target.value as never)}>
                <option value="NORMAL">Normal</option>
                <option value="ASSISTED">Assisted</option>
                <option value="CAESAREAN">Caesarean</option>
              </select>
            </div>
          )}

          <div className="field">
            <label htmlFor="notes">Notes</label>
            <textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          {error && <p className="error-text">{error}</p>}

          <div className="modal-actions">
            <button type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="primary" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
