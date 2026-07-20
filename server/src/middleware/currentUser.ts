import type { NextFunction, Request, Response } from "express";
import type { User } from "@prisma/client";
import { prisma } from "../db.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      currentUser?: User;
    }
  }
}

/**
 * There's no login system yet — the frontend lets the user pick which seeded
 * User they're acting as and sends it as `x-user-id` on every request. This
 * middleware resolves that into req.currentUser so permission checks (see
 * middleware/permissions.ts) have a role to check against. Requests without
 * the header simply have no currentUser; only routes that call
 * requirePermission() enforce that one be present.
 */
export async function currentUser(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header("x-user-id");
  if (userId) {
    req.currentUser = (await prisma.user.findUnique({ where: { id: userId } })) ?? undefined;
  }
  next();
}
