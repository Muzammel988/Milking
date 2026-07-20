import type { Prisma, AlertType, AlertUrgency, AlertStatus } from "@prisma/client";

type Tx = Prisma.TransactionClient;

/**
 * Creates a PENDING alert for an animal+type unless one is already pending,
 * in which case the existing alert's dueDate/message/urgency are refreshed.
 * This is the single write path for alert generation, so every screen that
 * reads the Alert table sees a de-duplicated feed instead of the state
 * machine spamming duplicates on every nightly run.
 */
export async function ensurePendingAlert(
  tx: Tx,
  args: {
    animalId?: string | null;
    type: AlertType;
    urgency: AlertUrgency;
    dueDate: Date;
    message: string;
  }
) {
  const existing = await tx.alert.findFirst({
    where: { animalId: args.animalId ?? null, type: args.type, status: "PENDING" },
  });

  if (existing) {
    return tx.alert.update({
      where: { id: existing.id },
      data: { dueDate: args.dueDate, message: args.message, urgency: args.urgency },
    });
  }

  return tx.alert.create({
    data: {
      animalId: args.animalId ?? null,
      type: args.type,
      urgency: args.urgency,
      dueDate: args.dueDate,
      message: args.message,
      status: "PENDING",
    },
  });
}

/** Resolves every PENDING alert of the given types for an animal. */
export async function resolveAlertsOfType(
  tx: Tx,
  animalId: string,
  types: AlertType[],
  status: Extract<AlertStatus, "DONE" | "DISMISSED">,
  resolvedById?: string | null
) {
  await tx.alert.updateMany({
    where: { animalId, type: { in: types }, status: "PENDING" },
    data: { status, resolvedAt: new Date(), resolvedById: resolvedById ?? null },
  });
}
