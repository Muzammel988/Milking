import { BrowserRouter, NavLink, Route, Routes } from "react-router-dom";
import { FarmProvider, useFarm } from "./api/FarmContext";
import { CurrentUserProvider } from "./api/CurrentUserContext";
import { UserSwitcher } from "./components/UserSwitcher";
import { HerdDashboard } from "./pages/HerdDashboard";
import { AnimalList } from "./pages/AnimalList";
import { AnimalProfile } from "./pages/AnimalProfile";
import { QuickEntry } from "./pages/QuickEntry";
import { Reports } from "./pages/Reports";
import { Settings } from "./pages/Settings";

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
          <NavLink to="/quick-entry" className={({ isActive }) => (isActive ? "active" : "")}>
            Quick Entry
          </NavLink>
          <NavLink to="/reports" className={({ isActive }) => (isActive ? "active" : "")}>
            Reports
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => (isActive ? "active" : "")}>
            Settings
          </NavLink>
        </nav>
        <UserSwitcher />
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
          <Route path="/quick-entry" element={<QuickEntry />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      )}
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <FarmProvider>
        <CurrentUserProvider>
          <Shell />
        </CurrentUserProvider>
      </FarmProvider>
    </BrowserRouter>
  );
}

export default App;
