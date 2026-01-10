export type GenericSupabaseRow = Record<string, unknown>;

export interface AdminOverviewMetrics {
  jobs: {
    total: number;
    byStatus: Record<string, number>;
    averageDurationSec: number;
    failureRate: number;
  };
  users: {
    total: number;
    active: number;
    deleted: number;
  };
  tokens: {
    totalTransactions: number;
    netAmount: number;
  };
}

export interface AdminOverviewResponse {
  ok: true;
  generatedAt: string;
  metrics: AdminOverviewMetrics;
  jobs: GenericSupabaseRow[];
  users: GenericSupabaseRow[];
  tokenTransactions: GenericSupabaseRow[];
  errors: GenericSupabaseRow[];
}
