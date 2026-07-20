export type BreedingState =
  | "FRESH"
  | "VOLUNTARY_WAIT"
  | "OPEN"
  | "IN_HEAT"
  | "INSEMINATED"
  | "PREGNANT"
  | "CLOSE_TO_CALVING"
  | "DRY"
  | "CULLED"
  | "NOT_APPLICABLE";

export type AnimalStatus = "CALF" | "HEIFER" | "COW" | "DRY" | "SOLD" | "DEAD" | "SLAUGHTERED";
export type Sex = "MALE" | "FEMALE";
export type AnimalOrigin = "BORN_ON_FARM" | "PURCHASED";

export type BreedingEventType =
  | "HEAT_OBSERVED"
  | "SYNCHRONIZATION_STEP"
  | "INSEMINATION"
  | "PREGNANCY_CHECK"
  | "CALVING"
  | "DRY_OFF"
  | "ABORTION";

export type BreedingEventResult = "POSITIVE" | "NEGATIVE" | "INCONCLUSIVE";

export type AlertType =
  | "POSTPARTUM_CHECK"
  | "READY_TO_BREED"
  | "OPEN_TOO_LONG"
  | "IN_HEAT"
  | "MISSED_HEAT"
  | "PREGNANCY_CHECK_DUE"
  | "PREGNANCY_CHECK_OVERDUE"
  | "DRY_OFF_DUE"
  | "CLOSE_TO_CALVING";

export type AlertUrgency = "URGENT" | "HIGH" | "NORMAL" | "LOW";
export type AlertStatus = "PENDING" | "DONE" | "DISMISSED";

export interface Farm {
  id: string;
  name: string;
  ownerName: string;
  baseCurrency: string;
}

export interface Animal {
  id: string;
  farmId: string;
  earTag: string;
  name: string | null;
  breed: string;
  sex: Sex;
  birthDate: string;
  origin: AnimalOrigin;
  status: AnimalStatus;
  locationId: string | null;
  breedingState: BreedingState;
  breedingStateSince: string | null;
  lactationState: string | null;
  lactationNumber: number;
  lastCalvingDate: string | null;
  lastInseminationDate: string | null;
  expectedCalvingDate: string | null;
  heatWindowExpiresAt: string | null;
}

export interface BreedingEvent {
  id: string;
  animalId: string;
  type: BreedingEventType;
  eventDate: string;
  result: BreedingEventResult | null;
  notes: string | null;
  operator?: string | null;
}

export interface TimelineEntry {
  kind: "breeding";
  id: string;
  date: string;
  type: BreedingEventType;
  result: BreedingEventResult | null;
  notes: string | null;
  operator: string | null;
}

export interface Alert {
  id: string;
  animalId: string | null;
  type: AlertType;
  urgency: AlertUrgency;
  dueDate: string;
  status: AlertStatus;
  message: string;
  animal?: { id: string; earTag: string; name: string | null } | null;
}

export interface DashboardData {
  herdCountsByBreedingState: { breedingState: BreedingState; count: number }[];
  alertsByUrgency: Record<AlertUrgency, Alert[]>;
  totalPendingAlerts: number;
}
