import Image from "next/image";
import Link from "next/link";

export default function CancelPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-black font-sans p-4">
      <main className="w-full max-w-sm">
        <div className="text-center mb-6">
          <Image src="/BR.svg" alt="BR" width={60} height={15} className="mx-auto opacity-80" />
        </div>

        <div className="text-center space-y-6">
          <svg className="w-10 h-10 text-zinc-400 dark:text-zinc-600 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>

          <div>
            <h2 className="text-xl font-light text-black dark:text-white mb-1.5">Payment Cancelled</h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-500">No charges were made</p>
          </div>

          <Link href="/" className="inline-block px-6 py-3 bg-black dark:bg-white text-white dark:text-black text-xs font-medium hover:bg-zinc-800 dark:hover:bg-zinc-200 transition-colors">
            Back
          </Link>
        </div>
      </main>
    </div>
  );
}