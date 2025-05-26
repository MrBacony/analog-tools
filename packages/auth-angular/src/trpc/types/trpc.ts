
// Type definition for TRPC error data
export type TRPCErrorData  ={
  code: string;
  httpStatus?: number;
  path?: string;
  errorCode?: string;
  [key: string]: unknown;
}

// Type for procedure method functions
export type ProcedureMethod = (...args: unknown[]) => unknown;
