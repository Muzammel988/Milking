import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useFarm } from "../api/FarmContext";
import type { Animal, BreedingEventType, HealthEventType, MilkSession } from "../api/types";
import { cacheAnimals, getCachedAnimals } from "../offline/animalCache";
import { enqueue, flushOutbox, getOutbox, subscribeOutbox, type OutboxEntry } from "../offline/outbox";

type Tab = "milk" | "breeding" | "health";

function useOnlineStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export function QuickEntry() {
  const { farm } = useFarm();
  const online = useOnlineStatus();
  const [tab, setTab] = useState<Tab>("milk");
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [outbox, setOutbox] = useState<OutboxEntry[]>(getOutbox());
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  useEffect(() => subscribeOutbox(setOutbox), []);

  useEffect(() => {
    if (!farm) return;
    if (online) {
      api
        .listAnimals(farm.id)
        .then((list) => {
          setAnimals(list);
          cacheAnimals(farm.id, list);
        })
        .catch(() => setAnimals(getCachedAnimals(farm.id)));
    } else {
      setAnimals(getCachedAnimals(farm.id));
    }
  }, [farm, online]);

  if (!farm) return null;

  function flash(msg: string) {
    setSavedFlash(msg);
    setTimeout(() => setSavedFlash(null), 2000);
  }

  const pendingCount = outbox.filter((e) => e.status !== "syncing").length;

  return (
    <div className="quick-entry">
      <div className={`sync-banner ${online ? "online" : "offline"}`}>
        <span>{online ? "● Online" : "○ Offline — entries will sync automatically"}</span>
        {pendingCount > 0 && (
          <button onClick={() => void flushOutbox()} disabled={!online}>
            {pendingCount} pending — sync now
          </button>
        )}
      </div>

      {savedFlash && <div className="flash-banner">{savedFlash}</div>}

      <div className="qe-tabs">
        <button className={tab === "milk" ? "active" : ""} onClick={() => setTab("milk")}>
          🥛 Milk
        </button>
        <button className={tab === "breeding" ? "active" : ""} onClick={() => setTab("breeding")}>
          🐄 Breeding
        </button>
        <button className={tab === "health" ? "active" : ""} onClick={() => setTab("health")}>
          🩺 Health
        </button>
      </div>

      {tab === "milk" && <MilkForm farmId={farm.id} animals={animals} onSaved={flash} />}
      {tab === "breeding" && <BreedingForm animals={animals} onSaved={flash} />}
      {tab === "health" && <HealthForm farmId={farm.id} animals={animals} onSaved={flash} />}

      {outbox.length > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Sync Queue</h3>
          <ul className="timeline">
            {outbox.map((e) => (
              <li key={e.id} className="timeline-item">
                <div className="date">{new Date(e.createdAt).toLocaleTimeString()}</div>
                <div className="type">
                  {e.label} — {e.status === "failed" ? "⚠ failed, will retry" : e.status === "syncing" ? "syncing…" : "queued"}
                </div>
                {e.lastError && <div className="meta error-text">{e.lastError}</div>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AnimalSelect({ animals, value, onChange }: { animals: Animal[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label htmlFor="animal">Animal</label>
      <select id="animal" value={value} onChange={(e) => onChange(e.target.value)} required>
        <option value="">Select animal…</option>
        {animals.map((a) => (
          <option key={a.id} value={a.id}>
            {a.earTag} {a.name ? `— ${a.name}` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

function MilkForm({ farmId, animals, onSaved }: { farmId: string; animals: Animal[]; onSaved: (msg: string) => void }) {
  const [animalId, setAnimalId] = useState("");
  const [bulk, setBulk] = useState(false);
  const [session, setSession] = useState<MilkSession>("MORNING");
  const [yieldLiters, setYieldLiters] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const animal = animals.find((a) => a.id === animalId);
    enqueue(
      {
        kind: "milk",
        payload: {
          farmId,
          animalId: bulk ? undefined : animalId,
          recordDate: new Date().toISOString(),
          session,
          yieldLiters: Number(yieldLiters),
        },
      },
      `Milk — ${bulk ? "bulk tank" : animal?.earTag ?? animalId} — ${yieldLiters}L`
    );
    onSaved("Milk record queued");
    setYieldLiters("");
  }

  return (
    <form className="card" onSubmit={submit}>
      <div className="field">
        <label>
          <input type="checkbox" checked={bulk} onChange={(e) => setBulk(e.target.checked)} /> Bulk tank entry (no
          animal)
        </label>
      </div>
      {!bulk && <AnimalSelect animals={animals} value={animalId} onChange={setAnimalId} />}
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
        <input id="yield" type="number" step="0.1" min="0" inputMode="decimal" value={yieldLiters} onChange={(e) => setYieldLiters(e.target.value)} required />
      </div>
      <button type="submit" className="primary qe-submit">
        Save Milk Entry
      </button>
    </form>
  );
}

function BreedingForm({ animals, onSaved }: { animals: Animal[]; onSaved: (msg: string) => void }) {
  const [animalId, setAnimalId] = useState("");
  const [type, setType] = useState<BreedingEventType>("HEAT_OBSERVED");
  const [result, setResult] = useState<"POSITIVE" | "NEGATIVE" | "INCONCLUSIVE">("POSITIVE");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const animal = animals.find((a) => a.id === animalId);
    enqueue(
      {
        kind: "breeding",
        payload: {
          animalId,
          type,
          eventDate: new Date().toISOString(),
          notes: notes || undefined,
          result: type === "PREGNANCY_CHECK" ? result : undefined,
        },
      },
      `Breeding — ${animal?.earTag ?? animalId} — ${type}`
    );
    onSaved("Breeding event queued");
    setNotes("");
  }

  return (
    <form className="card" onSubmit={submit}>
      <AnimalSelect animals={animals} value={animalId} onChange={setAnimalId} />
      <div className="field">
        <label htmlFor="type">Event</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as BreedingEventType)}>
          <option value="HEAT_OBSERVED">Heat Observed</option>
          <option value="INSEMINATION">Insemination</option>
          <option value="PREGNANCY_CHECK">Pregnancy Check</option>
        </select>
      </div>
      {type === "PREGNANCY_CHECK" && (
        <div className="field">
          <label htmlFor="result">Result</label>
          <select id="result" value={result} onChange={(e) => setResult(e.target.value as never)}>
            <option value="POSITIVE">Positive</option>
            <option value="NEGATIVE">Negative</option>
            <option value="INCONCLUSIVE">Inconclusive</option>
          </select>
        </div>
      )}
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className="meta">For calving, dry-off, or abortion, use the animal's profile page (needs more detail than quick entry).</p>
      <button type="submit" className="primary qe-submit">
        Save Breeding Event
      </button>
    </form>
  );
}

function HealthForm({ farmId, animals, onSaved }: { farmId: string; animals: Animal[]; onSaved: (msg: string) => void }) {
  void farmId;
  const [animalId, setAnimalId] = useState("");
  const [type, setType] = useState<HealthEventType>("EXAMINATION");
  const [notes, setNotes] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const animal = animals.find((a) => a.id === animalId);
    enqueue(
      { kind: "health", payload: { animalId, type, eventDate: new Date().toISOString(), notes: notes || undefined } },
      `Health — ${animal?.earTag ?? animalId} — ${type}`
    );
    onSaved("Health event queued");
    setNotes("");
  }

  return (
    <form className="card" onSubmit={submit}>
      <AnimalSelect animals={animals} value={animalId} onChange={setAnimalId} />
      <div className="field">
        <label htmlFor="type">Type</label>
        <select id="type" value={type} onChange={(e) => setType(e.target.value as HealthEventType)}>
          <option value="EXAMINATION">Examination</option>
          <option value="DIAGNOSIS">Diagnosis</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="notes">Notes</label>
        <input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <p className="meta">For treatments or vaccinations (which need a catalog + cost lookup), use the animal's profile page.</p>
      <button type="submit" className="primary qe-submit">
        Save Health Event
      </button>
    </form>
  );
}
