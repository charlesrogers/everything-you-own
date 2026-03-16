import type { RelationshipType } from "./types"

export const RELATIONSHIP_LABELS: Record<
  string,
  { forward: string; reverse: string }
> = {
  goes_with: { forward: "Goes with", reverse: "Goes with" },
  replaced_by: { forward: "Replaced by", reverse: "Replaces" },
  variant_of: { forward: "Variant of", reverse: "Has variant" },
  accessory_for: { forward: "Accessory for", reverse: "Has accessory" },
  outfit_ensemble: { forward: "Outfit with", reverse: "Outfit with" },
  set_member: { forward: "Part of set", reverse: "Set includes" },
  repurchase_of: { forward: "Repurchase of", reverse: "Repurchased as" },
  parent_child: { forward: "Child of", reverse: "Parent of" },
}

// v1 scope — relationship types available in the picker
export const AVAILABLE_RELATIONSHIP_TYPES: { value: RelationshipType; label: string }[] = [
  { value: "goes_with", label: "Goes with" },
  { value: "replaced_by", label: "Replaced by" },
  { value: "accessory_for", label: "Accessory for" },
]

export function getRelationshipLabel(type: string, direction: "forward" | "reverse"): string {
  const entry = RELATIONSHIP_LABELS[type]
  if (!entry) return type
  return direction === "forward" ? entry.forward : entry.reverse
}
