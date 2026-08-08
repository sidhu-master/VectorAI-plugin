export interface ValidationIssue {
  code: string;
  severity: 'error' | 'warning' | 'candidate' | 'info';
  path: string;
  message: string;
  nodeIds: string[];
}

export interface ValidationReport {
  valid: boolean;
  issues: ValidationIssue[];
}
