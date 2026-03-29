export const DEFAULT_TAXONOMY: Record<string, string[]> = {
  "Tools": ["Hand Tools", "Power Tools", "Sockets & Ratchets", "Wrenches", "Pliers & Cutters", "Measuring & Layout", "Tool Storage", "Fasteners & Hardware", "Batteries & Chargers", "Safety & PPE"],
  "Firearms & Weapons": ["Rifles", "Shotguns", "Pistols", "Suppressors & NFA", "Optics & Sights", "Parts & Upgrades", "Magazines", "Ammunition", "Holsters & Cases", "Cleaning & Maintenance", "Lights & Lasers", "Training & Targets"],
  "Clothing": ["Tops", "Bottoms", "Outerwear", "Activewear", "Tactical & Workwear", "Underwear & Base Layers", "Sleepwear", "Formalwear", "Jewelry & Watches", "Accessories"],
  "Shoes & Footwear": ["Sneakers", "Boots", "Sandals", "Athletic & Cycling", "Dress Shoes", "Slippers"],
  "Fitness & Sport": ["Gym Equipment", "Weights & Bars", "Racks & Rigs", "Accessories", "Cycling", "Tennis", "Outdoor & Camping", "Recovery"],
  "Electronics": ["Computers & Monitors", "Audio & Speakers", "Phones & Tablets", "Cables & Chargers", "Smart Home", "Photography & Cameras", "Networking"],
  "Home & Furniture": ["Furniture", "Lighting", "Bedding", "Kitchen", "Bathroom", "Storage & Organization", "Decor", "Appliances"],
  "Auto & Moto": ["Car Parts & Maintenance", "Motorcycle Parts", "Motorcycle Gear", "Jacks & Stands", "Detailing & Cleaning"],
  "Beauty & Grooming": ["Skincare", "Haircare", "Makeup & Cosmetics", "Fragrance", "Shaving & Grooming", "Tools & Applicators"],
  "Health & Medical": ["Supplements", "First Aid & Medical", "Personal Care", "Vision & Dental"],
  "Kids & Baby": ["Clothing", "Toys", "Gear & Equipment", "Nursery", "Feeding", "Bath & Care"],
  "Outdoor & Recreation": ["Camping & Hiking", "Hunting", "Fishing", "Coolers & Bags", "Knives & Multi-tools", "Optics"],
  "Media & Entertainment": ["Vinyl & Music", "Books", "Games", "Streaming & Subscriptions"],
  "Consumables & Supplies": ["Cleaning Supplies", "Office Supplies", "Tape & Adhesives", "Pet Supplies", "Groceries", "Household Chemicals"],
  "Services & Digital": ["Software", "Subscriptions", "Professional Services", "Insurance", "Memberships", "Domain Names"],
}

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "purchased", label: "Purchased" },
  { value: "wishlist", label: "Wishlist" },
  { value: "returned", label: "Returned" },
  { value: "gifted", label: "Gifted" },
  { value: "sold", label: "Sold" },
]

export const CONDITION_OPTIONS: { value: string; label: string }[] = [
  { value: "new", label: "New" },
  { value: "like_new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
]

export const OWNERSHIP_OPTIONS: { value: string; label: string }[] = [
  { value: "mine", label: "Mine" },
  { value: "household", label: "Household" },
  { value: "partner", label: "Partner" },
]

export const EXPENSE_TAGS = [
  "Business Expense",
  "Tax Writeoff",
  "Gift",
  "Reimbursable",
  "Shared Expense",
]
