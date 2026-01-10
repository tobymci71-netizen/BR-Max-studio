import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { addTokenTransaction, getCurrentTokenBalance } from "@/lib/tokenTransactions";
import { Message } from "@/types/constants";

/**
 * Calculates estimated tokens needed for a video
 *
 * Formula:
 * - Base fee: 10 tokens (every video)
 * - Messages: 1 token per message
 * - Custom background: 10 tokens extra (if not using default)
 * - Monetization takeover: 20 tokens extra when enabled
 *
 * Example: 90 messages + custom background + monetization
 * - Base: 10 + Messages: 90 + Background: 10 + Monetization: 20 = 130 tokens
 */
export async function calculateEstimatedTokens(
  messages: Message[],
  hasCustomBg: boolean,
  usesMonetization: boolean,
): Promise<number> {
  const base = 10;
  const perMessage = messages.length; // 1 token per message
  const background = hasCustomBg ? 10 : 0;
  const monetization = usesMonetization ? 20 : 0;
  const subtotal = base + perMessage + background + monetization;
  return subtotal;
}

/**
 * Main function: Validates balance, calculates cost, and holds tokens
 * Returns success=true if video generation can proceed
 */
export async function validateAndHoldTokens(
  userId: string,
  jobId: string,
  messages: Message[],
  hasCustomBg: boolean,
  usesMonetization: boolean,
) {
  const estimatedTokens = await calculateEstimatedTokens(messages, hasCustomBg, usesMonetization);
  const availableTokens = await getCurrentTokenBalance(userId);

  // Check if user has enough tokens
  if (availableTokens < estimatedTokens) {
    return {
      success: false,
      error: "Insufficient tokens",
      tokensNeeded: estimatedTokens,
      availableTokens,
    };
  }

  // Hold tokens (negative transaction)
  const result = await addTokenTransaction({
    userId,
    type: 'render_hold',
    amount: -estimatedTokens, // Negative to deduct
    description: `Token hold for render job - ${messages.length} messages${hasCustomBg ? ' with custom background' : ''}`,
    renderJobId: jobId,
    metadata: {
      message_count: messages.length,
      has_custom_background: hasCustomBg,
      monetization_enabled: usesMonetization,
      estimated_tokens: estimatedTokens,
    },
  });

  if (!result.success) {
    return {
      success: false,
      error: "Failed to hold tokens",
      tokensNeeded: estimatedTokens,
    };
  }

  return {
    success: true,
    message: "Tokens held successfully. Proceed with EC2 render.",
    tokensHeld: estimatedTokens,
    newBalance: result.newBalance,
  };
}

/**
 * Called when a render job completes or fails
 * - If success: Marks tokens as used (already deducted via hold)
 * - If failed: Refunds the held tokens back to user
 *
 * This function is IDEMPOTENT - calling it multiple times for the same job
 * will only create one refund/deduct transaction.
 */
export async function handleJobCompletion(
  userId: string,
  jobId: string,
  success: boolean
) {
  // Find the hold transaction for this job
  const { data: holdTx, error: txError } = await supabaseAdmin
    .from("token_transactions")
    .select("*")
    .eq("render_job_id", jobId)
    .eq("user_id", userId)
    .eq("type", "render_hold")
    .single();

  if (txError || !holdTx) {
    console.error("No hold transaction found for job:", jobId, txError);
    return {
      success: false,
      error: "No pending transaction found for this job"
    };
  }

  const heldAmount = Math.abs(holdTx.amount); // Get positive amount

  if (success) {
    // Check if deduct transaction already exists (idempotency)
    const { data: existingDeduct } = await supabaseAdmin
      .from("token_transactions")
      .select("id")
      .eq("render_job_id", jobId)
      .eq("user_id", userId)
      .eq("type", "render_deduct")
      .single();

    if (existingDeduct) {
      console.log("Deduct transaction already exists for job:", jobId);
      return {
        success: true,
        message: "Tokens already deducted",
        tokensUsed: heldAmount,
        alreadyProcessed: true,
      };
    }

    // Job succeeded - tokens already deducted via hold
    // Just log the completion
    const result = await addTokenTransaction({
      userId,
      type: 'render_deduct',
      amount: 0, // No change, already deducted
      description: `Render job completed successfully - ${heldAmount} tokens used`,
      renderJobId: jobId,
      metadata: {
        held_transaction_id: holdTx.id,
        tokens_used: heldAmount,
      },
    });

    return {
      success: result.success,
      message: "Tokens deducted successfully",
      tokensUsed: heldAmount,
    };
  } else {
    // Check if refund transaction already exists (idempotency - CRITICAL FOR PREVENTING DOUBLE REFUNDS)
    const { data: existingRefund } = await supabaseAdmin
      .from("token_transactions")
      .select("id, balance_after")
      .eq("render_job_id", jobId)
      .eq("user_id", userId)
      .eq("type", "render_refund")
      .single();

    if (existingRefund) {
      console.log("Refund transaction already exists for job:", jobId);
      return {
        success: true,
        message: "Tokens already refunded",
        tokensRefunded: heldAmount,
        newBalance: existingRefund.balance_after,
        alreadyProcessed: true,
      };
    }

    // Job failed - refund the held tokens
    const result = await addTokenTransaction({
      userId,
      type: 'render_refund',
      amount: heldAmount, // Positive to add back
      description: `Refund for failed render job - ${heldAmount} tokens returned`,
      renderJobId: jobId,
      metadata: {
        held_transaction_id: holdTx.id,
        tokens_refunded: heldAmount,
      },
    });

    return {
      success: result.success,
      message: "Tokens refunded successfully",
      tokensRefunded: heldAmount,
      newBalance: result.newBalance,
    };
  }
}

/**
 * Helper function to check if user has enough tokens for a render
 * Used in credits-check API
 */
export async function checkTokenAvailability(
  userId: string,
  messages: Message[],
  hasCustomBg: boolean,
  usesMonetization: boolean,
) {
  const tokensNeeded = await calculateEstimatedTokens(messages, hasCustomBg, usesMonetization);
  const availableTokens = await getCurrentTokenBalance(userId);

  return {
    hasEnough: availableTokens >= tokensNeeded,
    tokensNeeded,
    availableTokens,
  };
}
