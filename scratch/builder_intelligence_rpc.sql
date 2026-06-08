-- ============================================================
-- Builder Intelligence RPC Functions
-- Run this entire file in: Supabase Dashboard → SQL Editor
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- Function 1: Permit-based data (New Build, Alteration, ADU)
-- Supports server-side pagination via p_offset.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_builder_intelligence(
  p_category       TEXT,
  p_property_type  TEXT  DEFAULT 'all',
  p_sub_filter     TEXT  DEFAULT '',
  p_sort_by        TEXT  DEFAULT 'count',
  p_result_limit   INT   DEFAULT 100,
  p_offset         INT   DEFAULT 0
)
RETURNS TABLE (
  contractor_license  TEXT,
  contractor_name     TEXT,
  project_count       BIGINT,
  total_valuation     BIGINT,
  sample_addresses    TEXT[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    p.contractor_license::TEXT,
    MAX(p.contractor)                                                          AS contractor_name,
    COUNT(*)::BIGINT                                                           AS project_count,
    SUM(COALESCE(p.valuation, 0))::BIGINT                                     AS total_valuation,
    (ARRAY_AGG(DISTINCT p.address) FILTER (WHERE p.address IS NOT NULL))[1:5] AS sample_addresses
  FROM public.ca_permits p
  WHERE
    p.contractor_license IS NOT NULL
    AND (p_property_type != 'residential' OR p.is_residential = true)
    AND (p_property_type != 'commercial'  OR p.is_commercial  = true)
    AND (p_sub_filter    != 'basement'    OR p.is_basement    = true)
    AND (p_sub_filter    != 'hillside'    OR p.is_hillside    = true)
    AND (
         (p_category = 'new_build'  AND (lower(p.permit_type) LIKE '%new%'   OR lower(p.project_category) LIKE '%new%'))
      OR (p_category = 'alteration' AND (lower(p.permit_type) LIKE '%alter%' OR lower(p.permit_type) LIKE '%addition%' OR lower(p.permit_type) LIKE '%repair%'))
      OR (p_category = 'adu'        AND (lower(p.permit_type) LIKE '%adu%'   OR lower(p.project_category) LIKE '%adu%'))
    )
  GROUP BY p.contractor_license
  ORDER BY
    CASE WHEN p_sort_by = 'valuation'
         THEN SUM(COALESCE(p.valuation, 0))
         ELSE COUNT(*)
    END DESC NULLS LAST
  LIMIT  p_result_limit
  OFFSET p_offset;
$$;


-- ──────────────────────────────────────────────────────────────
-- Function 2: Total count for permit-based categories
-- Returns the exact number of unique contractors matching the filter.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_builder_intelligence_count(
  p_category       TEXT,
  p_property_type  TEXT  DEFAULT 'all',
  p_sub_filter     TEXT  DEFAULT ''
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(DISTINCT p.contractor_license)
  FROM public.ca_permits p
  WHERE
    p.contractor_license IS NOT NULL
    AND (p_property_type != 'residential' OR p.is_residential = true)
    AND (p_property_type != 'commercial'  OR p.is_commercial  = true)
    AND (p_sub_filter    != 'basement'    OR p.is_basement    = true)
    AND (p_sub_filter    != 'hillside'    OR p.is_hillside    = true)
    AND (
         (p_category = 'new_build'  AND (lower(p.permit_type) LIKE '%new%'   OR lower(p.project_category) LIKE '%new%'))
      OR (p_category = 'alteration' AND (lower(p.permit_type) LIKE '%alter%' OR lower(p.permit_type) LIKE '%addition%' OR lower(p.permit_type) LIKE '%repair%'))
      OR (p_category = 'adu'        AND (lower(p.permit_type) LIKE '%adu%'   OR lower(p.project_category) LIKE '%adu%'))
    );
$$;


-- ──────────────────────────────────────────────────────────────
-- Function 3: Classification-based data (MEPs, Trades)
-- Supports server-side pagination via p_offset.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_builders_by_classification(
  p_license_class  TEXT,
  p_property_type  TEXT  DEFAULT 'all',
  p_sort_by        TEXT  DEFAULT 'count',
  p_result_limit   INT   DEFAULT 100,
  p_offset         INT   DEFAULT 0
)
RETURNS TABLE (
  contractor_license  TEXT,
  business_name       TEXT,
  license_class       TEXT,
  license_status      TEXT,
  project_count       BIGINT,
  total_valuation     BIGINT,
  sample_addresses    TEXT[]
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT
    bit.contractor_license::TEXT,
    bit.cslb_company_name                                                      AS business_name,
    bit.cslb_classification                                                    AS license_class,
    bit.cslb_license_status                                                    AS license_status,
    COUNT(p.permit_number)::BIGINT                                             AS project_count,
    SUM(COALESCE(p.valuation, 0))::BIGINT                                     AS total_valuation,
    (ARRAY_AGG(DISTINCT p.address) FILTER (WHERE p.address IS NOT NULL))[1:5] AS sample_addresses
  FROM public.builder_intelligence_test bit
  LEFT JOIN public.ca_permits p
    ON  p.contractor_license::TEXT = bit.contractor_license::TEXT
    AND (p_property_type != 'residential' OR p.is_residential = true)
    AND (p_property_type != 'commercial'  OR p.is_commercial  = true)
  WHERE
    bit.contractor_license IS NOT NULL
    AND (p_license_class = '' OR bit.cslb_classification ILIKE '%' || p_license_class || '%')
  GROUP BY
    bit.contractor_license,
    bit.cslb_company_name,
    bit.cslb_classification,
    bit.cslb_license_status
  ORDER BY
    CASE WHEN p_sort_by = 'valuation'
         THEN SUM(COALESCE(p.valuation, 0))
         ELSE COUNT(p.permit_number)
    END DESC NULLS LAST
  LIMIT  p_result_limit
  OFFSET p_offset;
$$;


-- ──────────────────────────────────────────────────────────────
-- Function 4: Total count for classification-based categories
-- Fast — reads only the small builder_intelligence_test table.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_builders_by_classification_count(
  p_license_class TEXT
)
RETURNS BIGINT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COUNT(*)
  FROM public.builder_intelligence_test
  WHERE
    contractor_license IS NOT NULL
    AND (p_license_class = '' OR cslb_classification ILIKE '%' || p_license_class || '%');
$$;


-- ──────────────────────────────────────────────────────────────
-- Optional: trigram index to speed up LIKE '%new%' etc.
-- Only create if pg_trgm extension is enabled.
-- ──────────────────────────────────────────────────────────────
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ca_permits_permit_type_trgm
--   ON public.ca_permits USING gin (permit_type gin_trgm_ops);
-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ca_permits_project_category_trgm
--   ON public.ca_permits USING gin (project_category gin_trgm_ops);
