import type { LocationTreeNode } from './wms-types'

export interface EffectiveDimensions {
  width: number | null
  depth: number | null
  height: number | null
  source: 'explicit' | 'inherited' | 'none'
}

/**
 * Get effective dimensions for a location node.
 * If the node has explicit dimensions, use them.
 * Otherwise, infer from children:
 *   width  = max(children.width)
 *   depth  = max(children.depth)
 *   height = sum(children.height) for stacked children (shelves in a rack)
 *            or max(children.height) for side-by-side children
 */
export function getEffectiveDimensions(node: LocationTreeNode): EffectiveDimensions {
  // Explicit dimensions take priority
  if (node.width_in != null && node.height_in != null) {
    return {
      width: node.width_in,
      depth: node.depth_in,
      height: node.height_in,
      source: 'explicit',
    }
  }

  if (node.children.length === 0) {
    return {
      width: node.width_in,
      depth: node.depth_in,
      height: node.height_in,
      source: node.width_in != null ? 'explicit' : 'none',
    }
  }

  // Inherit from children
  const childDims = node.children.map((c) => getEffectiveDimensions(c))
  const validChildren = childDims.filter((d) => d.width != null || d.height != null)

  if (validChildren.length === 0) {
    return {
      width: node.width_in,
      depth: node.depth_in,
      height: node.height_in,
      source: node.width_in != null ? 'explicit' : 'none',
    }
  }

  // Width = max of children (rack is as wide as its widest shelf)
  const widths = validChildren.map((d) => d.width).filter((w): w is number => w != null)
  const depths = validChildren.map((d) => d.depth).filter((d): d is number => d != null)
  const heights = validChildren.map((d) => d.height).filter((h): h is number => h != null)

  // For stacked children (shelves in a rack, drawers in a cabinet): sum heights
  // For side-by-side children (bins on a shelf): max height
  const isStacked = node.unit_subtype === 'rack' || node.unit_subtype === 'cabinet' || node.unit_subtype === 'closet'
  const inheritedHeight = heights.length > 0
    ? (isStacked ? heights.reduce((sum, h) => sum + h, 0) : Math.max(...heights))
    : null

  return {
    width: node.width_in ?? (widths.length > 0 ? Math.max(...widths) : null),
    depth: node.depth_in ?? (depths.length > 0 ? Math.max(...depths) : null),
    height: node.height_in ?? inheritedHeight,
    source: 'inherited',
  }
}

/**
 * Get the effective dimensions for a shelf, including its height.
 * If the shelf has no explicit height, try to infer from parent rack.
 */
export function getShelfHeight(shelf: LocationTreeNode, rackHeight: number | null, shelfCount: number): number {
  if (shelf.height_in != null) return shelf.height_in
  if (rackHeight != null && shelfCount > 0) return rackHeight / shelfCount
  return 11.5 // OMAR default
}
