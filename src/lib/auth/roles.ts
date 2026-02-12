export interface UserRole {
  id: string
  name: string
  display_name: string
}

export interface AppAccess {
  app_slug: string
  display_name: string
  description: string | null
  icon: string | null
  base_path: string
  department_slug: string
  department_name: string
  department_icon: string | null
  department_sort: number
  app_sort: number
}

export interface UserSession {
  roles: UserRole[]
  apps: AppAccess[]
}

/** Check if user has a specific role by name */
export function hasRole(session: UserSession | null, roleName: string): boolean {
  if (!session) return false
  return session.roles.some((r) => r.name === roleName)
}

/** Check if user is admin */
export function isAdmin(session: UserSession | null): boolean {
  return hasRole(session, 'admin')
}

/** Check if user has access to a specific app */
export function hasAppAccess(session: UserSession | null, appSlug: string): boolean {
  if (!session) return false
  if (isAdmin(session)) return true
  return session.apps.some((a) => a.app_slug === appSlug)
}

/** Group apps by department for the landing page */
export function groupAppsByDepartment(apps: AppAccess[]) {
  const departments = new Map<
    string,
    { slug: string; name: string; icon: string | null; sort: number; apps: AppAccess[] }
  >()

  for (const app of apps) {
    if (!departments.has(app.department_slug)) {
      departments.set(app.department_slug, {
        slug: app.department_slug,
        name: app.department_name,
        icon: app.department_icon,
        sort: app.department_sort,
        apps: [],
      })
    }
    departments.get(app.department_slug)!.apps.push(app)
  }

  // Sort departments by sort_order, then apps within each department
  return Array.from(departments.values())
    .sort((a, b) => a.sort - b.sort)
    .map((dept) => ({
      ...dept,
      apps: dept.apps.sort((a, b) => a.app_sort - b.app_sort),
    }))
}
