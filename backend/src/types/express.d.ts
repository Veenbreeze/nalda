import 'express';

export interface AuthenticatedAdmin {
  id: string;
  email: string;
  fullName: string;
  roleId: string;
  roleSlug: string;
  roleName: string;
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      admin?: AuthenticatedAdmin;
      requestId?: string;
      rawBody?: Buffer;
    }
  }
}

export {};
