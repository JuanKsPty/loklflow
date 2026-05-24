export interface Permission {
  id: string;
  module: string;
  action: string;
  key: string;
}

export interface Role {
  id: string;
  name: string;
  description: string | null;
  maxDiscountPercentage: number;
  isSystem: boolean;
  isActive: boolean;
}

export interface RoleWithPermissions extends Role {
  permissions: Permission[];
}
