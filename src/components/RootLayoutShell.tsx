"use client";
import type { PropsWithChildren } from "react";
import { usePathname } from "next/navigation";
import Navbar from "./Navbar/page";
import WelcomeAnimation from "./WelcomeAnimation";
import Footer from "./Footer/Footer";

export default function RootLayoutShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const hideChrome = pathname?.startsWith("/studio-paywall");

  return (
    <>
      <WelcomeAnimation />
      <div className="flex flex-1 flex-col">
        {/* {!hideChrome && ( */}
          <div className="sticky top-0 z-50 w-full">
            <Navbar />
          </div>
        {/* )} */}
        <main
          className={`flex-1 w-full min-w-0 flex flex-col overflow-x-hidden ${
            hideChrome ? "" : "pb-8"
          }`}
        >
          {children}
        </main>
        <Footer />
      </div>
    </>
  );
}
