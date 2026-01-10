import { useAuth } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";

export function useSupabase() {
  const { getToken } = useAuth();

  const supabase = useMemo(() => {
    const secondParam = process.env.NODE_ENV === "development" ? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY! : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      secondParam,
      {
        global: {
          fetch: async (url, options = {}) => {
            const clerkToken = await getToken();

            const headers = new Headers(options?.headers);
            if (clerkToken && process.env.NODE_ENV !== "development") {
              headers.set("Authorization", `Bearer ${clerkToken}`);
            }

            return fetch(url, { ...options, headers });
          },
        },
      },
    );
  }, [getToken]);

  return { supabase };
}
