import { useState } from "react";
import { api } from "../api/client";

export function AddAnimalModal({
  farmId,
  onClose,
  onSaved,
}: {
  farmId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [earTag, setEarTag] = useState("");
  const [name, setName] = useState("");
  const [breed, setBreed] = useState("Holstein");
  const [sex, setSex] = useState<"MALE" | "FEMALE">("FEMALE");
  const [birthDate, setBirthDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [origin, setOrigin] = useState<"BORN_ON_FARM" | "PURCHASED">("BORN_ON_FARM");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.createAnimal({
        farmId,
        earTag,
        name: name || undefined,
        breed,
        sex,
        birthDate: new Date(birthDate).toISOString(),
        origin,
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
        <h3>Add Animal</h3>
        <form onSubmit={submit}>
          <div className="field">
            <label htmlFor="earTag">Ear tag</label>
            <input id="earTag" value={earTag} onChange={(e) => setEarTag(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="name">Name (optional)</label>
            <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="breed">Breed</label>
            <input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sex">Sex</label>
            <select id="sex" value={sex} onChange={(e) => setSex(e.target.value as "MALE" | "FEMALE")}>
              <option value="FEMALE">Female</option>
              <option value="MALE">Male</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="birthDate">Birth date</label>
            <input id="birthDate" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="origin">Origin</label>
            <select id="origin" value={origin} onChange={(e) => setOrigin(e.target.value as never)}>
              <option value="BORN_ON_FARM">Born on farm</option>
              <option value="PURCHASED">Purchased</option>
            </select>
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
