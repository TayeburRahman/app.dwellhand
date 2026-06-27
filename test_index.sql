-- Tell the user to run this:
SET statement_timeout = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ca_permits_issue_lat_lng 
ON public.ca_permits (issue_date DESC, latitude, longitude);
