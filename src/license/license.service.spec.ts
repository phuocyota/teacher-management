import { LicenseService } from './license.service';

describe('LicenseService', () => {
  it('returns entity name', () => {
    const service = new LicenseService({} as any);
    expect((service as any).getEntityName()).toBe('License');
  });
});
