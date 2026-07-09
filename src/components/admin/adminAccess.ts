import type { AdminRole } from '../../store/adminStore';

const VALID_ADMIN_ROLES = new Set<AdminRole>(['super_admin', 'finance_admin', 'support_agent', 'game_manager']);

export function normalizeAdminRole(role: string | null | undefined): AdminRole | null {
  if (!role) return null;
  const normalized = role.toString().trim().toLowerCase();
  return VALID_ADMIN_ROLES.has(normalized as AdminRole) ? (normalized as AdminRole) : null;
}

export function hasRequiredAdminRole(requiredRoles: AdminRole[], actualRole: AdminRole | null | undefined): boolean {
  const normalizedRole = normalizeAdminRole(actualRole ?? null);
  if (!normalizedRole) return false;
  return requiredRoles.includes(normalizedRole);
}
