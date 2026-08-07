# DwellHand Permit Intelligence SaaS (Client: melody121_284)

DwellHand is a premium, enterprise-grade Permit Intelligence platform designed for real estate developers, contractors, and municipal analysts. It provides real-time geospatial visualization and market analytics for municipal permits across California.

![Dashboard Preview](https://github.com/TayeburRahman/app.dwellhand/raw/main/public/preview-dashboard.png)

## 🚀 Key Features

### 1. Geospatial Intelligence Map
*   **Real-time Visualization**: Interactive Mapbox GL JS integration showing permit density.
*   **Advanced Filtering**: Filter by jurisdiction (LA, Beverly Hills, Malibu, Santa Monica), permit type (Commercial, Residential, Basement, Hillside), and professional modes (Builder, Architect, Engineer, Trade).
*   **Analytical List View**: Side panel for granular permit exploration with real-time sorting by Asset Value, Market Velocity, and Builder Alpha.

### 2. Market Intelligence Dashboard
*   **Executive Overview**: High-level metrics for Total Market Inventory, Residential Developments, and Commercial Assets.
*   **Activity Stream**: Live feed of recent municipal permit transactions.
*   **Tiered Access**: Built-in support for Professional and Enterprise access levels.

### 3. Professional Builder Profiles (Phase 3 Ready)
*   **Builder Alpha**: Proprietary ranking of most active contractors in a specific viewport.
*   **Intelligence Exports**: Structured data ready for institutional growth analysis.

## 🎨 Design System

The platform utilizes a custom **Indigo & Emerald** design language:
*   **Colors**: Primary Indigo (`#4f46e5`), Success Emerald (`#10b981`), and Deep Violet accents.
*   **Aesthetics**: Glassmorphism, mesh gradients, and high-fidelity typography (Inter).
*   **Responsive**: Fully optimized for Desktop (50/50 split), Tablet, and Mobile (100% stack).

## 🛠️ Technology Stack

*   **Frontend**: Next.js 14 (App Router), React, Tailwind CSS.
*   **Database**: Supabase (PostgreSQL) with PostGIS for spatial queries.
*   **Mapping**: Mapbox GL JS with custom tactical dark/light styles.
*   **State Management**: React Hooks (useCallback, useMemo) for high-performance map interactions.

## 📦 Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/TayeburRahman/app.dwellhand.git
   cd app.dwellhand
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Environment Variables**:
   Create a `.env.local` file with the following:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

## 📊 Data Schema: `ca_permits`

The platform integrates directly with the `ca_permits` table:
*   `valuation`: Monetary value of the project.
*   `is_commercial` / `is_residential`: Type categorization.
*   `contractor`: Builder identity for Alpha ranking.
*   `issue_date`: Velocity and temporal analysis.

## ⚖️ Subscription Tiers

*   **Professional**: Full historical records, advanced filtering, and builder intelligence.
*   **Enterprise**: API hooks, bulk exports, and full-spectrum market data.

---
Developed by **DwellHand Engineering**

Dynamic Category Colors:
🔵 Builder: Blue (#3b82f6)
🟠 Trade: Amber (#f59e0b)
🟣 Architect: Purple (#8b5cf6)
