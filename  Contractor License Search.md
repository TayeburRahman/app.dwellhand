# Feature Requirements & Implementation Plan: Contractor License Search

## 1. Executive Summary & Purpose
This document outlines the complete A-to-Z architecture, data integration, and UI/UX design plan for the **Contractor License Search (Builder Intelligence)** feature. 

The primary purpose is to allow advanced users (Commercial Subscriptions) to search for builders/contractors using their CSLB license number and view comprehensive "Builder Intelligence" data, including business details, permit history, work locations, and project types.

### Subscription Access Control
* **Homeowners:** Hidden/Restricted (Upgrade prompt will be shown).
* **Commercial:** Full access to Contractor Search, Builder Profile, Activity Map, and Permit History.
* **Enterprise (Future Phase):** Advanced filtering by full trade category, CSLB class, specialty, and pricing levels.

---

## 2. A-to-Z UI Design & Layout Strategy (Based on Client Wireframes)
The UI will follow a premium, modern, and data-rich design aesthetic (utilizing glassmorphism, crisp typography, and dynamic hover effects) while strictly adhering to the structure outlined in the two provided hand-drawn reference images.

### Section 1: Page Header & Search Flow
* **Page Title:** "Contractor License Search"
* **Subtitle:** "Look up permits tied to a contractor's license."
* **Access Badge:** A highly visible **"Commercial Subscription"** badge in the top right corner.
* **Search Input:** A centered, prominent input field labeled "Contractor License Number" (e.g., placeholder: `#1083426`) with an accompanying **Search** button.
* **Helper Text:** "Type in a contractor's license number to see build history and activity."

### Section 2: The "Builder Card" (Business Information)
Once a license is searched, the **RESULTS** section loads the "Builder Card." This data is exclusively pulled from the newly uploaded **Builder Intelligence** dataset.
* **Layout:** A clean, card-based layout displaying the official business profile.
* **Key Fields Displayed:**
  * Contractor/Business Name (e.g., LA Developing Incorporated)
  * Owner Name (e.g., Marek Strosnik)
  * Business Address (Street, City, State, ZIP)
  * License Number, Issue Date, and Expiration Date
  * Entity Type (e.g., Corporation)
  * License Status (e.g., Active)
  * License Class (e.g., B - General Building)
* **Builder Type Badges:** Just below or beside the business info, dynamic badges will classify the builder as **"Primarily Residential"** or **"Primarily Commercial"** (calculated based on their historical permit ratios).

### Section 3: Builder Activity Map
A large, interactive map section pulled from **CA-Permits** data.
* **Visuals:** A specialized Mapbox map isolated specifically for this builder.
* **Map Pins:** Physical pins dropping on all project addresses (New build, Basement, Alterations, Residential/Commercial).
* **Interactivity:** Clicking or hovering on a pin will reveal a small popup with: Address, Permit Number, Project Type, Valuation, Date Issued, Work Description, and Residential/Commercial Label.

### Section 4: Summary Statistics
Directly below the map, a grid of summary metrics will provide an at-a-glance overview of the builder's scale and history.
* Total Permits Issued
* Total Projects
* Total Commercial Projects
* Total Residential Projects
* Total Valuation (Aggregate sum)
* Total Basement Projects
* Total New Build Projects
* Total Alteration Projects
* Total Hillside/Grading Projects (if available)
* *Note: The wireframe mentions "Architects they work with"; if this data exists in the permit records, it will be aggregated and displayed here.*

### Section 5: Permit / Project Result List
A chronological, scrollable list of the contractor's permit history pulled from **CA-Permits**.
* **Card Structure:** Each record will be a distinct row/card.
* **Display Order:** Contractor/Builder Name, Matching project type count, Total Valuation, Price Indicator, List of addresses worked on, then the related permit records.
* **Left Side Data:** Permit Number | Address | Valuation | Permit Type | Unit Count (if available) | Date Issued | Work Description.
* **Right Side (Labels):** As strictly requested in the wireframe notes ("label on results to right side"), dynamic project tags will be aligned to the right. 
  * Examples: `[New Build (Basement)]`, `[Hillside]`, `[Retaining Wall]`, `[Hillside Grading]`, `[Alteration]`, `[Residential]`, `[Commercial]`.

### Section 6: Project Type Search / Filtering (Advanced Search)
To support detailed builder discovery, the UI will include a secondary filter alongside the main search bar to group or filter by project type.
* **Filter Options:** New Build, Basement, Hillside, Retaining Wall, Hillside Grading, Alteration, Residential, Commercial.
* **Expected Result Display:** When a user filters (e.g., "New Build" -> "Basement"), the result cards will dynamically update to show contractors who match this specific criteria, including the number of matching builds, total valuation for those specific projects, and the specific addresses worked on.

---

## 3. Data Architecture & Merging Strategy (Zero Conflict)
To achieve this design without disrupting the current application, we will use a **Dual-Source Data Strategy**:

1. **`builder_intelligence` (New Source):** 
   * A new database table will be created to house the 5 initial test contractors.
   * This table feeds the top half of the screen (The Builder Card / Business Information).
2. **`ca_permits` (Existing Source):** 
   * We will leverage the existing, highly tested permit database. 
   * By matching the searched `contractor_license`, we will instantly retrieve all map coordinates, valuations, issue dates, and project types.
3. **Backend Filtering Logic (Project Type Search):**
   * The Project Type filtering (Section 6) will be handled via dedicated Supabase backend queries on the `ca_permits` table (e.g., using `.ilike('permit_type', '%type%')` or `.eq('is_basement', true)`).
   * This backend logic will dynamically aggregate the results (e.g., fetching only basement projects for a specific license) and compute the valuations/counts exclusively for the filtered subset before returning the data to the UI.
4. **Conflict Prevention:** 
   * The new "Builder Activity Map" will be a lightweight, independent map component. It will **not** interfere with or alter the existing global Market Map (`MapComponent.tsx`). Both systems will operate safely in parallel.

---

## 4. Phase 3 Infrastructure & Future-Proofing
The underlying infrastructure built in this phase will be ready for the Enterprise updates:
* **Price Indicator / Builder Cost Level:** The system and UI structure will include a prepared placeholder for the "Price Indicator" (Low, Moderate, High, Premium / 1-5 rating / Cost index score). This will be calculated via project valuation per square foot, project type, and builder history from the final Builder Intelligence spreadsheet.
* **Advanced CSLB Filtering:** The data relationships established now will allow future enterprise users to search and filter not just by license number, but by complete CSLB trade categories, specialties, project types, valuation ranges, and geographic activity areas.