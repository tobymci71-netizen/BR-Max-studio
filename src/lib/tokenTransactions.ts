import { supabaseAdmin } from "./supabaseAdmin";

interface AddTokenTransactionParams {
  userId: string;
  type:
  | "render_hold"
  | "render_deduct"
  | "render_refund"
  | "admin_credit"
  | "admin_debit"
  | "token_purchase";
  amount: number
  description: string;
  renderJobId?: string;
  metadata?: Record<string, unknown>;
}

export async function getCurrentTokenBalance(userId: string): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("token_transactions")
    .select("balance_after")
    // .eq("id", "75031569-4b2c-4d15-af6c-f04f44b1f6f8")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    // .order("id", { ascending: false })
    .limit(1)
    .maybeSingle();
  console.log("getCurrentTokenBalance data: ", data);
  console.log("getCurrentTokenBalance error: ", error);

  if (error) {
    console.error("❌ WARNING: Failed to get current token balance");
    console.error("User ID:", userId);
    console.error("Full Error Object:", JSON.stringify(error, null, 2));
    console.error("Error Code:", error.code);
    console.error("Error Message:", error.message);
    console.error("Error Details:", error.details);
    console.error("Error Hint:", error.hint);
    console.error("Defaulting to balance of 0");
    console.error("Timestamp:", new Date().toISOString());
    return 0;
  }

  if (!data) {
    console.log("ℹ️ No previous transactions found for user:", userId, "- Starting balance at 0");
    return 0;
  }

  return data.balance_after || 0;
}

export async function addTokenTransaction(
  params: AddTokenTransactionParams,
): Promise<{ success: boolean; newBalance: number; transactionId?: string }> {
  try {
    // Get current balance
    const currentBalance = await getCurrentTokenBalance(params.userId);
    const newBalance = currentBalance + params.amount;

    // Prevent negative balance for debits
    if (newBalance < 0) {
      console.error("Insufficient tokens for transaction");
      return { success: false, newBalance: currentBalance };
    }

    // Insert transaction
    const { data, error } = await supabaseAdmin
      .from("token_transactions")
      .insert({
        user_id: params.userId,
        type: params.type,
        amount: params.amount,
        balance_after: newBalance,
        description: params.description,
        render_job_id: params.renderJobId || null,
        metadata: params.metadata || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("❌ CRITICAL: Failed to insert token_transaction");
      console.error("User ID:", params.userId);
      console.error("Transaction Type:", params.type);
      console.error("Amount:", params.amount);
      console.error("New Balance (attempted):", newBalance);
      console.error("Description:", params.description);
      console.error("Metadata:", JSON.stringify(params.metadata, null, 2));
      console.error("Full Error Object:", JSON.stringify(error, null, 2));
      console.error("Error Code:", error.code);
      console.error("Error Message:", error.message);
      console.error("Error Details:", error.details);
      console.error("Error Hint:", error.hint);
      console.error("Timestamp:", new Date().toISOString());

      return { success: false, newBalance: currentBalance };
    }

    console.log(
      `Token transaction created: ${params.type} ${params.amount} tokens for user ${params.userId}. New balance: ${newBalance}`,
    );

    return { success: true, newBalance, transactionId: data.id };
  } catch (error) {
    console.error("Error in addTokenTransaction:", error);
    return { success: false, newBalance: 0 };
  }
}

export async function getTokenTransactionHistory(
  userId: string,
  limit: number = 50,
): Promise<
  Array<{
    id: string;
    type: string;
    amount: number;
    balance_after: number;
    description: string;
    created_at: string;
    render_job_id: string | null;
  }>
> {
  const { data, error } = await supabaseAdmin
    .from("token_transactions")
    .select(
      "id, type, amount, balance_after, description, created_at, render_job_id",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error getting transaction history:", error);
    return [];
  }

  return data || [];
}
