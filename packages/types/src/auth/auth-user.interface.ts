export interface AuthUser {
  id: string;
  name: string;
  email: string | null;
  roleId: string;
  roleName: string;
  permissions: string[];
  isActive: boolean;
  loginMethod: 'email' | 'pin';
}
