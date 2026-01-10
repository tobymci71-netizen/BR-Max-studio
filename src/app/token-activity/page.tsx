"use client"

import { useEffect, useMemo, useState } from "react"
import { useAuth, SignInButton } from "@clerk/nextjs"
import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2, X } from "lucide-react"

interface TokenTransaction {
  id: string
  type: string
  amount: number
  balance_after: number
  description: string
  created_at: string
  render_job_id?: string | null
  hidden?: boolean
  displayAmount?: number
  displayBalanceAfter?: number
}

const formatShortDate = (value: string) =>
  new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

const formatLongDate = (value: string) =>
  new Date(value).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

export default function TokenActivityPage() {
  const { userId, isLoaded } = useAuth()
  const router = useRouter()
  const [tokenBalance, setTokenBalance] = useState(0)
  const [transactions, setTransactions] = useState<TokenTransaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedTransaction, setSelectedTransaction] = useState<TokenTransaction | null>(null)

  useEffect(() => {
    if (!isLoaded) return

    if (!userId) {
      setLoading(false)
      return
    }

    const loadTokenData = async () => {
      try {
        setLoading(true)
        setError(null)

        const tokenResponse = await fetch("/api/tokens/info")
        if (!tokenResponse.ok) {
          throw new Error("Failed to load token information")
        }

        const tokenData = await tokenResponse.json()
        setTokenBalance(tokenData.balance ?? 0)
        setTransactions(tokenData.transactions || [])
      } catch (err) {
        console.error("Error loading token information:", err)
        setError("We couldn't load your token activity. Please try again later.")
      } finally {
        setLoading(false)
      }
    }

    loadTokenData()
  }, [userId, isLoaded])

  const visibleTransactions = useMemo(
    () => transactions.filter((tx) => !tx.hidden),
    [transactions],
  )

  const totals = useMemo(() => {
    const earned = visibleTransactions.reduce((sum, tx) => {
      const amount = tx.displayAmount ?? tx.amount
      return amount > 0 ? sum + amount : sum
    }, 0)
    const spent = visibleTransactions.reduce((sum, tx) => {
      const amount = tx.displayAmount ?? tx.amount
      return amount < 0 ? sum + amount : sum
    }, 0)
    return { earned, spent, count: visibleTransactions.length }
  }, [visibleTransactions])

  if (loading && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-foreground/60 mx-auto mb-4" />
          <p className="text-foreground/60 text-xs tracking-wide">Loading token activity...</p>
        </div>
      </div>
    )
  }

  if (!userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <div className="max-w-sm text-center">
          <h2 className="text-xl font-light text-foreground mb-3">Sign in to view tokens</h2>
          <p className="text-sm text-foreground/60 mb-6">
            Create an account or sign in to check your current balance and token history.
          </p>
          <SignInButton mode="modal">
            <button className="px-5 py-2 bg-foreground text-background text-sm font-medium rounded hover:opacity-90 transition-opacity">
              Sign in
            </button>
          </SignInButton>
        </div>
      </div>
    )
  }

  const lastUpdated = visibleTransactions[0]?.created_at ?? transactions[0]?.created_at
  const selectedDetailAmount = selectedTransaction
    ? selectedTransaction.displayAmount ?? selectedTransaction.amount
    : 0
  const selectedDetailIsCredit = selectedDetailAmount >= 0
  const selectedDetailBalance =
    selectedTransaction?.displayBalanceAfter ?? selectedTransaction?.balance_after ?? 0

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-8">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-2 text-foreground/50 hover:text-foreground/80 text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="space-y-1">
          <h1 className="text-3xl font-light text-foreground tracking-tight">Token Activity</h1>
          <p className="text-xs text-foreground/60">
            Track your current balance, insights, and a detailed transaction history.
          </p>
        </div>

        {error ? (
          <div className="rounded-xl border border-foreground/15 bg-foreground/[0.02] px-6 py-8 text-center">
            <p className="text-sm text-foreground/70">{error}</p>
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-foreground/10 bg-gradient-to-br from-foreground/5 to-background/70 px-6 py-6 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-foreground/60">Current Balance</p>
                  <p className="text-3xl font-light text-foreground">
                    {tokenBalance.toLocaleString()}
                    <span className="text-sm text-foreground/50 ml-2">tokens</span>
                  </p>
                </div>
                <div className="flex flex-col text-right">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-foreground/50">Transactions</p>
                  <p className="text-xl font-semibold text-foreground/90">{totals.count}</p>
                </div>
              </div>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-foreground/5 bg-background/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-foreground/50">Earned</p>
                  <p className="text-lg font-medium text-emerald-600">{totals.earned.toLocaleString()}</p>
                </div>
                <div className="rounded-xl border border-foreground/5 bg-background/70 px-4 py-3">
                  <p className="text-[11px] uppercase tracking-wide text-foreground/50">Spent</p>
                  <p className="text-lg font-medium text-rose-600">{Math.abs(totals.spent).toLocaleString()}</p>
                </div>
              </div>
              {lastUpdated && (
                <p className="text-[11px] text-foreground/50 mt-4">
                  Last activity: {formatShortDate(lastUpdated)}
                </p>
              )}
            </div>

            <div className="rounded-2xl border border-foreground/10 bg-foreground/[0.02] shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-foreground/10">
                <h2 className="text-lg font-light text-foreground">Timeline</h2>
                <p className="text-[11px] text-foreground/60 mt-1">Latest token movements</p>
              </div>

              {visibleTransactions.length === 0 ? (
                <div className="px-6 py-8 text-center">
                  <p className="text-[12px] text-foreground/60">No transactions yet</p>
                </div>
              ) : (
                <div className="divide-y divide-foreground/10">
                  {visibleTransactions.map((tx) => {
                    const amountToShow = tx.displayAmount ?? tx.amount
                    const balanceToShow = tx.displayBalanceAfter ?? tx.balance_after
                    const isCredit = amountToShow >= 0
                    return (
                      <button
                        key={tx.id}
                        type="button"
                        onClick={() => setSelectedTransaction(tx)}
                        className="w-full px-6 py-4 flex items-center justify-between hover:bg-foreground/[0.02] transition-colors text-left"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground/90 truncate">{tx.description}</p>
                          <p className="text-[11px] text-foreground/60 mt-1 flex items-center gap-2">
                            <span>{formatShortDate(tx.created_at)}</span>
                            <span className="text-foreground/20">-</span>
                            <span className="uppercase tracking-wide text-[10px] text-foreground/50">{tx.type}</span>
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <p
                            className={`text-sm font-medium ${
                              isCredit ? "text-emerald-600" : "text-rose-600"
                            }`}
                          >
                            {isCredit ? "+" : ""}
                            {amountToShow.toLocaleString()}
                          </p>
                          <p className="text-[11px] text-foreground/50 mt-1">
                            Balance: <span className="text-foreground/70">{balanceToShow.toLocaleString()}</span>
                          </p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-md rounded-2xl border border-foreground/10 bg-background p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-foreground/50">Transaction Detail</p>
                <p className="text-xl font-semibold text-foreground mt-1 truncate">{selectedTransaction.description}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-full border border-foreground/15 p-2 text-foreground/50 hover:text-foreground/80"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-4 text-sm text-foreground/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide">Type</span>
                <span className="uppercase text-foreground/80">{selectedTransaction.type}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide">Amount</span>
                <span
                  className={`font-medium ${selectedDetailIsCredit ? "text-emerald-600" : "text-rose-600"}`}
                >
                  {selectedDetailIsCredit ? "+" : ""}
                  {selectedDetailAmount.toLocaleString()} tokens
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide">Balance after</span>
                <span className="text-foreground/80">{selectedDetailBalance.toLocaleString()}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-wide">Timestamp</span>
                <span className="text-foreground/70">{formatLongDate(selectedTransaction.created_at)}</span>
              </div>
            </div>
            <div className="mt-6 text-[12px] text-foreground/50">
              Click outside or press the close icon to exit the detail view.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
