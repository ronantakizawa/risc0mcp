import { McpError, ErrorCode, CallToolResult } from '@modelcontextprotocol/sdk/types.js';

export interface ZkVmResult {
  result?: any;
  image_id?: string;
  verification_status?: string;
  proof_file_path?: string;
  total_time_ms?: number;
  public_key?: string;
  signature?: string;
  task_id?: string;
  auth_timestamp?: number;
  timestamp?: number;
  error?: string;
  raw_output?: string;
  raw_stderr?: string;
}

export interface ComputationResult {
  operation: string;
  inputs: any;
  result: any;
  expected?: any;
  correct?: boolean;
  codeHash?: string;
  executionTimeMs?: number;
}

export interface ZkProofInfo {
  mode: string;
  imageId?: string;
  verificationStatus?: string;
  proofFilePath?: string | null;
}

export interface AuthenticationInfo {
  publicKey: string;
  signature: string;
  taskId: string;
  timestamp: string | number;
}

export type ToolResponse = CallToolResult;

export class ZkVmError extends McpError {
  constructor(operation: string, error: Error | string) {
    super(
      ErrorCode.InternalError,
      `Failed to perform zkVM ${operation}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}