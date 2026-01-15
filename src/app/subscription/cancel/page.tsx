// /app/subscription-cancel/page.tsx
"use client";

import { useRouter } from "next/navigation";
import { XCircle, ArrowLeft, MessageCircle } from "lucide-react";

export default function SubscriptionCancelPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-red-50 p-4">
      <div className="max-w-2xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-red-500 p-8 text-center">
          <XCircle className="w-20 h-20 text-white mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-white mb-2">
            Subscription Canceled
          </h1>
          <p className="text-orange-100">
            Your subscription process was not completed
          </p>
        </div>

        {/* Content */}
        <div className="p-8">
          <div className="text-center mb-8">
            <p className="text-gray-700 text-lg mb-4">
              Don't worry! You haven't been charged and no subscription was created.
            </p>
            <p className="text-gray-600">
              If you experienced any issues or have questions, we're here to help!
            </p>
          </div>

          {/* Why did you cancel? */}
          <div className="bg-blue-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-blue-600" />
              We'd love your feedback
            </h3>
            <p className="text-sm text-gray-700 mb-4">
              Help us improve! Let us know if you encountered any issues or have suggestions:
            </p>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>• Was the pricing unclear?</li>
              <li>• Did you have technical difficulties?</li>
              <li>• Do you need more information about features?</li>
              <li>• Something else?</li>
            </ul>
          </div>

          {/* Common Questions */}
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-gray-800 mb-4">Common Questions</h3>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Will I be charged?</h4>
                <p className="text-sm text-gray-600">
                  No, you won't be charged. The subscription was not created.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Can I try again?</h4>
                <p className="text-sm text-gray-600">
                  Absolutely! You can subscribe anytime from our pricing page.
                </p>
              </div>
              <div>
                <h4 className="font-medium text-gray-700 mb-1">Do you offer trials?</h4>
                <p className="text-sm text-gray-600">
                  Check our pricing page for current offers and trial options.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() => router.push("/pricing")}
              className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Pricing
            </button>
            
            <button
              onClick={() => router.push("/dashboard")}
              className="w-full border-2 border-gray-300 text-gray-700 py-3 rounded-lg font-semibold hover:border-gray-400 hover:bg-gray-50 transition"
            >
              Go to Dashboard
            </button>
            
            <button
              onClick={() => window.open("https://discord.gg/h4chRAbjEZ", "_blank")}
              className="w-full border-2 border-purple-300 text-purple-700 py-3 rounded-lg font-semibold hover:border-purple-400 hover:bg-purple-50 transition flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-5 h-5" />
              Contact Support
            </button>
          </div>

          {/* Footer Note */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Changed your mind? We'd love to have you as a subscriber!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}