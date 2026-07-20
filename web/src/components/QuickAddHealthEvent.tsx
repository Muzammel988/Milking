import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { HealthEventType, Medicine, Vaccine } from "../api/types";

export function QuickAddHealthEvent({
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
  const [type, setType] = useState<HealthEventType>("EXAMINATION");
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [medicineId, setMedicineId] = useState("");
  const [vaccineId, setVaccineId] = useState("");
  const [dosage, setDosage] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listMedicines(farmId).then(setMedicines);
    api.listVaccines(farmId).then(setVaccines);
  }, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createHealthEvent({
        animalId,
        type,
        eventDate: new Date(eventDate).toISOString(),
        medicineId: type === "TREATMENT" && medicineId ? medicineId : undefined,
        vaccineId: type === "VACCINATION" && vaccineId ? vaccineId : undefined,
        dosage: dosage || undefined,
        notes: notes || undefined,
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
        <h3>Log Health Event</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="type">Type</label>
            <select id="type" value={type} onChange={(e) => setType(e.target.value as HealthEventType)}>
              <option value="EXAMINATION">Examination</option>
              <option value="DIAGNOSIS">Diagnosis</option>
              <option value="TREATMENT">Treatment</option>
              <option value="VACCINATION">Vaccination</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="date">Date</label>
            <input id="date" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          </div>

          {type === "TREATMENT" && (
            <div className="field">
              <label htmlFor="medicine">Medicine</label>
              <select id="medicine" value={medicineId} onChange={(e) => setMedicineId(e.target.value)}>
                <option value="">None</option>
                {medicines.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} (withdrawal {m.defaultWithdrawalPeriodDays}d)
                  </option>
                ))}
              </select>
            </div>
          )}

          {type === "VACCINATION" && (
            <div className="field">
              <label htmlFor="vaccine">Vaccine</label>
              <select id="vaccine" value={vaccineId} onChange={(e) => setVaccineId(e.target.value)}>
                <option value="">None</option>
                {vaccines.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name} (withdrawal {v.defaultWithdrawalPeriodDays}d)
                  </option>
                ))}
              </select>
            </div>
          )}

          {(type === "TREATMENT" || type === "VACCINATION") && (
            <div className="field">
              <label htmlFor="dosage">Dosage (optional)</label>
              <input id="dosage" value={dosage} onChange={(e) => setDosage(e.target.value)} />
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
