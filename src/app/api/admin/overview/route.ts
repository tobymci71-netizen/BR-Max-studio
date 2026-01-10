import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import type { AdminOverviewResponse, GenericSupabaseRow } from "@/types/admin";
import { validateAdminAuth } from "@/lib/adminAuth";

export const runtime = "nodejs";

async function fetchTable(table: string) {
  return supabaseAdmin.from(table).select("*").order("created_at", { ascending: false });
}

function unwrapResult(result: Awaited<ReturnType<typeof fetchTable>>, table: string): GenericSupabaseRow[] {
  if (result.error) {
    console.error(`[admin overview] ${table} query error:`, result.error);
    throw new Error(`Unable to fetch ${table}`);
  }
  return result.data ?? [];
}

export async function POST(req: NextRequest) {
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const auth = validateAdminAuth(payload);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const [
      jobsResult,
      usersResult,
      tokensResult,
      errorsResult,
    ] = await Promise.all([
      fetchTable("render_jobs"),
      fetchTable("users"),
      fetchTable("token_transactions"),
      fetchTable("render_errors"),
    ]);

    const results = {
      jobs: unwrapResult(jobsResult, "render_jobs"),
      users: unwrapResult(usersResult, "users"),
      tokenTransactions: unwrapResult(tokensResult, "token_transactions"),
      errors: unwrapResult(errorsResult, "render_errors"),
    };

    const jobStatusCounts = results.jobs.reduce<Record<string, number>>((acc, job) => {
      const status = typeof job.status === "string" ? job.status : "unknown";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const averageDuration =
      results.jobs.reduce((acc, job) => {
        const duration = typeof job.duration_sec === "number" ? job.duration_sec : 0;
        return acc + duration;
      }, 0) / (results.jobs.length || 1);

    const failureRate =
      results.jobs.length === 0
        ? 0
        : ((jobStatusCounts.failed ?? 0) + (jobStatusCounts.cancelled ?? 0)) /
          results.jobs.length;

    const userStatusCounts = results.users.reduce<{ active: number; deleted: number; unknown: number }>(
      (acc, user) => {
        const status = typeof user.status === "string" ? user.status : "unknown";
        if (status === "active") acc.active += 1;
        else if (status === "deleted") acc.deleted += 1;
        else acc.unknown += 1;
        return acc;
      },
      { active: 0, deleted: 0, unknown: 0 }
    );


    const netTokens = results.tokenTransactions.reduce<number>((acc, tx) => {
      const amount =
        typeof tx.amount === "number"
          ? tx.amount
          : typeof tx.amount === "string"
            ? Number(tx.amount)
            : 0;
      return acc + (Number.isFinite(amount) ? amount : 0);
    }, 0);

    const payload: AdminOverviewResponse = {
      ok: true,
      generatedAt: new Date().toISOString(),
      metrics: {
        jobs: {
          total: results.jobs.length,
          byStatus: jobStatusCounts,
          averageDurationSec: Math.round(averageDuration),
          failureRate,
        },
        users: {
          total: results.users.length,
          active: userStatusCounts.active,
          deleted: userStatusCounts.deleted,
        },
        tokens: {
          totalTransactions: results.tokenTransactions.length,
          netAmount: Number(netTokens.toFixed(2)),
        }
      },
      ...results,
    };

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[admin overview] Failed to gather data", error);
    return NextResponse.json({ error: "Failed to gather admin metrics" }, { status: 500 });
  }
}
