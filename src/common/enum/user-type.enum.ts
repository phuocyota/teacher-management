export enum UserType {
  ADMIN = 'ADMIN',
  ADMIN_LONG_AN = 'ADMIN_LONG_AN',
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  KINH_DOANH = 'KINH_DOANH',
}

export function isAdminUserType(userType: UserType): boolean {
  return userType === UserType.ADMIN || userType === UserType.ADMIN_LONG_AN;
}
