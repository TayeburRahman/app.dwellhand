-- ============================================================
-- Run this entire file in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- 1. Trigram index so ILIKE '%C10%' is fast on the big ca_permits table
--    (Only needed once — skip if it already exists)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_ca_permits_contractor_license_trgm
  ON ca_permits USING gin (contractor_license gin_trgm_ops);

-- ============================================================
-- 2. Main data function
--    contractor_license in ca_permits can be:
--      "1004379-C10"              (simple)
--      "1009682-B | 1009682-C10" (pipe-joined multi-license)
--    We split on '|', find the segment ending in '-<CLASS>',
--    extract the base number, then group and aggregate.
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
BEGIN
  RETURN QUERY
  WITH raw_permits AS (
    SELECT
      cp.contractor_license AS raw_license,
      cp.contractor,
      cp.address,
      COALESCE(cp.valuation, 0) AS valuation
    FROM public.builder_intelligence bit
    JOIN public.ca_permits cp
      ON cp.contractor_license LIKE bit.contractor_license || '%'
    WHERE bit.cslb_classification ILIKE '%' || p_license_class || '%'
      AND (p_property_type = 'all'
           OR (p_property_type = 'residential' AND cp.is_residential = TRUE)
           OR (p_property_type = 'commercial'  AND cp.is_commercial  = TRUE))
      AND (p_keyword = '' OR cp.work_description ILIKE '%' || p_keyword || '%')
      AND (p_city    = '' OR cp.city             ILIKE '%' || p_city    || '%')
      AND (p_county  = '' OR cp.source_county    ILIKE '%' || p_county  || '%')
  ),
  split_permits AS (
    -- unnest pipe-joined license fields, keep only the segment ending with our class
    SELECT
      TRIM(SPLIT_PART(TRIM(part), '-', 1)) AS base_license,
      rp.contractor,
      rp.address,
      rp.valuation
    FROM raw_permits rp,
    LATERAL UNNEST(STRING_TO_ARRAY(rp.raw_license, '|')) AS part
    WHERE UPPER(TRIM(part)) LIKE '%-' || UPPER(p_license_class)
  ),
  grouped AS (
    SELECT
      sp.base_license,
      MAX(sp.contractor)    AS contractor_name,
      COUNT(*)::BIGINT      AS project_count,
      SUM(sp.valuation)     AS total_valuation
    FROM split_permits sp
    WHERE sp.base_license IS NOT NULL AND sp.base_license <> ''
    GROUP BY sp.base_license
  ),
  with_addresses AS (
    SELECT
      g.base_license,
      g.contractor_name,
      g.project_count,
      g.total_valuation,
      ARRAY(
        SELECT DISTINCT sp2.address
        FROM   split_permits sp2
        WHERE  sp2.base_license = g.base_license
          AND  sp2.address IS NOT NULL
        LIMIT  5
      ) AS sample_addresses
    FROM grouped g
  )
  SELECT
    wa.base_license      AS contractor_license,
    wa.contractor_name,
    wa.project_count,
    wa.total_valuation,
    wa.sample_addresses
  FROM with_addresses wa
  ORDER BY
    CASE WHEN p_sort_by = 'valuation'
         THEN wa.total_valuation
         ELSE wa.project_count::NUMERIC
    END DESC
  LIMIT  p_result_limit
  OFFSET p_offset;
END;
$$;

-- ============================================================
-- 3. Count function (total distinct builders, for pagination)
-- ============================================================
CREATE OR REPLACE FUNCTION get_builders_by_class_count(
  p_license_class  TEXT,
  p_property_type  TEXT DEFAULT 'all',
  p_keyword        TEXT DEFAULT '',
  p_city           TEXT DEFAULT '',
  p_county         TEXT DEFAULT ''
)
RETURNS BIGINT
LANGUAGE sql
STABLE
AS $$
  SELECT COUNT(DISTINCT TRIM(SPLIT_PART(TRIM(part), '-', 1)))
  FROM   public.builder_intelligence bit
  JOIN   public.ca_permits cp
    ON   cp.contractor_license LIKE bit.contractor_license || '%',
  LATERAL UNNEST(STRING_TO_ARRAY(cp.contractor_license, '|')) AS part
  WHERE  bit.cslb_classification ILIKE '%' || p_license_class || '%'
    AND  UPPER(TRIM(part)) LIKE '%-' || UPPER(p_license_class)
    AND  (p_property_type = 'all'
          OR (p_property_type = 'residential' AND cp.is_residential = TRUE)
          OR (p_property_type = 'commercial'  AND cp.is_commercial  = TRUE))
    AND  (p_keyword = '' OR cp.work_description ILIKE '%' || p_keyword || '%')
    AND  (p_city    = '' OR cp.city             ILIKE '%' || p_city    || '%')
    AND  (p_county  = '' OR cp.source_county    ILIKE '%' || p_county  || '%');
$$;
