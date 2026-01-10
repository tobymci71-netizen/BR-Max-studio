import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getCurrentTokenBalance, getTokenTransactionHistory } from '@/lib/tokenTransactions';

type TokenTransaction = Awaited<ReturnType<typeof getTokenTransactionHistory>>[number];

const decorateTransactions = (transactions: TokenTransaction[]) => {
  const jobGrouping = new Map<
    string,
    {
      hold?: TokenTransaction;
      refund?: TokenTransaction;
      deduct?: TokenTransaction;
    }
  >();

  for (const tx of transactions) {
    if (!tx.render_job_id) continue;
    const bucket = jobGrouping.get(tx.render_job_id) ?? {};
    if (tx.type === 'render_hold') bucket.hold = tx;
    if (tx.type === 'render_refund') bucket.refund = tx;
    if (tx.type === 'render_deduct') bucket.deduct = tx;
    jobGrouping.set(tx.render_job_id, bucket);
  }

  return transactions.map((tx) => {
    const decorated: TokenTransaction & {
      hidden?: boolean;
      displayAmount?: number;
      displayBalanceAfter?: number;
    } = {
      ...tx,
      displayAmount: tx.amount,
      displayBalanceAfter: tx.balance_after,
      hidden: false,
    };

    if (!tx.render_job_id) {
      return decorated;
    }

    const bucket = jobGrouping.get(tx.render_job_id);
    if (!bucket?.hold) {
      return decorated;
    }

    if (bucket.refund && !bucket.deduct) {
      if (tx.type === 'render_hold' || tx.type === 'render_refund') {
        decorated.hidden = true;
      }
    } else if (bucket.deduct) {
      if (tx.type === 'render_hold') {
        decorated.hidden = true;
      }
      if (tx.type === 'render_deduct') {
        decorated.displayAmount = bucket.hold.amount;
        decorated.displayBalanceAfter =
          bucket.hold.balance_after ?? decorated.displayBalanceAfter;
      }
    }

    return decorated;
  });
};

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const balance = await getCurrentTokenBalance(userId);
    const transactions = await getTokenTransactionHistory(userId, 10);
    const decorated = decorateTransactions(transactions);

    return NextResponse.json({ 
      balance, 
      transactions: decorated
    });
  } catch (error) {
    console.error('Error fetching token info:', error);
    return NextResponse.json({ error: 'Failed to fetch token info' }, { status: 500 });
  }
}
