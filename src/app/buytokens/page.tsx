"use client"

import Image from "next/image"
import TokenPurchaseForm from "@/components/TokenPurchaseForm"

export default function BuyTokens() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-white dark:bg-black font-sans">
      <main className="w-full max-w-4xl py-6 px-4">
        <div className="text-center mb-6">
          <Image src="/BR.svg" alt="BR" width={60} height={15} priority className="mx-auto opacity-80 mb-4" />
        </div>

        <TokenPurchaseForm />
      </main>
    </div>
  ) 
}
