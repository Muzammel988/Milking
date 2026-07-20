import type { AlertUrgency, BreedingState } from "../api/types";

const STATE_LABELS: Record<BreedingState, string> = {
  FRESH: "Fresh",
  VOLUNTARY_WAIT: "Voluntary Wait",
  OPEN: "Open",
  IN_HEAT: "In Heat",
  INSEMINATED: "Inseminated",
  PREGNANT: "Pregnant",
  CLOSE_TO_CALVING: "Close to Calving",
  DRY: "Dry",
  CULLED: "Culled",
  NOT_APPLICABLE: "N/A",
};

export function StateBadge({ state }: { state: BreedingState }) {
  return <span className={`badge state-${state}`}>{STATE_LABELS[state]}</span>;
}

export function UrgencyBadge({ urgency }: { urgency: AlertUrgency }) {
  return <span className={`badge urgency-${urgency}`}>{urgency}</span>;
}
