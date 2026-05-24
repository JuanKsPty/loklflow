export interface JwtPayload {
  sub: string;
  email: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  loginMethod: 'email' | 'pin';
  iat?: number;
  exp?: number;
}
