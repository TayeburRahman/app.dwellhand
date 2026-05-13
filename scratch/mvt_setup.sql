-- 1. Enable PostGIS
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. (Recommended) Add geometry column and spatial index for performance
-- This allows ST_Intersects to use an index instead of scanning all 100k+ rows
ALTER TABLE ca_permits ADD COLUMN IF NOT EXISTS geom geometry(Point, 4326);

-- Populate geom column if empty
UPDATE ca_permits 
SET geom = ST_SetSRID(ST_MakePoint(longitude, latitude), 4326) 
WHERE longitude IS NOT NULL AND latitude IS NOT NULL AND geom IS NULL;

-- Create GIST index
CREATE INDEX IF NOT EXISTS ca_permits_geom_idx ON ca_permits USING GIST (geom);

-- 3. Create the MVT generation function
CREATE OR REPLACE FUNCTION get_mvt_tiles(
  z int, x int, y int,
  filter_commercial boolean DEFAULT NULL,
  filter_residential boolean DEFAULT NULL,
  filter_basement boolean DEFAULT NULL,
  filter_hillside boolean DEFAULT NULL,
  filter_owner_builder boolean DEFAULT NULL,
  filter_city text DEFAULT NULL
)
RETURNS bytea AS $$
DECLARE
  mvt bytea;
BEGIN
  SELECT ST_AsMVT(tile, 'permits', 4096, 'geom') INTO mvt
  FROM (
    SELECT
      permit_number as id,
      permit_number,
      address,
      city,
      state,
      zip_code,
      issue_date,
      contractor,
      contractor_license,
      square_feet,
      work_description,
      permit_type,
      CASE WHEN valuation >= 10000 THEN valuation ELSE NULL END as valuation,
      project_type,
      architect,
      architect_license,
      permit_expediter,
      apn,
      geologist,
      geologist_license,
      project_category,
      engineer,
      engineer_license,
      permit_link,
      is_owner_builder,
      is_commercial,
      is_residential,
      is_hillside,
      is_basement,
      ST_AsMVTGeom(
        ST_Transform(geom, 3857),
        ST_TileEnvelope(z, x, y),
        4096, 64, true
      ) AS geom
    FROM ca_permits
    WHERE geom IS NOT NULL
      AND geom && ST_Transform(ST_TileEnvelope(z, x, y), 4326)
      AND (filter_commercial IS NULL OR is_commercial = filter_commercial)
      AND (filter_residential IS NULL OR is_residential = filter_residential)
      AND (filter_basement IS NULL OR is_basement = filter_basement)
      AND (filter_hillside IS NULL OR is_hillside = filter_hillside)
      AND (filter_owner_builder IS NULL OR is_owner_builder = filter_owner_builder)
      AND (filter_city IS NULL OR city = filter_city)
  ) AS tile;
  
  RETURN mvt;
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Grant access to the anon role (public access for the map)
GRANT EXECUTE ON FUNCTION get_mvt_tiles(int, int, int, boolean, boolean, boolean, boolean, boolean, text) TO anon, authenticated, service_role;
