

<!-- =========================== -->

Hi [Client Name],imit: Enforced in 

src/components/MapComponent.tsx
 within the fetchPermitData function (Line 246: .limit(500)).
Data Source: Directly querying the ca_permits table via Supabase client.
Rendering: Initialized as a geojson source in Mapbox (Line 453) with cluster: false.
Missing Infrastructure: Although there is a folder structure for src/app/api/tiles/[z]/[x]/[y], it is currently empty and not serving tiles. The map is still relying on the direct 500-limit query.
Recommendation: To fix the client's concern, we need to implement the SQL logic for ST_AsMVT in Supabase and hook up the /api/tiles route to serve these tiles to the map.
Would you like me to go ahead and implement the Vector Tiles (MVT) route now to remove this limit?

I understand your concern regarding the 500-record limit. Here is a clarification on why it is there and how we can upgrade the system to ensure 100% data reliability:

How the 500-Limit Works Currently:

The map uses viewport-based fetching. Every time you pan or zoom, the system asks the database for permits visible only in that specific window.
To keep the map fast and prevent browser crashes (since we are rendering raw data points), we currently limit each request to the 500 most relevant records (sorted by newest date or highest valuation).
The Problem: You are correct—in dense areas with 1,000+ permits, you are only seeing a 'representative sample.' This can make the map feel incomplete.
The "Property Permits" Success:

As you noted, we successfully implemented a cleaner 'deep-dive' system. When a specific property is selected, the system now prioritizes its full history and details in the side panel, which is much more reliable than trying to click through overlapping dots.
The Solution: Transitioning to Vector Tiles (Zillow Style):

To remove the 500-limit entirely, we should move to Dynamic Vector Tiles (MVT).
How it works: Instead of sending raw rows of data, the server generates 'data-tiles' that can handle hundreds of thousands of permits simultaneously.
Clustering: This would allow us to represent the 'Full Market Inventory' using clusters (e.g., a circle saying '50 permits' that breaks into individual dots as you zoom in), exactly as Zillow does.
I can begin transitioning the architecture to Vector Tiles to ensure every single permit in the database is represented on the map without performance loss or limits


Technical Summary of your System
Current Limit: Enforced in 

src/components/MapComponent.tsx
 within the fetchPermitData function (Line 246: .limit(500)).
Data Source: Directly querying the ca_permits table via Supabase client.
Rendering: Initialized as a geojson source in Mapbox (Line 453) with cluster: false.
Missing Infrastructure: Although there is a folder structure for src/app/api/tiles/[z]/[x]/[y], it is currently empty and not serving tiles. The map is still relying on the direct 500-limit query.
Recommendation: To fix the client's concern, we need to implement the SQL logic for ST_AsMVT in Supabase and hook up the /api/tiles route to serve these tiles to the map.
Would you like me to go ahead and implement the Vector Tiles (MVT) route now to remove this limit?
<!-- ================= AI Prometer/Developer notes ================== -->

I am building a permit intelligence SaaS platform.
Main table: ca_permits
Secondary table: builder_intelligence (Phase 3 — study schema only, no UI)
Rules to follow at all times:
- Build for 100k+ records
- Never load full dataset at once
- All filters must apply at Supabase query level (not frontend)
- Always use viewport bounds in every map data query
- Keep map fast — no lag on pan, zoom, or filter
- Structure everything so Phase 3 can be added without major refactoring
- Ask me before making any assumption
Start:

PROMPT 1 — Supabase Schema & Indexes
Set up the following indexes on the ca_permits Supabase table:

- lat + lng (float) — for map viewport queries
- city (text) — for city filtering
- neighborhood (text) — for neighborhood search
- contractor_license (text) — for license search
- permit_number (text) — for permit lookup
- issue_year (int) — for year sorting and filtering
- commercial (boolean) — for toggle filter
- residential (boolean) — for toggle filter
- basement (boolean) — for toggle filter
- hillside (boolean) — for toggle filter
- is_owner_builder (boolean) — for owner builder toggle

Valuation rule (apply at query level):
- Return valuation only if value >= 10000
- If valuation < 10000, return null for that field

Make sure all queries use these indexes.
Never do full table scans.

PROMPT 2 — Mapbox Map Setup
Set up Mapbox GL JS in React.

Requirements:
- Map loads immediately on page open
- Default view: Los Angeles area
- Permit dots visible on initial load without user needing to zoom
- Map style: dark or clean professional look
- Layout:
  * Map fills left/center of screen
  * List view panel on the right side
  * Side panel slides in from the left over the map
- Do not load any data until map is fully initialized

PROMPT 3 — Viewport-Based Data Loading
Implement viewport-based permit loading from Supabase.

Logic:
- On map load, get current map bounds 
  (northeast lat/lng + southwest lat/lng)
- Query Supabase ca_permits WHERE lat/lng 
  is within those bounds
- Load in batches — max 500 records per fetch
- Re-fetch automatically when user pans or zooms
- Never load all records at once
- Show loading indicator while fetching

Supabase query example:
.gte('lat', southWest.lat)
.lte('lat', northEast.lat)
.gte('lng', southWest.lng)
.lte('lng', northEast.lng)
.limit(500)


PROMPT 4 — Permit Dots on Map
Render permit dots on Mapbox map using Supabase data.
Requirements:
- Each permit = one clickable dot on map
- Dots only show within current visible viewport
- When map moves, old dots remove and new dots load
- Use Mapbox GeoJSON source + layer for performance
- Do NOT use client-side clustering
- Structure must be vector tile-ready for future migration
- Dot color varies by permit type:
  * Builder = one color
  * Trade = another color
  * Architect = another color

PROMPT 5 — Dot Click → Popup

When user clicks a permit dot, show a popup.

Free tier popup fields:
- Address
- City
- Zip code
- State
- Issue date
- Contractor name
- Contractor license
- Square feet
- Work description
- Permit type
- Valuation (show only if >= $10,000)
- Clickable LADBS permit link (opens new tab)
- Button at bottom: "View More Details"

Popup closes when user clicks elsewhere on map.

PROMPT 6 — Left Side Panel
When user clicks "View More Details", open left side panel.
Requirements:
- Panel slides in from left over the map
- Collapse arrow to hide panel
- Panel updates when user clicks new dot (does not close)
- Only closes when user clicks the arrow

Fields shown by subscription tier:

FREE TIER:
- Address, city, zip, state
- Contractor name + license
- Permit type, issue date
- Square feet, work description
- Valuation (if >= $10,000)
- Clickable LADBS link

$75/month — RESIDENTIAL adds:
- Permit number
- Project type
- Architect name + license
- Permit expeditor
- APN
- Geologist + geologist license

$125/month — COMMERCIAL adds:
- Project category
- Engineer name + license
- Permit link

$175/month — ENTERPRISE:
- All columns unlocked
- Amount of permits pulled
- Amount of addresses worked on

Locked fields show: 🔒
Clicking locked field shows:
"Upgrade your plan to unlock this information"

PROMPT 7 — Search Bar (Above Map)
Add search bar positioned above the map area 
(not on the map itself).

Search supports:
- Neighborhood name 
  (Pacific Palisades, Santa Monica, Brentwood etc.)
- Full or partial address

On search:
- Map zooms and pans to that location
- Data re-fetches for new visible bounds
- List view updates to match

Query runs against neighborhood column in Supabase.
Search bar sits above map in the UI layout.

PROMPT 8 — Contractor License Search Tab
Create a separate tab for contractor license search
(not the map search bar — completely separate tab).

Requirements:
- User types contractor license number
- Results show all permits tied to that license

Each result displays:
- Address
- Permit type
- Issue date
- Permit number
- Clickable LADBS permit link

Query runs against contractor_license 
index in Supabase.
This is also Phase 3 prep for builder profile pages.

PROMPT 9 — Mode Selection + Sub-filters
Add mode selection UI above map, below search bar.

Modes:
1. Builder
2. Architect
3. Engineer
4. Trade Contractors
5. Permit Expeditor

Each mode filters at Supabase query level.
Map dots and list view update instantly on mode select.

Builder sub-filters:
- New Builds
- ADU
- Remediation

Trade Contractors sub-filters (checkbox):
- Electrical
- Plumbing
- Mechanical
- Grading
- Retaining Walls
- Swimming Pool / Spa
- Demolition
- Roofing
- Septic

All sub-filters apply at Supabase query level.
Filters persist until "Clear All" is clicked.


PROMPT 10 — On-Map Toggles
Add toggle buttons on map UI for quick filtering.

Toggles (each queries boolean field directly):
1. Commercial → WHERE commercial = true
2. Residential → WHERE residential = true
3. Basement → WHERE basement = true
4. Hillside → WHERE hillside = true
5. Owner Builder → WHERE is_owner_builder = true

Requirements:
- Toggles combine with mode selection filters
- All toggle filters apply at Supabase query level
- Map and list update instantly on toggle
- Active toggles are visually highlighted
- Toggles use boolean fields directly 
  (no SQL ILIKE or text matching)

PROMPT 11 — List View (Right Side)

Build list view panel on right side of map.

Requirements:
- Shows all permits in current map viewport
- Updates in real time when map moves or filters change
- User can toggle between map view and list view
- Map and list always fully synced

Each list item shows:
- Contractor / builder name
- Address
- Permit type
- Issue date
- Valuation (if >= $10,000)

Default sort: Most Active
(contractor with most permits shows first)

Sort options:
1. Most Active (default)
2. Valuation — high to low
3. A to Z — contractor name
4. Contractor years in business
5. Permit year — newest first

Sorting applies at Supabase query level.

PROMPT 12 — Multi-City Support
Build multi-city support into filter and search.

Cities to support now:
- Los Angeles
- Beverly Hills
- Malibu
- Santa Monica

Structure must support adding more cities 
easily in future.

Requirements:
- City field indexed in Supabase
- Neighborhood field indexed 
  (zip-based neighborhoods within LA)
- User can filter or search by city
- Switching city re-fetches data for that 
  city's bounds
- No major refactoring needed to add new cities

PROMPT 13 — Final Performance & Scalability Check
Review the full system and confirm every item below 
is working correctly before finishing:

MAP & DATA:
✅ No full dataset loading anywhere in codebase
✅ Viewport bounds sent with every Supabase query
✅ Pagination working (max 500 per fetch)
✅ Auto re-fetch on pan and zoom
✅ Map does not lag on pan, zoom, or filter

FILTERS:
✅ All filters apply at Supabase query level
✅ All indexes created and being used
✅ Filters persist until Clear All clicked
✅ Mode selection working with sub-filters
✅ All toggles query boolean fields directly
✅ Commercial + residential use boolean fields
✅ is_owner_builder uses boolean field

DATA RULES:
✅ Valuation hidden if under $10,000
✅ LADBS permit link clickable on every permit
✅ Contractor license search tab working

UI & PANELS:
✅ Side panel updates without closing on new dot click
✅ Side panel collapses with arrow
✅ List view synced with map at all times
✅ Lock icon shows on restricted tier fields
✅ Upgrade prompt on locked field click

SCALABILITY:
✅ Vector tile structure ready for future migration
✅ Multi-city structure supports future expansion
✅ builder_intelligence schema studied
✅ Phase 3 builder profile structure ready
✅ Contractor license indexed for Phase 3

REMINDER — Add This to Every Single Prompt
Important:
- This system must handle 100k+ records
- Never load full dataset at once
- All filters at Supabase query level only
- Always include viewport bounds in map queries
- Build so Phase 3 can plug in without full rebuild
- Ask me before making any assumption



<!-- ================= Project requirements ================== -->
Here's the features list only:

🗺️ Map & Data
Mapbox map integration — Full Mapbox GL JS setup with proper token, style, and map container
Viewport-based data loading — Data fetches automatically based on current visible map bounds (northeast & southwest corners)
No full dataset loading — At no point will all 100k+ records load at once
Bound-based Supabase queries — Every query filters by lat/lng within visible bounds only
Pagination / lazy loading — Data loads in controlled batches, not all at once
Vector tile-ready structure — Code and DB structured so Mapbox vector tilesets can be added later without major refactoring
Auto-refresh on pan/zoom — Every time user moves or zooms the map, new data fetches for that area automatically
Initial load behavior — On first open, map shows permit dots for default visible area without requiring zoom

📍 Markers & Popups
Permit dots on map — Every permit in the visible area shows as a clickable dot
Dot click → popup — Clicking a dot opens a small popup with basic permit info
Popup fields (free tier) — Address, city, zip, contractor name, contractor license, permit type, issue date, valuation (if ≥ $10,000)
Clickable LADBS permit link — Every popup includes a direct clickable link to the LADBS permit page
"View more details" button — Appears at the bottom of popup
Left side panel — Clicking "View more details" opens an expanded left-side panel with full permit info
Side panel updates on new click — Clicking a different dot updates the side panel instantly without closing it
Side panel collapsible — Arrow button to hide/show the side panel
Panel over map — Panel overlays the map, arrow to hide it

🔍 Search
Search bar above map — Positioned above the map area (not on the map itself) for neighborhood or address search
Neighborhood search — User can type a neighborhood name (Pacific Palisades, Santa Monica, etc.) and map updates
Address search — User can type a full or partial address and map zooms to that location
Contractor license search — Separate tab from map search. User types a license number and sees all permits tied to that license
License search results — Shows: address, permit type, issue date, clickable LADBS link, permit number
Multi-city search — User can search or filter by city (Los Angeles, Beverly Hills, Malibu, etc.)

🎛️ Filters & Mode Selection
Mode selection — User first selects what they are looking for:
Builder
Architect
Engineer
Trade Contractors
Permit Expeditor
Builder sub-filters — After selecting Builder mode:
New Builds
ADU
Remediation
Trade Contractor sub-filters — After selecting Trade mode (checkbox selection):
Electrical
Plumbing
Mechanical
Grading
Retaining Walls
Swimming Pool / Spa
Demolition
Roofing
Septic
All filters at Supabase query level — No frontend-only filtering. Every filter hits the database directly
Filters persist — Selected filters stay active until user clicks "Clear All"
Clear All button — Resets all active filters at once

🔘 On-Map Toggles (all query Boolean fields directly)
Commercial toggle → queries commercial boolean field directly
Residential toggle → queries residential boolean field directly
Basement toggle → queries basement boolean field directly
Hillside toggle → queries hillside boolean field directly
Owner Builder toggle → queries owner_builder boolean field (after Melody runs Python script)

📋 List View
List view panel — Right side of map shows list of permits matching current filters and viewport
Map + list fully synced — Any filter, search, or map movement instantly updates both map and list
Toggle map / list view — User can switch between map-only and list view
Default sort — Most Active — List shows most active builders/contractors first by default
Sort by Valuation — High to low
Sort by A to Z — Contractor or builder name alphabetically
Sort by contractor years in business — From builder_intelligence table (Phase 3 ready)
Sort by permit year — Most recent to oldest

🔒 Subscription Tier Structure
All data stored — Every field in ca_permits is stored regardless of tier. Access is restricted, not removed
Free tier fields visible:
Address
City
Zip code
State
Issue date
Contractor name
Contractor license
Square feet
Work description
Permit type
Valuation (only if ≥ $10,000)
$75/month — Residential tier adds:
Permit number
Project type
Architect name
Architect license
Permit expeditor
APN
Geologist
Geologist license
$125/month — Commercial tier adds:
Project category
Engineer name
Engineer license
Permit link (clickable)
$175/month — Enterprise tier:
All columns unlocked
Amount of permits pulled
Amount of addresses worked on
Lock icon — Lower-tier users see a 🔒 icon on restricted fields
Upgrade prompt — Clicking locked field shows "Upgrade to unlock this information"

💰 Valuation Rule
Show valuation — Only if value is $10,000 or higher
Hide valuation — If value is under $10,000, field is not displayed at all

🏙️ Multi-City & Neighborhood Support
City field indexed — Supports Los Angeles, Beverly Hills, Malibu, and future cities
Neighborhood field indexed — Zip-based neighborhood column (towns within LA city)
Filter by city — Dropdown or search to filter entire map by city
Filter by neighborhood — Search or select specific neighborhood within a city

⚙️ Database Indexes (confirmed)
lat/lng — For all map viewport queries
city — For city filtering
neighborhood — For neighborhood search
contractor_license — For license search and filtering
permit_number — For permit lookup
issue_year — For year sorting and filtering
commercial — Boolean, for toggle query
residential — Boolean, for toggle query
basement — Boolean, for toggle query
hillside — Boolean, for toggle query

🚀 Phase 3 Ready (structure only, no UI built)
builder_intelligence table studied — Schema fully understood before development starts
Contractor license indexed — Ready for builder profile page in Phase 3
All permits linked to license — Query structure ready for "view all permits by this contractor"
Side panel structure — Built in a way that Phase 3 builder profile page can plug in without full rebuild