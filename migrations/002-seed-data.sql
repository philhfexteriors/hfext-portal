-- ============================================================
-- Seed Data: Departments, Apps, Roles, and Access Mappings
-- Run this after 001-portal-schema.sql
-- ============================================================

-- Departments
INSERT INTO departments (slug, display_name, icon, sort_order) VALUES
  ('marketing', 'Marketing', 'megaphone', 1),
  ('sales', 'Sales', 'currency-dollar', 2),
  ('production', 'Production', 'wrench-screwdriver', 3);

-- Apps
INSERT INTO apps (slug, department_id, display_name, description, icon, base_path, sort_order) VALUES
  ('sm', (SELECT id FROM departments WHERE slug = 'marketing'),
    'SM Dashboard', 'Social media management & lead tracking', 'chart-bar', '/marketing/sm', 1),
  ('frm', (SELECT id FROM departments WHERE slug = 'marketing'),
    'FRM Dashboard', 'Field rep visit management & route planning', 'map-pin', '/marketing/frm', 2),
  ('plans', (SELECT id FROM departments WHERE slug = 'sales'),
    'Production Plans', 'Create & manage production plans', 'document-text', '/sales/plans', 1),
  ('windows', (SELECT id FROM departments WHERE slug = 'production'),
    'Window Measuring', 'Capture window measurements & generate reports', 'calculator', '/production/windows', 1);

-- Roles
INSERT INTO roles (name, display_name, description) VALUES
  ('admin', 'Administrator', 'Full access to all apps and admin features'),
  ('field_rep', 'Field Representative', 'Manages field visits and route planning'),
  ('sm_manager', 'Social Media Manager', 'Manages social media content and leads'),
  ('salesperson', 'Salesperson', 'Creates and manages production plans'),
  ('sales_manager', 'Sales Manager', 'Manages sales team and production plans'),
  ('window_measurer', 'Window Measurer', 'Captures window measurements in the field');

-- Role → App Access Mappings

-- Admin gets everything
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, a.slug
FROM roles r
CROSS JOIN apps a
WHERE r.name = 'admin';

-- Field reps get FRM
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, 'frm'
FROM roles r WHERE r.name = 'field_rep';

-- SM managers get SM dashboard
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, 'sm'
FROM roles r WHERE r.name = 'sm_manager';

-- Salesperson gets production plans
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, 'plans'
FROM roles r WHERE r.name = 'salesperson';

-- Sales manager gets production plans
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, 'plans'
FROM roles r WHERE r.name = 'sales_manager';

-- Window measurer gets windows
INSERT INTO role_app_access (role_id, app_slug)
SELECT r.id, 'windows'
FROM roles r WHERE r.name = 'window_measurer';
