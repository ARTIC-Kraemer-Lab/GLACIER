// Frontend-backend data exchange contract
type Success<T> = {
  ok: true;
  data: T;
};

type Failure = {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
};

export type Result<T> = Success<T> | Failure;

// Workflow status enumeration
export enum WorkflowStatus {
  Created = 'created',
  Running = 'running',
  Completed = 'completed',
  Closed = 'closed',
  Failed = 'failed',
  Unknown = 'unknown'
}
