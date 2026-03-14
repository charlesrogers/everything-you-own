  
**PRODUCT SPEC**

**Catherine’s Purchase Tracker**

*A personal product database for tracking purchases, wishlists, and collections*

Version 1.0  |  March 2026

Platform: Next.js \+ Vercel \+ Supabase

Status: Draft for Review

# **1\. Executive Summary**

Catherine’s Purchase Tracker is a personal product database that lets Catherine (and optionally other household members) catalog every product she buys, organize items into a browsable taxonomy, track spending over time, coordinate outfits and product collections, manage returns and warranties, and avoid duplicate purchases. The system will eventually integrate with Gmail to auto-import purchases from order confirmation emails.

**Core problem:** Catherine buys products across dozens of retailers and product categories. Without a centralized system, it’s easy to lose track of what’s been purchased, accidentally re-buy items, miss return windows, or forget which products pair well together.

**Target user:** Catherine (primary), Charles (secondary/admin), with multi-user support architected from day one.

**Deployment:** Next.js application hosted on Vercel, with Supabase (Postgres \+ Auth \+ Storage) as the backend. Responsive design for desktop and mobile use.

# **2\. Product Taxonomy**

The taxonomy is the backbone of the system. It uses a three-level hierarchy that balances structure with flexibility.

## **2.1 Hierarchy Structure**

| Level | Example Path | Description |
| :---- | :---- | :---- |
| Category | Jewelry | Top-level grouping. System-defined with user-extensible options. |
| Subcategory | Jewelry \> Rings | Second-level grouping. Pre-populated but user-editable. |
| Product | Jewelry \> Rings \> Mejuri Bold Ring | The individual item with full metadata. |

## **2.2 Default Categories**

The system ships with a comprehensive default taxonomy. Users can add, rename, hide, or reorganize categories at any time. Suggested defaults include:

* **Jewelry:** Rings, Necklaces, Bracelets, Earrings, Watches, Brooches/Pins

* **Clothing:** Tops, Bottoms, Dresses, Outerwear, Activewear, Swimwear, Intimates, Sleepwear

* **Shoes:** Sneakers, Boots, Heels, Sandals, Flats, Athletic

* **Beauty & Skincare:** Face, Eyes, Lips, Body, Hair, Nails, Fragrance, Tools/Applicators

* **Bags & Accessories:** Handbags, Wallets, Belts, Scarves, Hats, Sunglasses, Phone Cases

* **Home:** Kitchen, Bedroom, Bathroom, Living Room, Decor, Storage/Organization

* **Kids & Baby:** Clothing, Toys, Gear, Nursery, Feeding, Diapers & Bath

* **Health & Wellness:** Supplements, Fitness Equipment, Personal Care, Medical/First Aid

* **Electronics:** Devices, Accessories, Chargers/Cables, Smart Home

* **Groceries & Consumables:** Pantry, Beverages, Snacks, Household Supplies, Pet Supplies

## **2.3 Taxonomy Rules**

* Every product must belong to exactly one Category \> Subcategory path.

* Categories and subcategories are user-editable. Adding a new subcategory is a one-click inline action.

* A product can optionally have user-defined tags (unlimited, freeform) for cross-cutting concerns like “gift idea,” “travel,” or “summer 2026.”

* The taxonomy tree is displayed as a collapsible sidebar for browsing, with product counts at each node.

# **3\. Data Model**

## **3.1 Product Record**

Each product in the database carries the following fields:

| Field | Type | Required | Notes |
| :---- | :---- | :---- | :---- |
| **id** | UUID | Auto | Primary key, auto-generated |
| **name** | String | Yes | Product display name |
| **brand** | String | No | Manufacturer or brand name |
| **category\_id** | FK | Yes | Reference to category tree |
| **subcategory\_id** | FK | Yes | Reference to subcategory |
| **description** | Text | No | Free-text product description |
| **image\_url** | String | No | Primary product image (stored in Supabase Storage) |
| **additional\_images** | String\[\] | No | Array of additional image URLs |
| **source\_url** | URL | No | Original product page URL |
| **retailer** | String | No | Where it was purchased (Amazon, Sephora, etc.) |
| **price** | Decimal | No | Purchase price in USD |
| **original\_price** | Decimal | No | List price before discounts |
| **currency** | String | No | Default USD, supports international |
| **purchase\_date** | Date | No | When it was bought |
| **date\_added** | Timestamp | Auto | When the record was created |
| **status** | Enum | Yes | purchased | wishlist | returned | gifted | sold |
| **sku** | String | No | Retailer SKU or product ID |
| **upc** | String | No | Universal product code / barcode |
| **weight** | Decimal | No | Weight with unit (g, oz, lb) |
| **weight\_unit** | Enum | No | g | oz | lb | kg |
| **volume** | Decimal | No | Volume with unit (ml, fl oz) |
| **volume\_unit** | Enum | No | ml | fl\_oz | l | gal |
| **dimensions** | JSON | No | Length, width, height with units |
| **material** | String | No | Primary material (gold, cotton, ceramic, etc.) |
| **color** | String | No | Color name and/or hex code |
| **size** | String | No | Size designation (S/M/L, 7, 32x30, etc.) |
| **condition** | Enum | No | new | used | refurbished |
| **rating** | Integer | No | Personal 1–5 star rating |
| **notes** | Text | No | Personal notes, review, fit notes |
| **return\_by\_date** | Date | No | Return window deadline |
| **warranty\_expires** | Date | No | Warranty expiration date |
| **order\_id** | String | No | Retailer order number |
| **tags** | String\[\] | No | User-defined freeform tags |
| **created\_by** | FK | Yes | User who added this product |
| **household\_id** | FK | Yes | Multi-user household grouping |

## **3.2 Product Relationships**

The relationship system is a core differentiator. Products can be linked to other products via typed, bidirectional relationships stored in a junction table.

| Relationship Type | Example | Behavior |
| :---- | :---- | :---- |
| outfit\_ensemble | Black dress \+ Gold earrings \+ Heels | Groups items into named outfits/looks. An item can belong to multiple outfits. |
| goes\_with | Teal scarf ↔ Navy coat | Loose pairing. Bidirectional. Surfaced as suggestions when viewing either item. |
| variant\_of | Same lipstick, shade Rose vs. Mauve | Links color/size/flavor variants of the same base product. Enables duplicate detection. |
| set\_member | Dinnerware set: plates \+ bowls \+ mugs | Groups items bought as a set. Tracks completeness if pieces are sold/broken. |
| repurchase\_of | Second bottle of same shampoo | Tracks repurchase history. Enables consumption rate analysis and reorder reminders. |
| parent\_child | Serum (parent) \+ Refill cartridge (child) | One-to-many. Child products are accessories or consumables for the parent. |
| replaced\_by | Old phone case → New phone case | Tracks product succession. Useful for warranty/upgrade tracking. |

### **Relationship Junction Table Schema**

* product\_a\_id (FK to products)

* product\_b\_id (FK to products)

* relationship\_type (enum of the types above)

* group\_name (optional, for named ensembles like “Date Night Look”)

* notes (optional, e.g. “wear the gold one with this, not the silver”)

* created\_at (timestamp)

# **4\. Image Handling Strategy**

Images are critical to the product browsing experience. The system supports multiple image acquisition methods, prioritized by reliability.

## **4.1 Acquisition Methods (Priority Order)**

* **Manual upload:** User drags/drops or selects an image from their device. Most reliable. Always available.

* **Browser extension clip:** A lightweight Chrome/Safari extension that adds a “Save to Tracker” button on any product page. Captures the primary product image, name, price, and URL in one click. Recommended primary flow.

* **URL-based extraction:** When a source\_url is provided, the system attempts to extract the Open Graph image (og:image meta tag) from the page. Works for \~70% of retailer sites. Falls back to manual upload.

* **Gmail auto-import:** Order confirmation emails sometimes include product thumbnails. Low resolution but useful as placeholders until replaced.

## **4.2 Storage**

* All images are stored in Supabase Storage (S3-compatible) under a per-household bucket.

* Images are resized server-side to a max of 1200px on the longest edge for the primary display, with a 300px thumbnail generated for grid views.

* Original images are retained for potential future use (zoom, print, etc.).

* Supported formats: JPEG, PNG, WebP. HEIC from iPhone uploads is auto-converted to JPEG.

# **5\. Product Entry Flows**

## **5.1 Manual Entry**

The manual entry form is the baseline. It should be fast for the common case (name, category, price, image) and expandable for power users who want to fill every field. The form uses a progressive disclosure pattern: core fields are always visible, and an “Advanced” toggle reveals weight, volume, dimensions, material, SKU, warranty, etc.

## **5.2 URL Paste (Smart Import)**

When a user pastes a product URL, the system attempts to auto-populate fields by scraping the page’s structured data (JSON-LD, Open Graph tags, and meta tags). The user reviews and corrects the extracted data before saving. Extraction accuracy varies by retailer:

* **High confidence (\~90%+):** Amazon, Sephora, Nordstrom, Target, Ulta (well-structured product pages)

* **Medium confidence (\~60–80%):** DTC brands, Shopify stores (usually have JSON-LD)

* **Low confidence (\~30–50%):** Etsy, eBay, boutique sites (inconsistent markup)

## **5.3 Browser Extension (Phase 2\)**

A Chrome extension that injects a floating “Save” button on product pages. When clicked, it captures the current page’s product data and sends it to the API. The user can review/edit in-extension or defer to the main app. This is the recommended primary entry method because it captures data at the moment of browsing, before the user navigates away.

## **5.4 Gmail Integration (Phase 3\)**

A Gmail plugin (Google Workspace Add-on) that scans incoming order confirmation emails and extracts purchase data. See Section 8 for the detailed Gmail architecture.

# **6\. Search, Browse, and Duplicate Detection**

## **6.1 Browse Experience**

The main interface is a filterable, sortable product grid. The left sidebar shows the taxonomy tree (collapsible). Clicking a category/subcategory filters the grid. The grid supports two view modes: card view (image-forward, 3–4 columns) and list view (compact, more metadata visible). Filters include category, subcategory, retailer, price range, status, date range, tags, color, and rating.

## **6.2 Search**

Full-text search across product name, brand, description, notes, and tags. Search is powered by Supabase’s built-in full-text search (tsvector/tsquery) for fast, typo-tolerant results. Results are ranked by relevance with category/brand matches boosted.

## **6.3 Duplicate Detection**

This is a primary use case. The system detects potential duplicates through multiple signals:

* **Exact match:** Same SKU, UPC, or source\_url already exists in the database. Hard block with “You already own this” message.

* **Fuzzy match:** Similar product name \+ same brand \+ same category. Soft warning: “You may already have something similar” with a comparison view.

* **Variant match:** Same base product but different color/size. Links to existing variants via the variant\_of relationship type.

Duplicate detection runs both at entry time (before saving) and as a background job that flags potential duplicates in the existing database.

# **7\. Outfit and Collection Management**

Outfits and collections are first-class objects in the system, not just tags. They are implemented as named groups of product relationships.

## **7.1 Outfits (Ensembles)**

* A named group of products that form a complete look (e.g., “Friday Date Night”).

* Displayed as a visual collage/mood board with all component images arranged together.

* A product can belong to unlimited outfits.

* Outfits can be tagged with occasions (casual, formal, work, date, travel, etc.).

* Creating an outfit: select products from the grid or use drag-and-drop in a dedicated outfit builder view.

## **7.2 Collections**

User-defined groups for any purpose. Unlike outfits, collections have no implied “worn together” semantics. Examples: “Gifts for Mom,” “Kitchen Renovation,” “Products to Try.” Collections can be shared with other household members or exported as a shareable link.

# **8\. Gmail Integration Architecture**

The Gmail integration is the highest-complexity feature and is scoped for Phase 3\. It operates as a Google Workspace Add-on that processes order confirmation emails.

## **8.1 How It Works**

* The user authorizes the add-on to read their Gmail (read-only scope).

* The add-on runs a background scan that identifies order confirmation emails using sender patterns, subject line heuristics, and email body analysis.

* For each identified order email, an LLM (Claude API via Anthropic) parses the email body to extract: product name(s), price(s), retailer, order ID, product images (if embedded), and estimated delivery date.

* Extracted products are pushed to the tracker API as draft entries with status “pending\_review.”

* Catherine reviews drafts in the main app, corrects any errors, assigns categories, and confirms.

## **8.2 LLM Parsing Strategy**

Order confirmation emails have zero standardization across retailers. Rather than building brittle per-retailer templates, the system uses Claude as the parsing engine. The prompt includes the raw email HTML and asks for structured JSON output with product details. This approach handles the long tail of retailers without per-site maintenance. Cost estimate: \~$0.01–0.03 per email parsed using Claude Haiku.

## **8.3 Retailer Sender Patterns**

The system maintains a curated list of known retailer sender addresses to improve email detection accuracy. Examples: auto-confirm@amazon.com, noreply@sephora.com, orders@nordstrom.com. Unknown senders are still processed if the email body matches order confirmation heuristics.

## **8.4 Privacy and Data Handling**

* Email content is processed in-transit and not stored. Only extracted product data is persisted.

* The LLM API call uses ephemeral processing — no email content is retained by Anthropic.

* Users can revoke Gmail access at any time from the app settings.

* The add-on never modifies, deletes, or sends emails.

# **9\. Multi-User and Household Model**

The system is designed for household use from day one, even if Catherine is the only initial user.

* Each user has their own account (Supabase Auth, supports Google OAuth for easy sign-in).

* Users belong to a household. A household shares a single product database.

* Permissions: Owner (full CRUD \+ settings \+ invite), Member (full CRUD), Viewer (read-only).

* Products track created\_by so you can filter by “My purchases” vs. “All household purchases.”

* Household invitations are sent via email with a magic link.

# **10\. Tech Stack and Architecture**

| Layer | Technology |
| :---- | :---- |
| Frontend | Next.js 14+ (App Router), React, Tailwind CSS, shadcn/ui |
| Backend/API | Next.js API Routes \+ Supabase client SDK (no separate server) |
| Database | Supabase (PostgreSQL) with Row Level Security |
| Auth | Supabase Auth (Google OAuth \+ magic link email) |
| Image Storage | Supabase Storage (S3-compatible) with image transformation |
| Hosting | Vercel (automatic deployments from GitHub) |
| Email Parsing | Claude API (Haiku) for LLM-based order email extraction |
| URL Scraping | Cheerio (server-side HTML parsing for og:image and JSON-LD) |
| Search | Supabase full-text search (tsvector) \+ optional Typesense for advanced faceting |
| Browser Extension | Chrome Extension (Manifest V3) \+ Safari Web Extension |

# **11\. Phased Roadmap**

## **Phase 1: Foundation (Weeks 1–4)**

Ship a fully functional product database with manual entry, taxonomy browsing, and duplicate detection.

* Supabase project setup: database schema, RLS policies, auth configuration

* Product CRUD: create, read, update, delete with all core fields

* Taxonomy management: category/subcategory tree with inline editing

* Image upload: drag-and-drop with automatic resizing and thumbnail generation

* Product grid: card view, list view, filtering, sorting, full-text search

* Duplicate detection: SKU/URL exact match \+ fuzzy name/brand matching

* Responsive layout: works on desktop and mobile Safari/Chrome

* Multi-user: household model, Google OAuth, invitation flow

## **Phase 2: Smart Import \+ Relationships (Weeks 5–8)**

Add URL-based auto-import, the relationship system, and outfit management.

* URL paste smart import: auto-extract product data from pasted URLs via server-side scraping

* Product relationships: full relationship type system with UI for linking products

* Outfit builder: visual outfit creator with drag-and-drop

* Collections: user-defined product groups with sharing

* Chrome extension: “Save to Tracker” button with in-extension preview

* Dashboard: spending by category, purchase timeline, most-purchased brands

## **Phase 3: Gmail Integration (Weeks 9–12)**

The Gmail integration and analytics layer.

* Google Workspace Add-on: Gmail sidebar for reviewing detected purchases

* LLM email parser: Claude Haiku integration for order confirmation extraction

* Draft review flow: pending imports queue with bulk approve/edit/dismiss

* Return deadline alerts: push notifications for approaching return windows

* Warranty tracking: expiration reminders and warranty document storage

* Advanced analytics: consumption rate tracking, reorder suggestions, year-in-review

# **12\. Database Schema (Supabase/PostgreSQL)**

The following is the core schema. All tables include Row Level Security policies scoped to household\_id.

## **12.1 Core Tables**

### **households**

* id (UUID, PK), name (text), created\_at (timestamptz), created\_by (UUID, FK to auth.users)

### **household\_members**

* household\_id (UUID, FK), user\_id (UUID, FK), role (enum: owner | member | viewer), joined\_at (timestamptz)

### **categories**

* id (UUID, PK), household\_id (UUID, FK), name (text), sort\_order (int), is\_default (bool)

### **subcategories**

* id (UUID, PK), category\_id (UUID, FK), name (text), sort\_order (int), is\_default (bool)

### **products**

* All fields from Section 3.1, with household\_id for RLS and full-text search index on name, brand, description, notes

### **product\_relationships**

* id (UUID, PK), product\_a\_id (UUID, FK), product\_b\_id (UUID, FK), relationship\_type (enum), group\_name (text, nullable), notes (text, nullable), created\_at (timestamptz)

### **outfits**

* id (UUID, PK), household\_id (UUID, FK), name (text), occasion\_tags (text\[\]), cover\_image\_url (text), notes (text), created\_by (UUID, FK), created\_at (timestamptz)

### **outfit\_items**

* outfit\_id (UUID, FK), product\_id (UUID, FK), sort\_order (int)

### **collections**

* id (UUID, PK), household\_id (UUID, FK), name (text), description (text), is\_shared (bool), share\_token (text, unique), created\_by (UUID, FK), created\_at (timestamptz)

### **collection\_items**

* collection\_id (UUID, FK), product\_id (UUID, FK), added\_at (timestamptz)

### **gmail\_imports**

* id (UUID, PK), household\_id (UUID, FK), user\_id (UUID, FK), email\_message\_id (text), retailer (text), raw\_extraction (jsonb), status (enum: pending | approved | dismissed), processed\_at (timestamptz)

# **13\. Open Questions for Discussion**

* Should the taxonomy support a fourth level (e.g., Beauty \> Skincare \> Serums \> Vitamin C Serums), or is three levels sufficient with tags handling the long tail?

* Do we want price history tracking (i.e., record price at time of purchase AND track current retail price over time for deal detection)?

* Should the outfit builder support “virtual try-on” style image compositing, or is a simple grid/collage layout sufficient for v1?

* For the Gmail integration, should we also scan for shipping/delivery confirmation emails to auto-update product status?

* Do we need an export feature (CSV, printable PDF) for insurance documentation or Marie Kondo-style inventory?

* Should the browser extension support Safari on iOS (Safari Web Extensions), or is Chrome desktop sufficient for Phase 2?