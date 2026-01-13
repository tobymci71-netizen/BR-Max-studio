"use client";

import { useRouter } from "next/navigation";
import { XCircle, ArrowLeft, HelpCircle } from "lucide-react";

export default function SubscriptionCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-transparent p-4">
      <div className="max-w-md w-full bg-white dark:bg-zinc-900 rounded-lg border border-gray-200 dark:border-zinc-800 p-8 text-center">
        <div className="w-16 h-16 bg-orange-100 dark:bg-orange-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Subscription Cancelled
        </h1>

        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Your subscription checkout was cancelled. No charges were made to your account.
        </p>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6 text-left">
          <div className="flex items-start">
            <HelpCircle className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                Changed your mind?
              </h3>
              <p className="text-sm text-blue-800 dark:text-blue-400">
                You can subscribe at any time to unlock premium features and get monthly tokens.
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <button
            onClick={() => router.push("/pricing")}
            className="w-full bg-purple-600 dark:bg-purple-700 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 dark:hover:bg-purple-600 transition"
          >
            View Pricing Plans
          </button>

          <button
            onClick={() => router.push("/dashboard")}
            className="w-full border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-gray-300 py-3 rounded-lg font-semibold hover:bg-gray-50 dark:hover:bg-zinc-800 transition flex items-center justify-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </button>
        </div>

        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
          Need help?{" "}
          <a
            href="https://discord.gg/brmax"
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-600 dark:text-purple-400 hover:underline"
          >
            Contact us on Discord
          </a>
        </p>
      </div>
    </div>
  );
}
