import { TeacherService } from './teacher.service';

describe('TeacherService', () => {
  it('returns entity name', () => {
    const service = new TeacherService({} as any);
    expect((service as any).getEntityName()).toBe('Teacher');
  });
});
