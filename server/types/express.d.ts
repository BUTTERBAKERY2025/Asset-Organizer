import { Request } from "express";
import { User } from "../../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
      currentUser?: User;
    }
  }
}

export interface AuthenticatedRequest extends Request {
  user: User;
  currentUser: User;
}

export {};
