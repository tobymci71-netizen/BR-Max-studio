"use client";

import { useEffect, useState, Suspense, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { Check, Copy, Loader2 } from "lucide-react";

interface PaymentInfo {
  txnId: string;
  tokens: number;
  amount: string;
  currency: string;
  method: string;
  timestamp: string;
  payerEmail?: string;
}

function SuccessContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [info, setInfo] = useState<PaymentInfo | null>(null);
  const [copied, setCopied] = useState(false);
  const hasCaptured = useRef(false); 


  useEffect(() => {
    const processPayment = async () => {
      const txnId = searchParams.get("txnId");
      const paypalToken = searchParams.get("token"); // PayPal sends 'token'

      try {
        // SCENARIO 1: We have a Transaction ID (Razorpay or revisited page)
        if (txnId) {
          const res = await fetch(`/api/transactions/${txnId}`);
          if (!res.ok) throw new Error("Transaction not found");
          const data = await res.json();
          setInfo(data);
          setStatus("success");
        } 
        // SCENARIO 2: We have a PayPal Token (Need to capture first)
        else if (paypalToken) {
          if (hasCaptured.current) return;
          hasCaptured.current = true; // Mark as capturing

          const res = await fetch("/api/paypal/capture-order", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: paypalToken }),
          });

          const data = await res.json();
          if (!data.success) throw new Error(data.error || "Payment failed. Contact support.");
          
          // Use the data returned from capture directly
          setInfo({
            txnId: data.transactionId,
            tokens: data.paymentInfo.tokens,
            amount: data.paymentInfo.amount,
            currency: "USD", // PayPal is typically USD in your app
            method: "PayPal",
            timestamp: data.paymentInfo.timestamp,
            payerEmail: data.paymentInfo.payerEmail,
          });
          
          setStatus("success");

          // Optional: Clean up the URL to show the txnId instead of the token
          router.replace(`/payment-success?txnId=${data.transactionId}`);
        } 
        // SCENARIO 3: No params
        else {
          setStatus("error");
        }
      } catch (err) {
        console.error(err);
        setStatus("error");
      }
    };

    processPayment();
  }, [searchParams, router]);

  const copyToClipboard = () => {
    if (info?.txnId) {
      navigator.clipboard.writeText(info.txnId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black font-sans p-4">
      <main className="w-full max-w-sm bg-white dark:bg-black">
        {/* Logo */}
        <div className="text-center mb-8">
          <Image src="/BR.svg" alt="BR" width={60} height={15} className="mx-auto opacity-80" />
        </div>

        {/* LOADING STATE */}
        {status === "loading" && (
          <div className="text-center py-12">
            <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-zinc-900 dark:text-zinc-100" />
            <p className="text-xs text-zinc-500">Verifying transaction details...</p>
          </div>
        )}

        {/* SUCCESS STATE */}
        {status === "success" && info && (
          <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto">
                 <Check className="w-8 h-8 text-green-600 dark:text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-white">Payment Successful</h2>
                <p className="text-xs text-zinc-500 mt-1">Your tokens have been added.</p>
              </div>
            </div>

            {/* Big Token Number */}
            <div className="text-center py-6 border-y border-zinc-100 dark:border-zinc-900">
              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2">TOKENS ADDED</p>
              <p className="text-5xl font-bold text-zinc-900 dark:text-white">+{info.tokens.toLocaleString()}</p>
            </div>

            {/* Receipt Details */}
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Amount Paid</span>
                <span className="font-medium text-zinc-900 dark:text-white">
                   {info.currency === "INR" ? "₹" : "$"}{info.amount}
                </span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-500">Transaction ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] bg-zinc-100 dark:bg-zinc-800 px-2 py-1 rounded text-zinc-600 dark:text-zinc-300">
                    {info.txnId}
                  </span>
                  <button onClick={copyToClipboard} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors">
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between py-1">
                <span className="text-zinc-500">Date</span>
                <span className="text-zinc-900 dark:text-white text-right text-xs">
                   {new Date(info.timestamp).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-4">
              <Link 
                href="/" 
                className="uppercase block w-full text-center py-3.5 bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-semibold tracking-wide hover:opacity-90 transition-opacity rounded-lg"
              >
                OPEN STUDIO
              </Link>
            </div>
          </div>
        )}

        {/* ERROR STATE */}
        {status === "error" && (
           <div className="text-center space-y-6 py-8">
            <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto">
              <span className="text-xl">✕</span>
            </div>
            <div>
              <h2 className="text-lg font-medium text-zinc-900 dark:text-white">Verification Failed</h2>
              <p className="text-xs text-zinc-500 mt-2 max-w-[200px] mx-auto">
                We couldn't retrieve the transaction details. Please contact support if money was deducted.
              </p>
            </div>
            <Link href="/" className="inline-block px-8 py-3 bg-zinc-900 dark:bg-white text-white dark:text-black text-xs font-medium rounded-lg">
              Go Back
            </Link>
           </div>
        )}
      </main>
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white dark:bg-black" />}>
      <SuccessContent />
    </Suspense>
  );
}