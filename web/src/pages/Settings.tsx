import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useFarm } from "../api/FarmContext";
import { useCurrentUser } from "../api/CurrentUserContext";
import type { Location, Medicine, Role, SemenStraw, SystemParameters, User, Vaccine } from "../api/types";

type Tab = "users" | "locations" | "semen" | "medical" | "parameters";

const TABS: { id: Tab; label: string }[] = [
  { id: "users", label: "Users & Roles" },
  { id: "locations", label: "Locations" },
  { id: "semen", label: "Semen Inventory" },
  { id: "medical", label: "Medicine & Vaccines" },
  { id: "parameters", label: "System Parameters" },
];

export function Settings() {
  const { farm } = useFarm();
  const { currentUser } = useCurrentUser();
  const [tab, setTab] = useState<Tab>("users");

  if (!farm) return null;
  const isAdmin = currentUser?.role === "OWNER" || currentUser?.role === "MANAGER";

  return (
    <div>
      {!isAdmin && (
        <div className="card" style={{ borderColor: "var(--high)", background: "rgba(214,137,16,0.08)" }}>
          You're signed in as {currentUser?.role ?? "unknown"}. Most settings require Owner or Manager — you can view
          this screen but writes will be rejected by the server.
        </div>
      )}

      <div className="report-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "users" && <UsersTab farmId={farm.id} canWrite={isAdmin} />}
      {tab === "locations" && <LocationsTab farmId={farm.id} canWrite={isAdmin} />}
      {tab === "semen" && <SemenTab farmId={farm.id} canWrite={isAdmin} />}
      {tab === "medical" && <MedicalTab farmId={farm.id} canWrite={isAdmin} />}
      {tab === "parameters" && <ParametersTab farmId={farm.id} canWrite={isAdmin} />}
    </div>
  );
}

function UsersTab({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const [users, setUsers] = useState<User[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("HERDSMAN");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.listUsers(farmId).then(setUsers);
  }
  useEffect(load, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createUser({ farmId, name, email, role });
      setName("");
      setEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Users</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="uname">Name</label>
            <input id="uname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="uemail">Email</label>
            <input id="uemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="urole">Role</label>
            <select id="urole" value={role} onChange={(e) => setRole(e.target.value as Role)}>
              <option value="OWNER">Owner</option>
              <option value="MANAGER">Manager</option>
              <option value="VET">Vet</option>
              <option value="HERDSMAN">Herdsman</option>
              <option value="MILKER">Milker</option>
            </select>
          </div>
          <button type="submit" className="primary">
            Add User
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function LocationsTab({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [barnName, setBarnName] = useState("");
  const [stallName, setStallName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.listLocations(farmId).then(setLocations);
  }
  useEffect(load, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createLocation({ farmId, barnName, stallName: stallName || undefined });
      setBarnName("");
      setStallName("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Locations</h3>
      <table>
        <thead>
          <tr>
            <th>Barn</th>
            <th>Stall</th>
            <th>Capacity</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((l) => (
            <tr key={l.id}>
              <td>{l.barnName}</td>
              <td>{l.stallName ?? "—"}</td>
              <td>{l.capacity ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="barn">Barn</label>
            <input id="barn" value={barnName} onChange={(e) => setBarnName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="stall">Stall (optional)</label>
            <input id="stall" value={stallName} onChange={(e) => setStallName(e.target.value)} />
          </div>
          <button type="submit" className="primary">
            Add Location
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function SemenTab({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const [straws, setStraws] = useState<SemenStraw[]>([]);
  const [sireName, setSireName] = useState("");
  const [breed, setBreed] = useState("");
  const [strawIdentifier, setStrawIdentifier] = useState("");
  const [quantityOnHand, setQuantityOnHand] = useState("10");
  const [costPerStraw, setCostPerStraw] = useState("25");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.listSemenStraws(farmId).then(setStraws);
  }
  useEffect(load, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.createSemenStraw({
        farmId,
        sireName,
        breed,
        strawIdentifier,
        quantityOnHand: Number(quantityOnHand),
        costPerStraw: Number(costPerStraw),
      });
      setSireName("");
      setBreed("");
      setStrawIdentifier("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Semen Inventory</h3>
      <table>
        <thead>
          <tr>
            <th>Sire</th>
            <th>Breed</th>
            <th>Straw ID</th>
            <th>Qty on Hand</th>
            <th>Cost / Straw</th>
          </tr>
        </thead>
        <tbody>
          {straws.map((s) => (
            <tr key={s.id}>
              <td>{s.sireName}</td>
              <td>{s.breed}</td>
              <td>{s.strawIdentifier}</td>
              <td>{s.quantityOnHand}</td>
              <td>${s.costPerStraw.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="sire">Sire name</label>
            <input id="sire" value={sireName} onChange={(e) => setSireName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="sbreed">Breed</label>
            <input id="sbreed" value={breed} onChange={(e) => setBreed(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="strawId">Straw ID</label>
            <input id="strawId" value={strawIdentifier} onChange={(e) => setStrawIdentifier(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="qty">Quantity</label>
            <input id="qty" type="number" min="0" value={quantityOnHand} onChange={(e) => setQuantityOnHand(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="cost">Cost/straw</label>
            <input id="cost" type="number" min="0" step="0.01" value={costPerStraw} onChange={(e) => setCostPerStraw(e.target.value)} />
          </div>
          <button type="submit" className="primary">
            Add Straw Batch
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

function MedicalTab({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [vaccines, setVaccines] = useState<Vaccine[]>([]);
  const [kind, setKind] = useState<"medicine" | "vaccine">("medicine");
  const [name, setName] = useState("");
  const [type, setType] = useState("");
  const [withdrawalDays, setWithdrawalDays] = useState("0");
  const [unitCost, setUnitCost] = useState("0");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.listMedicines(farmId).then(setMedicines);
    api.listVaccines(farmId).then(setVaccines);
  }
  useEffect(load, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const payload = {
      farmId,
      name,
      type,
      defaultWithdrawalPeriodDays: Number(withdrawalDays),
      unitCost: Number(unitCost),
    };
    try {
      if (kind === "medicine") await api.createMedicine(payload);
      else await api.createVaccine(payload);
      setName("");
      setType("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Medicines</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Withdrawal (days)</th>
            <th>Unit Cost</th>
          </tr>
        </thead>
        <tbody>
          {medicines.map((m) => (
            <tr key={m.id}>
              <td>{m.name}</td>
              <td>{m.type}</td>
              <td>{m.defaultWithdrawalPeriodDays}</td>
              <td>${m.unitCost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>Vaccines</h3>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Withdrawal (days)</th>
            <th>Unit Cost</th>
          </tr>
        </thead>
        <tbody>
          {vaccines.map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td>{v.type}</td>
              <td>{v.defaultWithdrawalPeriodDays}</td>
              <td>${v.unitCost.toFixed(2)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {canWrite && (
        <form onSubmit={submit} style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-end" }}>
          <div className="field">
            <label htmlFor="kind">Add to</label>
            <select id="kind" value={kind} onChange={(e) => setKind(e.target.value as "medicine" | "vaccine")}>
              <option value="medicine">Medicine</option>
              <option value="vaccine">Vaccine</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="mname">Name</label>
            <input id="mname" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label htmlFor="mtype">Type</label>
            <input id="mtype" value={type} onChange={(e) => setType(e.target.value)} placeholder="e.g. Antibiotic" required />
          </div>
          <div className="field">
            <label htmlFor="mwithdrawal">Withdrawal days</label>
            <input id="mwithdrawal" type="number" min="0" value={withdrawalDays} onChange={(e) => setWithdrawalDays(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="mcost">Unit cost</label>
            <input id="mcost" type="number" min="0" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
          <button type="submit" className="primary">
            Add
          </button>
        </form>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}

const PARAM_FIELDS: { key: keyof SystemParameters; label: string }[] = [
  { key: "voluntaryWaitDays", label: "Voluntary wait (days)" },
  { key: "openTooLongDays", label: "Open too long threshold (days)" },
  { key: "postpartumCheckDay", label: "Postpartum check (day)" },
  { key: "heatWindowHours", label: "Heat window (hours)" },
  { key: "pregnancyCheckDays", label: "Pregnancy check (days post-AI)" },
  { key: "confirmatoryCheckDays", label: "Confirmatory check (days post-AI)" },
  { key: "gestationLengthDays", label: "Gestation length (days)" },
  { key: "dryOffOffsetDays", label: "Dry-off offset before calving (days)" },
  { key: "closeToCalvingOffsetDays", label: "Close-to-calving offset (days)" },
  { key: "colostrumDays", label: "Colostrum period (days)" },
  { key: "freshLactationDays", label: "Fresh -> Peak (DIM)" },
  { key: "peakLactationDays", label: "Peak -> Mid (DIM)" },
  { key: "midLactationDays", label: "Mid -> Late (DIM)" },
  { key: "targetDryOffDim", label: "Target dry-off (DIM)" },
  { key: "yieldDropThresholdPct", label: "Yield-drop alert threshold (%)" },
  { key: "missingMilkDataDays", label: "Missing-milk-data threshold (days)" },
];

function ParametersTab({ farmId, canWrite }: { farmId: string; canWrite: boolean }) {
  const [params, setParams] = useState<SystemParameters | null>(null);
  const [draft, setDraft] = useState<Partial<SystemParameters>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.getSystemParameters(farmId).then((p) => {
      setParams(p);
      setDraft(p);
    });
  }, [farmId]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await api.updateSystemParameters(farmId, draft);
      setParams(updated);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  if (!params) return <p>Loading…</p>;

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>System Parameters</h3>
      <p className="meta">These thresholds drive the reproduction and lactation state machines directly.</p>
      <form onSubmit={submit}>
        <div className="grid grid-cols-3">
          {PARAM_FIELDS.map((f) => (
            <div className="field" key={f.key}>
              <label htmlFor={f.key}>{f.label}</label>
              <input
                id={f.key}
                type="number"
                disabled={!canWrite}
                value={draft[f.key] ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, [f.key]: Number(e.target.value) }))}
              />
            </div>
          ))}
        </div>
        {canWrite && (
          <button type="submit" className="primary" disabled={saving} style={{ marginTop: 12 }}>
            {saving ? "Saving…" : "Save Parameters"}
          </button>
        )}
        {saved && <span className="meta" style={{ marginLeft: 8 }}>Saved.</span>}
      </form>
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
