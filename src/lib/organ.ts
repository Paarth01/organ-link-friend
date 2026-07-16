export const BLOOD_TYPES = ["A+","A-","B+","B-","AB+","AB-","O+","O-"] as const;
export const ORGANS = ["kidney","liver","heart","lung","pancreas","cornea","bone_marrow","intestine"] as const;
export const URGENCY = ["routine","urgent","critical"] as const;

export function organLabel(o: string) {
  return o.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Simple compatibility: exact-match blood type & organ. (Real crossmatching is far more complex.)
export function isCompatible(donor: { blood_type: string; organ: string }, recipient: { blood_type: string; organ_needed: string }) {
  if (donor.organ !== recipient.organ_needed) return false;
  return bloodCompatible(donor.blood_type, recipient.blood_type);
}

// ABO donor -> recipient compatibility
const BLOOD_MAP: Record<string, string[]> = {
  "O-": ["O-","O+","A-","A+","B-","B+","AB-","AB+"],
  "O+": ["O+","A+","B+","AB+"],
  "A-": ["A-","A+","AB-","AB+"],
  "A+": ["A+","AB+"],
  "B-": ["B-","B+","AB-","AB+"],
  "B+": ["B+","AB+"],
  "AB-": ["AB-","AB+"],
  "AB+": ["AB+"],
};
export function bloodCompatible(donor: string, recipient: string) {
  return BLOOD_MAP[donor]?.includes(recipient) ?? false;
}
