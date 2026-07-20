import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useFarm } from "../api/FarmContext";
import type { Animal } from "../api/types";
import { StateBadge } from "../components/Badges";
import { AddAnimalModal } from "../components/AddAnimalModal";

export function AnimalList() {
  const { farm } = useFarm();
  const navigate = useNavigate();
  const [animals, setAnimals] = useState<Animal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);

  const load = useCallback(() => {
    if (!farm) return;
    setLoading(true);
    api
      .listAnimals(farm.id)
      .then(setAnimals)
      .finally(() => setLoading(false));
  }, [farm]);

  useEffect(load, [load]);

  if (!farm) return null;

  return (
    <div>
      <div className="quick-add-bar">
        <button className="primary" onClick={() => setShowAdd(true)}>
          + Add Animal
        </button>
      </div>

      <div className="card">
        {loading ? (
          <p>Loading…</p>
        ) : animals.length === 0 ? (
          <p className="empty-state">No animals yet — add the first one.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Ear Tag</th>
                <th>Name</th>
                <th>Breed</th>
                <th>Status</th>
                <th>Breeding State</th>
                <th>Lactation #</th>
              </tr>
            </thead>
            <tbody>
              {animals.map((a) => (
                <tr key={a.id} className="clickable" onClick={() => navigate(`/animals/${a.id}`)}>
                  <td>{a.earTag}</td>
                  <td>{a.name ?? "—"}</td>
                  <td>{a.breed}</td>
                  <td>{a.status}</td>
                  <td>
                    <StateBadge state={a.breedingState} />
                  </td>
                  <td>{a.lactationNumber}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showAdd && (
        <AddAnimalModal
          farmId={farm.id}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            load();
          }}
        />
      )}
    </div>
  );
}
