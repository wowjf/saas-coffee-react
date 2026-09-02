declare global {
  namespace Express {
    interface Request {
      authUser?: any;
      authRole?: "customer" | "staff" | "manager";
    }
  }
}

export {};
