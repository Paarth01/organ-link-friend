export const ACTIVE_MATCH_STATUSES = ["proposed", "accepted"] as const;

export function hasAssignedHospital(hospitalName: string): boolean {
  return hospitalName.trim().length > 0;
}

export function canConfirmMatch(
  status: string,
  hospitalName: string,
  donorStatus: string,
  recipientStatus: string,
): boolean {
  return (
    status === "proposed" &&
    hasAssignedHospital(hospitalName) &&
    donorStatus === "available" &&
    recipientStatus === "waiting"
  );
}

export function canCompleteMatch(status: string): boolean {
  return status === "accepted";
}