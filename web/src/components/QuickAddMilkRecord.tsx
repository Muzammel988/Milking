import { useState } from "react";
import { api } from "../api/client";
import type { MilkSession } from "../api/types";

export function QuickAddMilkRecord({
  farmId,
  animalId,
  onClose,
  onSaved,
}: {
  farmId: string;
  animalId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [session, setSession] = useState<MilkSession>("MORNING");
  const [yieldLiters, setYieldLiters] = useState("");
  const [fatPct, setFatPct] = useState("");
  const [proteinPct, setProteinPct] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createMilkRecord({
        farmId,
        animalId,
        recordDate: new Date(recordDate).toISOString(),
        session,
        yieldLiters: Number(yieldLiters),
        fatPct: fatPct ? Number(fatPct) : undefined,
        proteinPct: proteinPct ? Number(proteinPct) : undefined,
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
        <h3>Record Milk</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={recordDate} onChange={(e) => setRecordDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="session">Session</label>
            <select id="session" value={session} onChange={(e) => setSession(e.target.value as MilkSession)}>
              <option value="MORNING">Morning</option>
              <option value="MIDDAY">Midday</option>
              <option value="EVENING">Evening</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="yield">Yield (liters)</label>
            <input id="yield" type="number" step="0.1" min="0" value={yieldLiters} onChange={(e) => setYieldLiters(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="fat">Fat % (optional)</label>
            <input id="fat" type="number" step="0.1" min="0" max="100" value={fatPct} onChange={(e) => setFatPct(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="protein">Protein % (optional)</label>
            <input id="protein" type="number" step="0.1" min="0" max="100" value={proteinPct} onChange={(e) => setProteinPct(e.target.value)} />
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
