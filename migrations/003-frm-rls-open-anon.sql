-- =============================================================================
-- Migration 003: Open FRM Supabase tables to anon role
-- =============================================================================
-- Purpose: The hfext-portal authenticates users via the Portal Supabase instance,
-- then queries FRM data Supabase with the anon key. Since auth is handled at the
-- portal layer (middleware + Portal Supabase), the FRM data Supabase just needs
-- to allow anon access to all tables.
--
-- This migration adds permissive "Portal anon access" policies alongside the
-- existing authenticated-user policies so the standalone FRM app continues to
-- work unchanged.
--
-- Tables affected (18 tables referenced in FRM code):
--   Core tables:
--     1.  frms
--     2.  agencies
--     3.  visits
--   Contact/merge tables:
--     4.  agency_contacts
--     5.  agency_merge_history
--     6.  contact_merge_history
--   Route optimization tables:
--     7.  route_zones
--     8.  zone_assignments
--     9.  frm_zone_assignments
--     10. optimization_history
--     11. zones
--     12. frm_zones
--   Tracking/stats tables:
--     13. daily_route_stats
--     14. drive_time_cache
--     15. frm_weekly_goals
--     16. frm_progress
--     17. visit_attachments
--
-- Note: "visit-photos" is a storage bucket, not a table — handled separately
--       via Supabase Storage policies if needed.
--
-- Run against: FRM Supabase (lbdjjxyogqqymlzkzxow)
-- =============================================================================

-- Helper: This DO block tries each policy creation and skips if the table
-- doesn't exist or the policy already exists, so it's safe to run repeatedly.

-- ===== CORE TABLES =====

-- 1. frms
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON frms FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 2. agencies
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON agencies FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 3. visits
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON visits FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- ===== CONTACT / MERGE TABLES =====

-- 4. agency_contacts
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON agency_contacts FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 5. agency_merge_history
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON agency_merge_history FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 6. contact_merge_history
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON contact_merge_history FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- ===== ROUTE OPTIMIZATION TABLES =====

-- 7. route_zones
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON route_zones FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 8. zone_assignments
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON zone_assignments FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 9. frm_zone_assignments
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON frm_zone_assignments FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 10. optimization_history
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON optimization_history FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 11. zones
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON zones FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 12. frm_zones
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON frm_zones FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- ===== TRACKING / STATS TABLES =====

-- 13. daily_route_stats
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON daily_route_stats FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 14. drive_time_cache
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON drive_time_cache FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 15. frm_weekly_goals
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON frm_weekly_goals FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 16. frm_progress
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON frm_progress FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- 17. visit_attachments
DO $$ BEGIN
  CREATE POLICY "Portal anon access" ON visit_attachments FOR ALL TO anon USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

-- ===== STORAGE BUCKET (visit-photos) =====
-- If visit-photos storage bucket has RLS policies restricting to authenticated,
-- add anon access to the storage.objects table for that bucket:

DO $$ BEGIN
  CREATE POLICY "Portal anon select visit-photos"
    ON storage.objects FOR SELECT TO anon
    USING (bucket_id = 'visit-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Portal anon insert visit-photos"
    ON storage.objects FOR INSERT TO anon
    WITH CHECK (bucket_id = 'visit-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Portal anon update visit-photos"
    ON storage.objects FOR UPDATE TO anon
    USING (bucket_id = 'visit-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Portal anon delete visit-photos"
    ON storage.objects FOR DELETE TO anon
    USING (bucket_id = 'visit-photos');
EXCEPTION WHEN duplicate_object THEN NULL;
         WHEN undefined_table THEN NULL;
END $$;
