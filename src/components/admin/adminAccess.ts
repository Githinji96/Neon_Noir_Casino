import type { AdminRole } from '../../store/adminStore';

export function hasRequiredAdminRole(requiredRoles: AdminRole[], actualRole: AdminRole | null | undefined): boolean {
  if (!actualRole) return false;
  return requiredRoles.includes(actualRole);
}
