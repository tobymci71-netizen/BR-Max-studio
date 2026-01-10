"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Database,
  Loader2,
  MoreHorizontal,
  RefreshCcw,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import type { AdminOverviewResponse, GenericSupabaseRow } from "@/types/admin";
import JobJsonModal from "./JobJsonModal";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";

interface AdminDashboardProps {
  sessionNonce: string;
}

interface TableColumn {
  key: string;
  label: string;
  render?: (row: GenericSupabaseRow) => React.ReactNode;
  className?: string;
}

interface TableFilterOption {
  value: string;
  label: string;
}

interface TableFilter {
  key: string;
  label: string;
  options: TableFilterOption[];
  predicate?: (row: GenericSupabaseRow, value: string) => boolean;
}

const numberFormatter = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 2,
});

const durationFormatter = (seconds: unknown) => {
  const value = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return "-";
  const mins = Math.floor(value / 60);
  const secs = Math.round(value % 60);
  if (mins === 0) return `${secs}s`;
  if (secs === 0) return `${mins}m`;
  return `${mins}m ${secs}s`;
};

const formatDurationWithColor = (seconds: unknown) => {
  const value = typeof seconds === "number" ? seconds : Number(seconds);
  if (!Number.isFinite(value) || value <= 0) return <span className="text-white/50">-</span>;
  
  const mins = value / 60;
  const formatted = durationFormatter(value);
  
  let colorClass = "text-emerald-400"; // green for < 4 minutes
  if (mins >= 8) {
    colorClass = "text-rose-400"; // red for >= 8 minutes
  } else if (mins >= 4) {
    colorClass = "text-amber-400"; // yellow for 4-8 minutes
  }
  
  return <span className={colorClass}>{formatted}</span>;
};

const formatDate = (value: unknown) => {
  if (typeof value !== "string") return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const timeStr = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return `${dateStr} ${timeStr}`;
};

const safeValue = (value: unknown) => {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return value.toString();
  if (typeof value === "boolean") return value ? "true" : "false";
  if (value instanceof Date) return value.toISOString();
  return JSON.stringify(value);
};

const StatusBadge = ({ status }: { status?: string }) => {
  if (!status) return <span className="text-muted-foreground">-</span>;
  const palette: Record<string, string> = {
    done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    processing: "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
    queued: "bg-amber-500/15 text-amber-300 border-amber-500/30",
    failed: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    cancelled: "bg-orange-500/15 text-orange-300 border-orange-500/30",
    active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
    deleted: "bg-rose-500/15 text-rose-300 border-rose-500/30",
    cancelled_subscription: "bg-orange-500/15 text-orange-200 border-orange-500/30",
  };
  const normalized = status.toLowerCase();
  const color = palette[normalized] ?? "bg-slate-500/15 text-slate-200 border-slate-500/30";
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full border capitalize ${color}`}>
      {status}
    </span>
  );
};

const MAX_FILTER_OPTIONS = 100;

function createUniqueOptions(rows: GenericSupabaseRow[], key: string): TableFilterOption[] {
  const seen = new Set<string>();
  const options: TableFilterOption[] = [];

  for (const row of rows) {
    const raw = row[key as keyof GenericSupabaseRow];
    if (raw == null) continue;
    const value = safeValue(raw).trim();
    if (!value || seen.has(value)) continue;
    seen.add(value);
    options.push({ value, label: value });
    if (options.length >= MAX_FILTER_OPTIONS) break;
  }

  return options;
}

function createStatusOptions(counts?: Record<string, number>): TableFilterOption[] {
  if (!counts) return [];
  return Object.entries(counts).map(([status, count]) => ({
    value: status,
    label: `${status} (${count})`,
  }));
}

const TableSection = ({
  title,
  icon,
  description,
  rows,
  columns,
  emptyLabel,
  searchableKeys,
  filters,
}: {
  title: string;
  icon: React.ReactNode;
  description: string;
  rows: GenericSupabaseRow[];
  columns: TableColumn[];
  emptyLabel: string;
  searchableKeys?: string[];
  filters?: TableFilter[];
}) => {
  const normalizedFilters = filters ?? [];
  const initialFilterValues = useMemo(() => {
    const defaults: Record<string, string> = {};
    normalizedFilters.forEach((filter) => {
      defaults[filter.key] = "all";
    });
    return defaults;
  }, [normalizedFilters]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterValues, setFilterValues] = useState<Record<string, string>>(initialFilterValues);

  useEffect(() => {
    setFilterValues(initialFilterValues);
  }, [initialFilterValues]);

  const filteredRows = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    let currentRows = rows;

    if (normalizedSearch) {
      currentRows = currentRows.filter((row) => {
        const keysToSearch =
          searchableKeys && searchableKeys.length > 0 ? searchableKeys : Object.keys(row);

        return keysToSearch.some((key) => {
          const value = row[key as keyof GenericSupabaseRow];
          if (value == null) return false;
          return safeValue(value).toLowerCase().includes(normalizedSearch);
        });
      });
    }

    normalizedFilters.forEach((filter) => {
      const selected = filterValues[filter.key];
      if (!selected || selected === "all") return;

      currentRows = currentRows.filter((row) => {
        if (filter.predicate) {
          return filter.predicate(row, selected);
        }
        const cell = row[filter.key as keyof GenericSupabaseRow];
        if (cell == null) return false;
        return safeValue(cell).toLowerCase() === selected.toLowerCase();
      });
    });

    return currentRows;
  }, [rows, searchTerm, searchableKeys, normalizedFilters, filterValues]);

  return (
    <section className="rounded-2xl border border-white/10 bg-black/40 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-4 border-b border-white/5 px-6 py-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold text-white">
              <span className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70">
                {icon}
              </span>
              {title}
            </div>
            <p className="text-sm text-white/60">{description}</p>
          </div>
          <div className="text-sm text-white/60">
            Showing {filteredRows.length} of {rows.length}
          </div>
        </div>

        {(searchableKeys?.length || normalizedFilters.length > 0) && (
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap">
            {searchableKeys?.length ? (
              <input
                type="text"
                placeholder={`Search ${title}`}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none md:max-w-xs"
              />
            ) : null}

            {normalizedFilters.map((filter) => (
              <div key={filter.key} className="relative">
                <select
                  value={filterValues[filter.key] ?? "all"}
                  onChange={(event) =>
                    setFilterValues((prev) => ({
                      ...prev,
                      [filter.key]: event.target.value,
                    }))
                  }
                  className="w-full appearance-none rounded-xl border border-white/15 bg-white/5 px-4 py-2 pr-10 text-sm text-white transition-colors hover:bg-white/10 focus:border-emerald-400 focus:bg-white/10 focus:outline-none md:w-auto"
                >
                  <option value="all" className="bg-slate-900 text-white">All {filter.label}</option>
                  {filter.options.map((option) => (
                    <option key={option.value} value={option.value} className="bg-slate-900 text-white">
                      {option.label}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-white/60">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="relative overflow-x-auto overflow-y-visible">
        <table className="min-w-full divide-y divide-white/5 text-left text-sm text-white/80">
          <thead className="bg-white/5">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className="px-4 py-3 font-medium uppercase tracking-wide text-xs text-white/60">
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {filteredRows.length === 0 ? (
              <tr>
                <td className="px-4 py-5 text-center text-sm text-white/50" colSpan={columns.length}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              filteredRows.map((row, idx) => (
                <tr key={`row-${safeValue(row.id) || idx}`} className="hover:bg-white/5 transition-colors">
                  {columns.map((column) => {
                    const cellValue = row[column.key as keyof GenericSupabaseRow];
                    return (
                      <td key={column.key} className={`px-4 py-3 align-top ${column.className ?? ""}`}>
                        {column.render ? column.render(row) : safeValue(cellValue) || "-"}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
};

const MetricCard = ({
  label,
  value,
  icon,
  accent,
  helper,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
  helper?: string;
}) => (
  <div className={`rounded-2xl border border-white/10 bg-gradient-to-br ${accent} p-5 shadow-lg`}>
    <div className="flex items-center gap-3">
      <span className="rounded-xl bg-black/20 p-2 text-white">{icon}</span>
      <p className="text-sm uppercase tracking-tight text-white/70">{label}</p>
    </div>
    <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    {helper && <p className="mt-2 text-xs text-white/70">{helper}</p>}
  </div>
);

const AdminDashboard = ({ sessionNonce }: AdminDashboardProps) => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AdminOverviewResponse | null>(null);
  const [lastPasswordUsed, setLastPasswordUsed] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<GenericSupabaseRow | null>(null);
  const isDevelopment = process.env.NODE_ENV === "development";
  const [activeUserActionId, setActiveUserActionId] = useState<string | null>(null);
  const actionMenuRef = useRef<HTMLDivElement | null>(null);
  const [tokenModalOpen, setTokenModalOpen] = useState(false);
  const [tokenModalUserId, setTokenModalUserId] = useState<string | null>(null);
  const [tokenAmount, setTokenAmount] = useState("");
  const [tokenDescription, setTokenDescription] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenSuccess, setTokenSuccess] = useState<string | null>(null);

  const fetchAdminData = useCallback(async (passwordToUse?: string) => {
    setLoading(true);
    setError(null);
    const resolvedPassword = passwordToUse?.trim() || (isDevelopment ? "dev-bypass" : "");
    try {
      const response = await fetch("/api/admin/overview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ 
          password: resolvedPassword, 
          nonce: sessionNonce 
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        const message = payload?.error ?? "Unable to authenticate admin session.";
        throw new Error(message);
      }

      const payload = (await response.json()) as AdminOverviewResponse;
      setData(payload);
      setLastPasswordUsed(resolvedPassword || null);
    } catch (err) {
      console.error(err);
      setData(null);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [isDevelopment, sessionNonce]);

  useEffect(() => {
    if (isDevelopment) {
      fetchAdminData();
    }
  }, [isDevelopment, fetchAdminData]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!password.trim()) {
      setError("Please enter the session-specific admin password.");
      return;
    }

    await fetchAdminData(password);
  };

  const handleRefresh = async () => {
    const candidatePassword = lastPasswordUsed ?? password;
    if (!candidatePassword?.trim() && !isDevelopment) {
      setError("Please re-enter the session-specific admin password to refresh data.");
      return;
    }
    await fetchAdminData(candidatePassword);
  };

  const isRefreshing = loading && !!data;
  const isVerifying = loading && !data;

  useEffect(() => {
    if (!activeUserActionId) {
      actionMenuRef.current = null;
      return;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (actionMenuRef.current?.contains(event.target as Node)) {
        return;
      }
      setActiveUserActionId(null);
    };

    document.addEventListener("mousedown", handleDocumentClick);
    return () => document.removeEventListener("mousedown", handleDocumentClick);
  }, [activeUserActionId]);

  useEffect(() => {
    if (data?.users) {
      setActiveUserActionId(null);
    }
  }, [data?.users]);

  const openTokenModalForUser = (userId: string) => {
    setActiveUserActionId(null);
    setTokenModalUserId(userId);
    setTokenAmount("");
    setTokenDescription("");
    setTokenError(null);
    setTokenSuccess(null);
    setTokenModalOpen(true);
  };

  const closeTokenModal = () => {
    setTokenModalOpen(false);
    setTokenError(null);
    setTokenSuccess(null);
    setTokenModalUserId(null);
  };

  const handleTokenSubmit = async () => {
    if (!tokenModalUserId) return;

    const amountValue = Number(tokenAmount);
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setTokenError("Enter a positive token amount.");
      setTokenSuccess(null);
      return;
    }

    const candidatePassword = lastPasswordUsed ?? password;
    const trimmedPassword = typeof candidatePassword === "string" ? candidatePassword.trim() : "";
    if (!trimmedPassword && !isDevelopment) {
      setTokenError("Re-enter the session-specific admin password to add tokens.");
      setTokenSuccess(null);
      return;
    }

    setTokenLoading(true);
    setTokenError(null);
    setTokenSuccess(null);

    try {
      const response = await fetch("/api/admin/token-transaction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          password: trimmedPassword,
          nonce: sessionNonce,
          userId: tokenModalUserId,
          amount: amountValue,
          description: tokenDescription.trim(),
        }),
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to record token adjustment.");
      }

      await fetchAdminData(trimmedPassword);
      setTokenAmount("");
      setTokenDescription("");
      setTokenSuccess("Token adjustment recorded.");
    } catch (err) {
      setTokenError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setTokenLoading(false);
    }
  };

  const handleJobDoubleClick = (job: GenericSupabaseRow) => {
    setSelectedJob(job);
  };

  // Create user lookup map for enriching rows with user info
  const userLookup = useMemo(() => {
    if (!data?.users) return new Map<string, { full_name?: string; email?: string }>();
    const map = new Map<string, { full_name?: string; email?: string }>();
    data.users.forEach((user) => {
      const userId = safeValue(user.user_id);
      if (userId) {
        map.set(userId, {
          full_name: safeValue(user.full_name) || undefined,
          email: safeValue(user.email) || undefined,
        });
      }
    });
    return map;
  }, [data?.users]);

  const userTokenBalances = useMemo(() => {
    const map = new Map<string, number>();
    if (!data?.tokenTransactions) {
      return map;
    }
    for (const tx of data.tokenTransactions) {
      const userId = safeValue(tx.user_id);
      if (!userId || map.has(userId)) continue;
      const balance =
        typeof tx.balance_after === "number"
          ? tx.balance_after
          : typeof tx.balance_after === "string"
            ? Number(tx.balance_after)
            : NaN;
      map.set(userId, Number.isFinite(balance) ? balance : 0);
    }
    return map;
  }, [data?.tokenTransactions]);

  // Helper component to render user info (full_name, email, user_id)
  const renderUserInfo = (userId: unknown, balance?: number) => {
    const userIdStr = safeValue(userId);
    if (!userIdStr) return "-";
    
    const userInfo = userLookup.get(userIdStr);
    const fullName = userInfo?.full_name;
    const email = userInfo?.email;

    return (
      <div className="flex flex-col gap-1">
        {fullName && (
          <div className="font-medium text-white">{fullName}</div>
        )}
        {email && (
          <div className="text-sm text-white/70">{email}</div>
        )}
        <div className="font-mono text-xs text-white/50">{userIdStr}</div>
        {typeof balance === "number" && Number.isFinite(balance) && (
          <div className="text-xs text-white/50">
            Balance: {numberFormatter.format(balance)} tokens
          </div>
        )}
      </div>
    );
  };

  const getUserTokenBalance = (userId: unknown) => {
    const userIdStr = safeValue(userId);
    if (!userIdStr) return undefined;
    return userTokenBalances.get(userIdStr);
  };

  const jobStatusEntries = useMemo(
    () => (data ? Object.entries(data.metrics.jobs.byStatus) : []),
    [data]
  );

  const jobUserOptions = useMemo(
    () => createUniqueOptions(data?.jobs ?? [], "user_id"),
    [data?.jobs]
  );
  const jobStatusOptions = useMemo(
    () => createStatusOptions(data?.metrics.jobs.byStatus),
    [data?.metrics.jobs.byStatus]
  );
  const jobFilters = useMemo<TableFilter[]>(() => {
    const filters: TableFilter[] = [];
    if (jobUserOptions.length) {
      filters.push({ key: "user_id", label: "User", options: jobUserOptions });
    }
    if (jobStatusOptions.length) {
      filters.push({ key: "status", label: "Status", options: jobStatusOptions });
    }
    return filters;
  }, [jobUserOptions, jobStatusOptions]);

  const usersUserIdOptions = useMemo(
    () => createUniqueOptions(data?.users ?? [], "user_id"),
    [data?.users]
  );
  const usersStatusOptions = useMemo(
    () => createUniqueOptions(data?.users ?? [], "status"),
    [data?.users]
  );
  const usersFilters = useMemo<TableFilter[]>(() => {
    const filters: TableFilter[] = [];
    if (usersUserIdOptions.length) {
      filters.push({ key: "user_id", label: "User", options: usersUserIdOptions });
    }
    if (usersStatusOptions.length) {
      filters.push({ key: "status", label: "Status", options: usersStatusOptions });
    }
    return filters;
  }, [usersUserIdOptions, usersStatusOptions]);

  const usersSectionDescription = useMemo(() => {
    if (!data) return "Users originating from Clerk webhooks.";
    const totalUsers = numberFormatter.format(data.users.length);
    const activeUsers = numberFormatter.format(data.metrics.users.active);
    return `Users originating from Clerk webhooks (${totalUsers} total, ${activeUsers} active).`;
  }, [data]);

  
  const tokenUserOptions = useMemo(
    () => createUniqueOptions(data?.tokenTransactions ?? [], "user_id"),
    [data?.tokenTransactions]
  );
  const tokenTypeOptions = useMemo(
    () => createUniqueOptions(data?.tokenTransactions ?? [], "type"),
    [data?.tokenTransactions]
  );
  const tokenFilters = useMemo<TableFilter[]>(() => {
    const filters: TableFilter[] = [];
    if (tokenUserOptions.length) {
      filters.push({ key: "user_id", label: "User", options: tokenUserOptions });
    }
    if (tokenTypeOptions.length) {
      filters.push({ key: "type", label: "Type", options: tokenTypeOptions });
    }
    return filters;
  }, [tokenUserOptions, tokenTypeOptions]);

  const errorUserOptions = useMemo(
    () => createUniqueOptions(data?.errors ?? [], "user_id"),
    [data?.errors]
  );
  const errorTypeOptions = useMemo(
    () => createUniqueOptions(data?.errors ?? [], "error_type"),
    [data?.errors]
  );
  const errorFilters = useMemo<TableFilter[]>(() => {
    const filters: TableFilter[] = [];
    if (errorUserOptions.length) {
      filters.push({ key: "user_id", label: "User", options: errorUserOptions });
    }
    if (errorTypeOptions.length) {
      filters.push({ key: "error_type", label: "Error Type", options: errorTypeOptions });
    }
    return filters;
  }, [errorUserOptions, errorTypeOptions]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-12 text-white lg:px-8">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-8 shadow-2xl shadow-emerald-500/10">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-white/50">Admin Vault</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">
              Elevated access for BR-MAX administrators
            </h1>
            <p className="mt-3 max-w-2xl text-base text-white/70">
              This route surfaces every render job, user, subscription, token transaction, and failure trace.
              A fresh password is required for every visit, derived from your admin secret and the session nonce below.
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
            <p className="text-sm text-white/60">Session nonce</p>
            <p className="font-mono text-xl tracking-[0.3em] text-white">{sessionNonce}</p>
          </div>
        </div>
      </header>

      {!data && (
        <section className="rounded-3xl border border-white/10 bg-black/60 p-8 shadow-2xl shadow-black/50 backdrop-blur">
          <form className="space-y-6" onSubmit={handleSubmit} autoComplete="off">
            <div>
              <label htmlFor="admin-password" className="text-sm font-medium text-white/80">
                Session password
              </label>
              <input
                id="admin-password"
                type="password"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
                placeholder={`Enter the oldest animal name...`}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 to-cyan-500 px-5 py-3 text-lg font-semibold text-white shadow-lg shadow-emerald-500/30 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying session
                </>
              ) : (
                <>
                  <ShieldCheck className="h-5 w-5" />
                  Delete my account
                </>
              )}
            </button>
          </form>
        </section>
      )}

      {data && (
        <>
          <section className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Total Jobs"
              value={numberFormatter.format(data.metrics.jobs.total)}
              helper={`Avg duration ${durationFormatter(data.metrics.jobs.averageDurationSec)}`}
              icon={<BarChart3 className="h-5 w-5" />}
              accent="from-slate-900 to-slate-800"
            />
            <MetricCard
              label="Job Fail Rate"
              value={`${(data.metrics.jobs.failureRate * 100).toFixed(1)}%`}
              helper={`${numberFormatter.format(data.metrics.jobs.byStatus.failed ?? 0)} failed`}
              icon={<Target className="h-5 w-5" />}
              accent="from-rose-900/50 to-rose-800/40"
            />
            <MetricCard
              label="Active Users"
              value={`${numberFormatter.format(data.metrics.users.active)} / ${numberFormatter.format(data.metrics.users.total)}`}
              helper={`${numberFormatter.format(data.metrics.users.deleted)} deleted`}
              icon={<Users className="h-5 w-5" />}
              accent="from-emerald-900/40 to-emerald-800/30"
            />
            <MetricCard
              label="Net Tokens"
              value={`${numberFormatter.format(data.metrics.tokens.netAmount)} tokens`}
              helper={`${numberFormatter.format(data.metrics.tokens.totalTransactions)} transactions`}
              icon={<Activity className="h-5 w-5" />}
              accent="from-cyan-900/40 to-cyan-800/30"
            />
          </section>

          <section className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 shadow-inner shadow-black/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.3em] text-white/60">Job status mix</p>
                <p className="text-xs text-white/50">
                  Snapshot generated {formatDate(data.generatedAt)}. Reload /a to rotate the session nonce.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Refreshing data
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Refresh data
                  </>
                )}
              </button>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              {jobStatusEntries.map(([status, count]) => (
                <div
                  key={status}
                  className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/80"
                >
                  <StatusBadge status={status} />
                  <span className="font-semibold">{numberFormatter.format(count)}</span>
                  <span className="text-white/50">jobs</span>
                </div>
              ))}
              {jobStatusEntries.length === 0 && (
                <p className="text-sm text-white/60">No jobs available.</p>
              )}
            </div>
          </section>

          <TableSection
            title="Render Jobs"
            icon={<Database className="h-5 w-5" />}
            description="Every render job regardless of status."
            rows={data.jobs}
            emptyLabel="No jobs have been created yet."
            searchableKeys={["job_id", "user_id", "status", "json_path", "lambda_render_id", "error_message"]}
            filters={jobFilters}
            columns={[
              {
                key: "job_id",
                label: "Job ID",
                render: (row) => {
                  const jobId = safeValue(row.job_id);
                  if (!jobId) return "-";
                  const lastFour = jobId.slice(-4);
                  return (
                    <button
                      className="font-mono text-xs text-white/80 hover:text-white transition-colors"
                      onClick={() => navigator.clipboard.writeText(jobId)}
                      onDoubleClick={() => handleJobDoubleClick(row)}
                      title={`Click to copy: ${jobId}`}
                    >
                      ...{lastFour}
                    </button>
                  );
                },
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusBadge status={safeValue(row.status)} />,
              },
              {
                key: "user_id",
                label: "User",
                render: (row) => renderUserInfo(row.user_id, getUserTokenBalance(row.user_id)),
              },
              {
                key: "created_at",
                label: "Created",
                render: (row) => formatDate(row.created_at),
              },
              {
                key: "utc_end",
                label: "Finished",
                render: (row) => formatDate(row.utc_end),
              },
              {
                key: "duration_sec",
                label: "Duration",
                render: (row) => {
                  const durationSec = row.duration_sec;
                  // If duration_sec exists and is valid, use it
                  if (durationSec != null) {
                    const value = typeof durationSec === "number" ? durationSec : Number(durationSec);
                    if (Number.isFinite(value) && value > 0) {
                      return formatDurationWithColor(value);
                    }
                  }
                  // Otherwise, calculate from utc_start and utc_end
                  const start = row.utc_start;
                  const end = row.utc_end;
                  if (start && end) {
                    const startDate = typeof start === "string" ? new Date(start) : null;
                    const endDate = typeof end === "string" ? new Date(end) : null;
                    if (startDate && endDate && !Number.isNaN(startDate.getTime()) && !Number.isNaN(endDate.getTime())) {
                      const diffSeconds = Math.round((endDate.getTime() - startDate.getTime()) / 1000);
                      if (diffSeconds > 0) {
                        return formatDurationWithColor(diffSeconds);
                      }
                    }
                  }
                  return <span className="text-white/50">-</span>;
                },
              },
            ]}
          />

          <TableSection
            title="Users"
            icon={<Users className="h-5 w-5" />}
            description={usersSectionDescription}
            rows={data.users}
            emptyLabel="No users found."
            searchableKeys={["user_id", "full_name", "email", "status"]}
            filters={usersFilters}
            columns={[
              {
                key: "user_id",
                label: "User ID",
                className: "font-mono text-xs",
                // Only show the first 4 and last 4 chracters, but when clicked it should copy the full user_id
                render: (row: GenericSupabaseRow) => (
                  <button className="text-xs text-white/80 hover:text-white" onClick={() => navigator.clipboard.writeText(row.user_id as string)}>
                    ...{(row.user_id as string).slice(-4)}
                  </button>
                ),
              },
              {
                key: "full_name",
                label: "Name",
                className: "font-mono text-xs",
              },
              {
                key: "status",
                label: "Status",
                render: (row) => <StatusBadge status={safeValue(row.status)} />,
              },
              {
                key: "created_at",
                label: "Created",
                render: (row) => formatDate(row.created_at),
              },
              {
                key: "updated_at",
                label: "Updated",
                render: (row) => formatDate(row.updated_at),
              },
              {
                key: "actions",
                label: "Actions",
                className: "text-right",
                render: (row) => {
                  const userId = safeValue(row.user_id);
                  if (!userId) {
                    return <span className="text-white/50">-</span>;
                  }
                  const menuOpen = activeUserActionId === userId;
                  return (
                    <div
                      ref={menuOpen ? actionMenuRef : undefined}
                      className="relative inline-flex justify-end"
                    >
                      <button
                        type="button"
                        className="rounded-full border border-white/10 bg-white/5 p-1 text-white/70 hover:bg-white/10"
                        onClick={(event) => {
                          event.stopPropagation();
                          setActiveUserActionId((prev) => (prev === userId ? null : userId));
                        }}
                        aria-label="User actions"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                      {menuOpen && (
                        <div
                          className="absolute right-0 top-full mt-2 w-40 rounded-2xl border border-white/10 bg-slate-900/90 p-2 shadow-xl z-50"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <button
                            type="button"
                            className="w-full rounded-xl px-3 py-2 text-left text-sm font-medium text-white hover:bg-white/10"
                            onClick={(event) => {
                              event.stopPropagation();
                              openTokenModalForUser(userId);
                            }}
                          >
                            Add token
                          </button>
                        </div>
                      )}
                    </div>
                  );
                },
              },
            ]}
          />

          <TableSection
            title="Token Transactions"
            icon={<Activity className="h-5 w-5" />}
            description="Complete token ledger, including admin adjustments, render holds, and subscription credits."
            rows={data.tokenTransactions}
            emptyLabel="No token transactions available."
            searchableKeys={["user_id", "type", "description", "paypal_subscription_id", "render_job_id"]}
            filters={tokenFilters}
            columns={[
              {
                key: "created_at",
                label: "Created",
                render: (row) => formatDate(row.created_at),
              },
              {
                key: "user_id",
                label: "User",
                render: (row) => renderUserInfo(row.user_id, getUserTokenBalance(row.user_id)),
              },
              {
                key: "type",
                label: "Type",
                render: (row) => <StatusBadge status={safeValue(row.type)} />,
              },
              {
                key: "amount",
                label: "Amount",
                render: (row) => `${numberFormatter.format(Number(row.amount ?? 0))}`,
              },
              {
                key: "balance_after",
                label: "Balance",
                render: (row) => numberFormatter.format(Number(row.balance_after ?? 0)),
              },
              {
                key: "description",
                label: "Description",
                className: "max-w-sm text-xs",
              },
            ]}
          />

          <TableSection
            title="Render Errors"
            icon={<AlertCircle className="h-5 w-5" />}
            description="Stored error envelope for failed renders."
            rows={data.errors}
            emptyLabel="No render errors logged."
            searchableKeys={["user_id", "error_type", "user_message", "debug_message"]}
            filters={errorFilters}
            columns={[
              {
                key: "created_at",
                label: "Created",
                render: (row) => formatDate(row.created_at),
              },
              {
                key: "user_id",
                label: "User",
                render: (row) => renderUserInfo(row.user_id, getUserTokenBalance(row.user_id)),
              },
              {
                key: "error_type",
                label: "Type",
                className: "uppercase text-xs tracking-wide",
              },
              {
                key: "user_message",
                label: "User message",
                className: "max-w-sm text-xs",
              },
              {
                key: "debug_message",
                label: "Debug",
                className: "max-w-sm text-xs text-white/70",
              },
            ]}
          />

          <Modal
            open={tokenModalOpen}
            onClose={closeTokenModal}
            title="Add tokens"
            actionButton={
              <Button type="button" disabled={tokenLoading} onClick={handleTokenSubmit}>
                {tokenLoading ? "Recording..." : "Add tokens"}
              </Button>
            }
          >
            <div className="space-y-4 text-white">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wide text-white/50">Target user</p>
                <div className="mt-2 text-sm text-white">
                  {tokenModalUserId ? (
                    renderUserInfo(tokenModalUserId, getUserTokenBalance(tokenModalUserId))
                  ) : (
                    <span className="text-sm text-white/60">Select a user before adding tokens.</span>
                  )}
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white/80">Tokens to add</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={tokenAmount}
                  onChange={(event) => setTokenAmount(event.target.value)}
                  placeholder="e.g. 500"
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="text-sm font-medium text-white/80">Reason / notes</label>
                <textarea
                  value={tokenDescription}
                  onChange={(event) => setTokenDescription(event.target.value)}
                  placeholder="Explain the credit (e.g., internal recognition or bug bounty)."
                  className="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-2 text-sm text-white placeholder:text-white/40 focus:border-emerald-400 focus:outline-none"
                  rows={4}
                />
              </div>
              <p className="text-xs text-white/60">
                Amounts and explanations are added as a token transaction for this user.
              </p>
              {tokenError && <p className="text-sm text-rose-400">{tokenError}</p>}
              {tokenSuccess && <p className="text-sm text-emerald-400">{tokenSuccess}</p>}
            </div>
          </Modal>

          {selectedJob && (
            <JobJsonModal
              job={selectedJob}
              onClose={() => setSelectedJob(null)}
            />
          )}
        </>
      )}
    </main>
  );
};

export default AdminDashboard;
