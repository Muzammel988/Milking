import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";

export type PermissionResource = "ADMIN" | "HERD" | "BREEDING" | "MILK" | "HEALTH" | "FEED" | "FINANCIAL";

/**
 * Derived from role, not stored ad hoc — matches the product spec examples:
 * a herdsman logs breeding and milk but not financials, a milker only logs
 * milk, a vet logs health and reads (but doesn't edit) breeding history.
 */
const ROLE_PERMISSIONS: Record<Role, Set<PermissionResource>> = {
  OWNER: new Set(["ADMIN", "HERD", "BREEDING", "MILK", "HEALTH", "FEED", "FINANCIAL"]),
  MANAGER: new Set(["ADMIN", "HERD", "BREEDING", "MILK", "HEALTH", "FEED", "FINANCIAL"]),
  VET: new Set(["HEALTH"]),
  HERDSMAN: new Set(["HERD", "BREEDING", "MILK"]),
  MILKER: new Set(["MILK"]),
};

/** Looser check for low-risk actions (e.g. resolving an alert) that just need a known, active user — not a specific resource permission. */
export function requireAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (!req.currentUser || !req.currentUser.active) {
    return res.status(401).json({ error: "X-User-Id header required" });
  }
  next();
}

export function requirePermission(resource: PermissionResource) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = req.currentUser;
    if (!user) {
      return res.status(401).json({ error: "X-User-Id header required" });
    }
    if (!user.active || !ROLE_PERMISSIONS[user.role].has(resource)) {
      return res.status(403).json({ error: `Role ${user.role} cannot perform this action (requires ${resource})` });
    }
    next();
  };
}
