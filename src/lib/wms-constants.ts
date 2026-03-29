import type { LocationType, UnitSubtype, MeasurementUnit } from './wms-types'

// --- Location Type Config ---

export const LOCATION_TYPE_CONFIG: Record<LocationType, {
  label: string
  icon: string  // lucide icon name
  canHoldItems: boolean
  allowedChildren: LocationType[]
}> = {
  room: {
    label: 'Room',
    icon: 'DoorOpen',
    canHoldItems: true,
    allowedChildren: ['zone', 'unit', 'compartment'],
  },
  zone: {
    label: 'Zone / Area',
    icon: 'LayoutGrid',
    canHoldItems: true,
    allowedChildren: ['unit', 'compartment'],
  },
  unit: {
    label: 'Storage Unit',
    icon: 'Archive',
    canHoldItems: true,
    allowedChildren: ['compartment'],
  },
  compartment: {
    label: 'Compartment',
    icon: 'Box',
    canHoldItems: true,
    allowedChildren: ['compartment'],  // bins can nest (bin on a shelf)
  },
}

// --- Unit Subtype Config ---

export const UNIT_SUBTYPE_CONFIG: Record<UnitSubtype, {
  label: string
  icon: string
  parentTypes: LocationType[]
}> = {
  rack: { label: 'Rack', icon: 'Server', parentTypes: ['room', 'zone'] },
  cabinet: { label: 'Cabinet / Tool Chest', icon: 'Archive', parentTypes: ['room', 'zone'] },
  closet: { label: 'Closet', icon: 'DoorClosed', parentTypes: ['room', 'zone'] },
  drawer: { label: 'Drawer', icon: 'Inbox', parentTypes: ['unit', 'compartment'] },
  shelf: { label: 'Shelf', icon: 'Minus', parentTypes: ['unit', 'compartment'] },
  bin: { label: 'Bin / Box', icon: 'Package', parentTypes: ['compartment'] },
  pegboard: { label: 'Pegboard / Wall', icon: 'Grid3X3', parentTypes: ['room', 'zone'] },
  hanging_rod: { label: 'Hanging Rod', icon: 'GripHorizontal', parentTypes: ['unit', 'compartment'] },
  floor: { label: 'Floor Space', icon: 'Square', parentTypes: ['room', 'zone', 'unit'] },
  custom: { label: 'Custom', icon: 'Settings', parentTypes: ['room', 'zone', 'unit', 'compartment'] },
}

// --- SAMLA Bin Dimensions ---

export const SAMLA_BINS = [
  // IKEA SAMLA
  { id: 'samla_1gal',  name: 'SAMLA 1 gal',  widthIn: 11,    depthIn: 7.5,   heightIn: 5.5,  volumeGal: 1 },
  { id: 'samla_3gal',  name: 'SAMLA 3 gal',  widthIn: 11,    depthIn: 15.25, heightIn: 5.5,  volumeGal: 3 },
  { id: 'samla_6gal',  name: 'SAMLA 6 gal',  widthIn: 11,    depthIn: 15.25, heightIn: 11,   volumeGal: 6 },
  { id: 'samla_12gal', name: 'SAMLA 12 gal', widthIn: 22,    depthIn: 15.25, heightIn: 11,   volumeGal: 12 },
  { id: 'samla_15gal', name: 'SAMLA 15 gal', widthIn: 30.75, depthIn: 22,    heightIn: 7,    volumeGal: 15 },
  { id: 'samla_17gal', name: 'SAMLA 17 gal', widthIn: 22.5,  depthIn: 15.25, heightIn: 16.5, volumeGal: 17 },
  { id: 'samla_34gal', name: 'SAMLA 34 gal', widthIn: 30.75, depthIn: 22,    heightIn: 17,   volumeGal: 34 },
  // Ammo cans
  { id: 'ammo_30cal',  name: '.30 Cal Ammo Can',  widthIn: 3.5,  depthIn: 10.9,  heightIn: 7.3,  volumeGal: 1.2 },
  { id: 'ammo_50cal',  name: '.50 Cal Ammo Can',  widthIn: 5.5,  depthIn: 11.5,  heightIn: 8.5,  volumeGal: 2.3 },
  { id: 'ammo_fat50',  name: 'Fat .50 Cal Can',   widthIn: 7.5,  depthIn: 11.5,  heightIn: 8.5,  volumeGal: 3.2 },
  { id: 'ammo_20mm',   name: '20mm Ammo Can',     widthIn: 7.5,  depthIn: 14.5,  heightIn: 10,   volumeGal: 4.7 },
  // Plano / Tackle
  { id: 'plano_3600',  name: 'Plano 3600',  widthIn: 9,    depthIn: 14,   heightIn: 2,    volumeGal: 1.1 },
  { id: 'plano_3700',  name: 'Plano 3700',  widthIn: 11,   depthIn: 14,   heightIn: 2,    volumeGal: 1.3 },
  // Sterilite
  { id: 'sterilite_6qt',  name: 'Sterilite 6 qt',   widthIn: 8.25,  depthIn: 13.6,  heightIn: 4.9,  volumeGal: 1.5 },
  { id: 'sterilite_16qt', name: 'Sterilite 16 qt',  widthIn: 11.9,  depthIn: 16.8,  heightIn: 6.1,  volumeGal: 4 },
  { id: 'sterilite_28qt', name: 'Sterilite 28 qt',  widthIn: 13.5,  depthIn: 16.3,  heightIn: 6.5,  volumeGal: 7 },
  { id: 'sterilite_66qt', name: 'Sterilite 66 qt',  widthIn: 17.1,  depthIn: 23.6,  heightIn: 6.6,  volumeGal: 16.5 },
] as const

// --- OMAR Rack Specs ---

export const OMAR_RACK = {
  widthIn: 36.25,
  depthIn: 16,
  heightIn: 72,
  shelves: 6,
  shelfHeightIn: 11.5,
} as const

// --- Shelf Capacity Calculator ---

export function binsFitOnShelf(
  shelfWidthIn: number,
  shelfDepthIn: number,
  binWidthIn: number,
  binDepthIn: number,
): number {
  // Try both orientations and return the better fit
  const orientA = Math.floor(shelfWidthIn / binWidthIn) * Math.floor(shelfDepthIn / binDepthIn)
  const orientB = Math.floor(shelfWidthIn / binDepthIn) * Math.floor(shelfDepthIn / binWidthIn)
  return Math.max(orientA, orientB)
}

export function binFitsShelfHeight(shelfHeightIn: number, binHeightIn: number): boolean {
  return binHeightIn <= shelfHeightIn
}

export function binsStackable(shelfHeightIn: number, binHeightIn: number): number {
  return Math.floor(shelfHeightIn / binHeightIn)
}

// Pre-computed: which SAMLA bins fit on an OMAR shelf
export const SAMLA_ON_OMAR = SAMLA_BINS.map((bin) => ({
  ...bin,
  fitsOnShelf: bin.depthIn <= OMAR_RACK.depthIn && bin.widthIn <= OMAR_RACK.widthIn,
  fitsHeight: binFitsShelfHeight(OMAR_RACK.shelfHeightIn, bin.heightIn),
  perShelf: binsFitOnShelf(OMAR_RACK.widthIn, OMAR_RACK.depthIn, bin.widthIn, bin.depthIn),
  stackable: binsStackable(OMAR_RACK.shelfHeightIn, bin.heightIn),
}))

// --- Measurement Units ---

export const MEASUREMENT_UNITS: { value: MeasurementUnit; label: string; category: string }[] = [
  { value: 'each',   label: 'Each',         category: 'Count' },
  { value: 'bags',   label: 'Bags',         category: 'Count' },
  { value: 'rolls',  label: 'Rolls',        category: 'Count' },
  { value: 'boxes',  label: 'Boxes',        category: 'Count' },
  { value: 'packs',  label: 'Packs',        category: 'Count' },
  { value: 'feet',   label: 'Feet',         category: 'Length' },
  { value: 'inches', label: 'Inches',       category: 'Length' },
  { value: 'yards',  label: 'Yards',        category: 'Length' },
  { value: 'meters', label: 'Meters',       category: 'Length' },
  { value: 'oz',     label: 'Ounces (wt)',  category: 'Weight' },
  { value: 'lb',     label: 'Pounds',       category: 'Weight' },
  { value: 'g',      label: 'Grams',        category: 'Weight' },
  { value: 'kg',     label: 'Kilograms',    category: 'Weight' },
  { value: 'ml',     label: 'Milliliters',  category: 'Volume' },
  { value: 'l',      label: 'Liters',       category: 'Volume' },
  { value: 'fl_oz',  label: 'Fluid Ounces', category: 'Volume' },
  { value: 'gal',    label: 'Gallons',      category: 'Volume' },
  { value: 'sq_ft',  label: 'Square Feet',  category: 'Area' },
  { value: 'sq_in',  label: 'Square Inches', category: 'Area' },
]

export function getUnitLabel(unit: MeasurementUnit): string {
  return MEASUREMENT_UNITS.find((u) => u.value === unit)?.label ?? unit
}
