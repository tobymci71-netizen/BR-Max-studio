import { useAuth } from "@clerk/nextjs";
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useMemo, useRef } from "react";

export function useSupabase() {
  const { getToken } = useAuth();
  const clientRef = useRef<SupabaseClient | null>(null);

  const supabase = useMemo(() => {
    const isDev = process.env.NODE_ENV === "development";
    const supabaseKey = isDev 
      ? process.env.NEXT_PUBLIC_SUPABASE_SERVICE_KEY! 
      : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey,
      {
        global: {
          fetch: async (url, options = {}) => {
            const clerkToken = await getToken();
            const headers = new Headers(options?.headers);
            
            if (clerkToken && !isDev) {
              headers.set("Authorization", `Bearer ${clerkToken}`);
            }
            
            return fetch(url, { ...options, headers });
          },
        },
        realtime: {
          params: {
            // This is the key fix - send auth token in realtime params
            eventsPerSecond: 10,
          },
        },
      },
    );

    clientRef.current = client;
    return client;
  }, [getToken]);

  // Set auth for realtime in production
  useEffect(() => {
    if (process.env.NODE_ENV === "development" || !clientRef.current) return;

    const setRealtimeAuth = async () => {
      const token = await getToken();
      if (token && clientRef.current) {
        // Set the auth token for realtime connections
        await clientRef.current.realtime.setAuth(token);
      }
    };

    setRealtimeAuth();
  }, [getToken]);

  return { supabase };
}