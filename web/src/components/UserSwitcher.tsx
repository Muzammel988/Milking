import { useCurrentUser } from "../api/CurrentUserContext";

export function UserSwitcher() {
  const { users, currentUser, setCurrentUserId } = useCurrentUser();
  if (users.length === 0) return null;

  return (
    <div className="user-switcher">
      <select
        aria-label="Acting as"
        value={currentUser?.id ?? ""}
        onChange={(e) => setCurrentUserId(e.target.value)}
      >
        {users.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name} ({u.role})
          </option>
        ))}
      </select>
    </div>
  );
}
