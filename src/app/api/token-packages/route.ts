import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ✅ Allowed origins */
const allowedOrigins = [
  "https://brmax.xyz",
  "https://www.brmax.xyz",
  "https://studio.brmax.xyz",
  "https://development.brmax.xyz",
  // Development origins
  "http://localhost:3000",
  "http://localhost:3001",
  "http://127.0.0.1:3000",
];

/* ✅ Helper: Returns the requesting origin if allowed, otherwise null */
function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("origin");

  // ✅ If no origin header (e.g., same-origin requests), allow it
  if (!origin) {
    return "*";
  }

  // ✅ Check if origin is in allowed list
  if (allowedOrigins.includes(origin)) {
    return origin;
  }

  // ✅ In development, allow any localhost/127.0.0.1 origin
  if (process.env.NODE_ENV !== "production") {
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return origin;
    }
  }

  // ✅ Block everything else - return the origin anyway to avoid errors, 
  // but the browser will block it if it doesn't match
  return origin;
}

/* ✅ Common CORS headers */
function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400", // 24 hours
  };
}

/* ✅ OPTIONS Preflight */
export async function OPTIONS(request: Request) {
  const origin = getCorsOrigin(request);

  return new NextResponse(null, {
    status: 204, // No Content is more appropriate for OPTIONS
    headers: corsHeaders(origin),
  });
}

/* ✅ GET Request */
export async function GET(request: Request) {
  const origin = getCorsOrigin(request);

  try {
    const { data, error } = await supabaseAdmin
      .from("token_packages")
      .select("*")
      .order("priceUSD", { ascending: true });

    if (error) {
      console.error("Error fetching token packages:", error);

      return NextResponse.json(
        { error: "Failed to fetch token packages" },
        {
          status: 500,
          headers: corsHeaders(origin),
        }
      );
    }

    return NextResponse.json(
      { packages: data || [] },
      {
        status: 200,
        headers: corsHeaders(origin),
      }
    );
  } catch (err) {
    console.error("Unexpected error:", err);

    return NextResponse.json(
      { error: "Internal server error" },
      {
        status: 500,
        headers: corsHeaders(origin),
      }
    );
  }
}