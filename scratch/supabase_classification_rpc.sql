-- ============================================================
-- Run this entire file in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Prevent the script itself from timing out during index creation!
SET statement_timeout = '10min';

-- 1. Create a fast B-Tree index on the extracted base license!
-- This allows INSTANT exact-match joins with builder_intelligence
CREATE INDEX IF NOT EXISTS idx_ca_permits_base_license 
  ON ca_permits (SPLIT_PART(contractor_license, '-', 1));

CREATE INDEX IF NOT EXISTS idx_ca_permits_city_lower
  ON ca_permits (LOWER(city));

CREATE INDEX IF NOT EXISTS idx_ca_permits_county_lower
  ON ca_permits (LOWER(source_county));

-- ============================================================
-- 2. Main data function (Hash-Join Optimized)
-- ============================================================
CREATE OR REPLACE FUNCTION get_builders_by_class(
  p_license_class  TEXT,
  p_property_type  TEXT    DEFAULT 'all',
  p_sort_by        TEXT    DEFAULT 'count',
  p_result_limit   INTEGER DEFAULT 100,
  p_offset         INTEGER DEFAULT 0,
  p_keyword        TEXT    DEFAULT '',
  p_city           TEXT    DEFAULT '',
  p_county         TEXT    DEFAULT ''
)
RETURNS TABLE (
  contractor_license TEXT,
  contractor_name    TEXT,
  project_count      BIGINT,
  total_valuation    NUMERIC,
  sample_addresses   TEXT[]
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sql TEXT;
BEGIN
  v_sql := '
  SELECT
    bit.contractor_license::TEXT,
    MAX(cp.contractor) AS contractor_name,
    COUNT(*)::BIGINT AS project_count,
    SUM(COALESCE(cp.valuation, 0))::NUMERIC AS total_valuation,
    (ARRAY_AGG(DISTINCT cp.address) FILTER (WHERE cp.address IS NOT NULL))[1:5] AS sample_addresses
  FROM public.builder_intelligence bit
  JOIN public.ca_permits cp
    ON SPLIT_PART(cp.contractor_license, ''-'', 1) = bit.contractor_license
  WHERE 1=1
  ';

  IF p_license_class <> '' THEN
    v_sql := v_sql || ' AND bit.cslb_classification ILIKE ''%'' || $1 || ''%''';
  END IF;

  IF p_property_type = 'residential' THEN
    v_sql := v_sql || ' AND cp.is_residential = TRUE';
  ELSIF p_property_type = 'commercial' THEN
    v_sql := v_sql || ' AND cp.is_commercial = TRUE';
  END IF;

  IF p_keyword <> '' THEN
    v_sql := v_sql || ' AND cp.work_description ILIKE ''%'' || $6 || ''%''';
  END IF;

  IF p_city <> '' THEN
    IF p_license_class <> '' THEN
      -- Optimization: When license class is provided, we WANT Postgres to use the 
      -- idx_ca_permits_base_license index for the join, NOT the city index.
      -- By appending an empty string, we hide the column from the city index planner.
      v_sql := v_sql || ' AND LOWER(cp.city || '''') = LOWER($7)';
    ELSE
      v_sql := v_sql || ' AND LOWER(cp.city) = LOWER($7)';
    END IF;
  END IF;

  IF p_county <> '' THEN
    IF p_license_class <> '' THEN
      v_sql := v_sql || ' AND LOWER(cp.source_county || '''') = LOWER($8)';
    ELSE
      v_sql := v_sql || ' AND LOWER(cp.source_county) = LOWER($8)';
    END IF;
  END IF;

  v_sql := v_sql || '
  GROUP BY bit.contractor_license
  ORDER BY
    CASE WHEN $3 = ''valuation''
         THEN SUM(COALESCE(cp.valuation, 0))
         ELSE COUNT(*)
    END DESC
  LIMIT $4
  OFFSET $5;
  ';

  RETURN QUERY EXECUTE v_sql 
  USING p_license_class, p_property_type, p_sort_by, p_result_limit, p_offset, p_keyword, p_city, p_county;
END;
$$;

-- ============================================================
-- 3. Count function (Hash-Join Optimized)
-- ============================================================
CREATE OR REPLACE FUNCTION get_builders_by_class_count(
  p_license_class  TEXT,
  p_property_type  TEXT DEFAULT 'all',
  p_keyword        TEXT DEFAULT '',
  p_city           TEXT DEFAULT '',
  p_county         TEXT DEFAULT ''
)
RETURNS BIGINT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_sql TEXT;
  v_count BIGINT;
BEGIN
  v_sql := '
  SELECT COUNT(DISTINCT bit.contractor_license)
  FROM public.builder_intelligence bit
  JOIN public.ca_permits cp
    ON SPLIT_PART(cp.contractor_license, ''-'', 1) = bit.contractor_license
  WHERE 1=1
  ';

  IF p_license_class <> '' THEN
    v_sql := v_sql || ' AND bit.cslb_classification ILIKE ''%'' || $1 || ''%''';
  END IF;

  IF p_property_type = 'residential' THEN
    v_sql := v_sql || ' AND cp.is_residential = TRUE';
  ELSIF p_property_type = 'commercial' THEN
    v_sql := v_sql || ' AND cp.is_commercial = TRUE';
  END IF;

  IF p_keyword <> '' THEN
    v_sql := v_sql || ' AND cp.work_description ILIKE ''%'' || $3 || ''%''';
  END IF;

  IF p_city <> '' THEN
    IF p_license_class <> '' THEN
      v_sql := v_sql || ' AND LOWER(cp.city || '''') = LOWER($4)';
    ELSE
      v_sql := v_sql || ' AND LOWER(cp.city) = LOWER($4)';
    END IF;
  END IF;

  IF p_county <> '' THEN
    IF p_license_class <> '' THEN
      v_sql := v_sql || ' AND LOWER(cp.source_county || '''') = LOWER($5)';
    ELSE
      v_sql := v_sql || ' AND LOWER(cp.source_county) = LOWER($5)';
    END IF;
  END IF;

  EXECUTE v_sql INTO v_count
  USING p_license_class, p_property_type, p_keyword, p_city, p_county;

  RETURN v_count;
END;
$$;

-- ============================================================
-- 4. CRITICAL: Increase timeout just for these complex searches!
-- ============================================================
ALTER FUNCTION get_builders_by_class(TEXT, TEXT, TEXT, INTEGER, INTEGER, TEXT, TEXT, TEXT) SET statement_timeout = '30s';
ALTER FUNCTION get_builders_by_class_count(TEXT, TEXT, TEXT, TEXT, TEXT) SET statement_timeout = '30s';
