import { describe, expect, it } from 'vitest';
import { hasRequiredAdminRole } from '../adminAccess';

describe('hasRequiredAdminRole', () => {
  it('allows matching admin roles', () => {
    expect(hasRequiredAdminRole(['super_admin', 'finance_admin'], 'finance_admin')).toBe(true);
  });

  it('rejects roles outside the required set', () => {
    expect(hasRequiredAdminRole(['super_admin'], 'finance_admin')).toBe(false);
  });

  it('rejects missing roles', () => {
    expect(hasRequiredAdminRole(['super_admin'], null)).toBe(false);
  });
});
