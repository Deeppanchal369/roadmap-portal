import type { UserRole } from '../models/User.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` middleware. Absent on public routes. */
      user?: { id: string; role: UserRole };
    }
  }
}

export {};
