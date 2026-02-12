-- ============================================================
-- HF Exteriors Portal — Auth, Roles, Departments Schema
-- Run this in the portal Supabase SQL Editor
-- ============================================================

-- Departments group apps into business units
CREATE TABLE departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  display_name text NOT NULL,
  icon text,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Apps belong to departments
CREATE TABLE apps (
  slug text PRIMARY KEY,
  department_id uuid REFERENCES departments(id) ON DELETE SET NULL,
  display_name text NOT NULL,
  description text,
  icon text,
  base_path text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Unified user profiles
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text UNIQUE NOT NULL,
  display_name text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Roles are rows, not enums — add new roles from admin UI
CREATE TABLE roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  display_name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Users can have multiple roles
CREATE TABLE user_roles (
  user_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  granted_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, role_id)
);

-- Which apps each role can access
CREATE TABLE role_app_access (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  app_slug text REFERENCES apps(slug) ON DELETE CASCADE,
  PRIMARY KEY (role_id, app_slug)
);

-- Fine-grained permissions within apps
CREATE TABLE permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  app_slug text REFERENCES apps(slug) ON DELETE CASCADE,
  permission_key text NOT NULL,
  display_name text NOT NULL,
  UNIQUE (app_slug, permission_key)
);

CREATE TABLE role_permissions (
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ============================================================
-- Indexes
-- ============================================================
CREATE INDEX idx_user_roles_user ON user_roles(user_id);
CREATE INDEX idx_user_roles_role ON user_roles(role_id);
CREATE INDEX idx_role_app_access_role ON role_app_access(role_id);
CREATE INDEX idx_role_app_access_app ON role_app_access(app_slug);
CREATE INDEX idx_apps_department ON apps(department_id);
CREATE INDEX idx_user_profiles_email ON user_profiles(email);

-- ============================================================
-- Row Level Security
-- ============================================================

-- user_profiles: users can read their own profile, admins can read/write all
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Allow service role to insert profiles (for auth callback)
CREATE POLICY "Service role can insert profiles"
  ON user_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- departments: readable by all authenticated users
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read departments"
  ON departments FOR SELECT
  USING (auth.role() = 'authenticated');

-- apps: readable by all authenticated users
ALTER TABLE apps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read apps"
  ON apps FOR SELECT
  USING (auth.role() = 'authenticated');

-- roles: readable by all authenticated users
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read roles"
  ON roles FOR SELECT
  USING (auth.role() = 'authenticated');

-- user_roles: users can read their own roles
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- role_app_access: readable by all authenticated users
ALTER TABLE role_app_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read role app access"
  ON role_app_access FOR SELECT
  USING (auth.role() = 'authenticated');

-- permissions: readable by all authenticated users
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read permissions"
  ON permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- role_permissions: readable by all authenticated users
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read role permissions"
  ON role_permissions FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- Helper function: check if user has access to an app
-- ============================================================
CREATE OR REPLACE FUNCTION user_has_app_access(user_uuid uuid, check_app_slug text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM user_roles ur
    JOIN role_app_access raa ON ur.role_id = raa.role_id
    WHERE ur.user_id = user_uuid
      AND raa.app_slug = check_app_slug
  );
$$;

-- ============================================================
-- Helper function: get all app slugs a user can access
-- ============================================================
CREATE OR REPLACE FUNCTION user_accessible_apps(user_uuid uuid)
RETURNS TABLE(app_slug text)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT DISTINCT raa.app_slug
  FROM user_roles ur
  JOIN role_app_access raa ON ur.role_id = raa.role_id
  WHERE ur.user_id = user_uuid;
$$;
