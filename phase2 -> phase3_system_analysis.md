# Contractor License Search — System Audit & Feature Plan

## 1. What Is Already Built

| File | What It Does |
|---|---|
| `src/app/contractors/page.tsx` | Route entry point at `/contractors` — already in the sidebar |
| `src/app/contractors/ContractorSearchClient.tsx` | Basic search UI: input → Supabase query on `ca_permits` by `contractor_license` → shows permit list |
| `src/components/MapComponent.tsx` | Full Mapbox map: viewport-based fetcher, filters, side panel, popup, permit list |
| `src/app/map/page.tsx` | `/map` route that renders `MapComponent` |
| `src/app/dashboard/page.tsx` | Dashboard with total permits, residential/commercial counts, recent permits table |
| `src/components/Sidebar.tsx` | Nav: Dashboard → Map → **License Search** → Settings (already linked) |
| `src/lib/utils.ts` | `getLADBSLink()` helper — already used in both map and contractor search |
| `src/lib/supabase/client.ts` | Supabase browser client (reusable everywhere) |

---

## 2. What Fetchers / Data Are Already Working

### A. `ca_permits` Table Queries
Already used in THREE places:
- **Dashboard**: `totalPermits`, `commercialCount`, `residentialCount`, recent permits list
- **MapComponent**: Full viewport-based fetch with 20+ columns, all filters
- **ContractorSearchClient**: `.ilike('contractor_license', ...)` → permit list

### B. Fields Already Fetched From `ca_permits`
```
latitude, longitude, address, city, state, zip_code,
permit_number, issue_date, contractor, contractor_license,
square_feet, work_description, permit_type, valuation,
project_type, architect, architect_license, permit_expediter,
apn, geologist, geologist_license, project_category,
engineer, engineer_license, permit_link,
is_owner_builder, is_commercial, is_residential, is_hillside, is_basement
```

**All of these are ALREADY being fetched by MapComponent.** You do not need to re-create them.

### C. Category/Label Logic Already Built (in MapComponent)
- `is_residential` / `is_commercial` classification → ✅ ready
- `is_basement`, `is_hillside` → ✅ filter flags ready
- Builder / Trade / Architect / Engineer / Expeditor mode → ✅ ready
- Permit type → project label mapping (New Build, ADU, Retaining Wall, etc.) → ✅ partial

---

## 3. What the New Contractor License Search Feature Needs

Based on the requirements doc, these are the **new data needs**:

### A. `builder_intelligence` Table (NEW — does not exist yet)
This is the new table your client is uploading 5 contractors to.

Required fields:
```sql
contractor_license  TEXT  (join key)
business_name       TEXT
owner_name          TEXT
entity_type         TEXT  (e.g. Corporation)
license_status      TEXT  (e.g. Active)
license_class       TEXT  (e.g. B - General Building)
issue_date          DATE
expiration_date     DATE
price_indicator     TEXT  (Low / Moderate / High / Premium — future)
```

### B. New Fetcher: Builder Profile from `builder_intelligence`
```ts
// NEW — doesn't exist yet
const { data: builderProfile } = await supabase
  .from('builder_intelligence')
  .select('*')
  .eq('contractor_license', licenseNumber)
  .maybeSingle();
```

### C. Existing Fetcher: Permits by License from `ca_permits`
```ts
// ALREADY EXISTS in ContractorSearchClient — just needs more fields
const { data: permits } = await supabase
  .from('ca_permits')
  .select('address, city, permit_type, issue_date, permit_number, valuation,
           permit_link, is_commercial, is_residential, is_basement,
           is_hillside, latitude, longitude, work_description')
  .ilike('contractor_license', `%${license}%`)
  .order('issue_date', { ascending: false })
  .limit(200);
```

### D. Summary Stats (computed client-side from permit data — NO new fetcher)
- Total permits count → `permits.length`
- Total valuation → `permits.reduce((sum, p) => sum + p.valuation, 0)`
- Residential count → `permits.filter(p => p.is_residential).length`
- Commercial count → `permits.filter(p => p.is_commercial).length`
- Basement count → `permits.filter(p => p.is_basement).length`
- New build count → `permits.filter(p => p.permit_type?.toLowerCase().includes('new')).length`

---

## 4. Can You Reuse the Existing Map?

**YES — with a redirect approach.** Here's exactly how:

### Option A: Simple Redirect (Easiest — No New Code)
From `ContractorSearchClient`, after search, add a link:
```tsx
<Link href={`/map?license=${license}`}>
  View on Map →
</Link>
```
Then in `MapComponent`, read the URL param and pre-filter by that license.

### Option B: Embed a Small Mapbox Map Inside ContractorSearchClient
Create a lightweight `ContractorMapView` component that:
- Takes `permits[]` (already fetched) as props
- Uses the `latitude` and `longitude` from each permit
- Shows pins only for that contractor's projects
- On click, shows address + permit type + valuation popup

This is **completely separate** from `MapComponent.tsx` — no conflict at all.

---

## 5. Conflict Risk Assessment

| Risk Area | Risk Level | Notes |
|---|---|---|
| Supabase `ca_permits` queries | 🟢 NONE | Both can query independently, no shared state |
| MapComponent internal state | 🟢 NONE | It's self-contained, not shared globally |
| `getLADBSLink()` utility | 🟢 NONE | Already used in both files, no conflict |
| New `builder_intelligence` table | 🟢 NONE | Completely separate table, new fetcher |
| Sidebar nav | 🟢 NONE | `/contractors` link already exists |
| Mapbox token | 🟢 NONE | Same env var, safe to reuse in a new map instance |
| URL state if using redirect | 🟡 LOW | Need to handle `?license=` param in MapComponent carefully |

**Conclusion: Zero conflict risk.** The new fetchers for Contractor License Search are 100% additive — they don't touch MapComponent or any existing query.

---

## 6. Recommended Implementation Plan

### Step 1 — Supabase: Create `builder_intelligence` table
```sql
create table builder_intelligence (
  id uuid default gen_random_uuid() primary key,
  contractor_license text unique not null,
  business_name text,
  owner_name text,
  business_address text,
  city text,
  state text,
  zip_code text,
  entity_type text,
  license_status text,
  license_class text,
  issue_date date,
  expiration_date date,
  price_indicator text,  -- 'Low' | 'Moderate' | 'High' | 'Premium' | null
  created_at timestamptz default now()
);
```

### Step 2 — Upgrade `ContractorSearchClient.tsx`
Replace the current basic version with a full Builder Card page:
1. Search input (already exists) → triggers two fetches:
   - `builder_intelligence` → Builder Card / Business Info section
   - `ca_permits` → permit list + summary stats + map pins
2. Compute summary stats client-side (no extra DB calls)
3. Show Builder Card with all business info fields
4. Show Residential vs Commercial classification bar
5. Show summary stats grid
6. Show permit list with project labels on right side
7. Add mini Mapbox map showing work locations

### Step 3 — Optional: Map Redirect
Add "View All on Map" button that goes to `/map?license=XXXX`
MapComponent reads `?license` param and pre-filters (small addition, no conflict).

---

## 7. Summary Answer to Your Question

> **"Kon functionality gulo just redirect kore dile e hobe or existing system use korte parbo?"**

| Feature | Approach |
|---|---|
| Permit list by license | ✅ Already works — just add more fields to the SELECT |
| Total permits count | ✅ Compute from existing result array |
| Total valuation | ✅ Compute from existing result array |
| Residential / Commercial count | ✅ Compute from existing `is_residential`, `is_commercial` flags |
| Basement / New Build counts | ✅ Compute from existing `is_basement`, permit_type flags |
| Builder Card / Business Info | ❌ Needs new `builder_intelligence` table + new fetcher |
| Builder Activity Map | ✅ Reuse Mapbox — embed small map with permits' lat/lng (no conflict) |
| Price Indicator | ❌ Needs `price_indicator` column in `builder_intelligence` (future) |
| Project type labels | ✅ Derive from existing `permit_type`, `is_basement`, etc. |
| LADBS links | ✅ Already has `getLADBSLink()` utility |
| Address list of projects | ✅ From existing permit results |
