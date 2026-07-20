import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { FarmProvider, useFarm } from "./api/FarmContext";
import { HerdDashboard } from "./pages/HerdDashboard";
import { AnimalList } from "./pages/AnimalList";
import { AnimalProfile } from "./pages/AnimalProfile";

function Shell() {
  const { farm, loading, error } = useFarm();

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>{farm ? farm.name : "Milking"}</h1>
        <nav className="app-nav">
          <NavLink to="/" end className={({ isActive }) => (isActive ? "active" : "")}>
            Dashboard
          </NavLink>
          <NavLink to="/animals" className={({ isActive }) => (isActive ? "active" : "")}>
            Animals
          </NavLink>
        </nav>
      </header>

      {loading && <p>Loading farm…</p>}
      {error && <p className="error-text">{error}</p>}
      {!loading && !error && !farm && (
        <p className="empty-state">No farm found. Seed the database with `npm run seed` in /server.</p>
      )}

      {farm && (
        <Routes>
          <Route path="/" element={<HerdDashboard />} />
          <Route path="/animals" element={<AnimalList />} />
          <Route path="/animals/:id" element={<AnimalProfile />} />
        </Routes>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FarmProvider>
        <Shell />
      </FarmProvider>
    </BrowserRouter>
  );
}

export default App;
