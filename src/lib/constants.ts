export const DEFAULT_TAXONOMY: Record<string, string[]> = {
  "Jewelry": ["Rings", "Necklaces", "Bracelets", "Earrings", "Watches", "Brooches & Pins"],
  "Clothing": ["Tops", "Bottoms", "Dresses", "Outerwear", "Activewear", "Swimwear", "Intimates", "Sleepwear"],
  "Shoes": ["Sneakers", "Boots", "Heels", "Sandals", "Flats", "Athletic"],
  "Beauty & Skincare": ["Face", "Eyes", "Lips", "Body", "Hair", "Nails", "Fragrance", "Tools & Applicators"],
  "Bags & Accessories": ["Handbags", "Wallets", "Belts", "Scarves", "Hats", "Sunglasses", "Phone Cases"],
  "Home": ["Kitchen", "Bedroom", "Bathroom", "Living Room", "Decor", "Storage & Organization"],
  "Kids & Baby": ["Clothing", "Toys", "Gear", "Nursery", "Feeding", "Diapers & Bath"],
  "Health & Wellness": ["Supplements", "Fitness Equipment", "Personal Care", "Medical & First Aid"],
  "Electronics": ["Devices", "Accessories", "Chargers & Cables", "Smart Home"],
  "Groceries & Consumables": ["Pantry", "Beverages", "Snacks", "Household Supplies", "Pet Supplies"],
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
