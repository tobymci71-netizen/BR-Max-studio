import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

/* ✅ Allowed origins in production */
const allowedOrigins = [
  "https://brmax.xyz",
  "https://studio.brmax.xyz",
];

/* ✅ Helper: Always returns a string */
function getCorsOrigin(request: Request): string {
  const origin = request.headers.get("origin");

  // ✅ Development: allow all origins
  if (process.env.NODE_ENV !== "production") {
    return "*";
  }

  // ✅ Production: allow only trusted domains
  if (origin && allowedOrigins.includes(origin)) {
    return origin;
  }

  // ✅ Block everything else
  return "null"; // must be string, not null
}

/* ✅ Common CORS headers */
function corsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  };
}

/* ✅ OPTIONS Preflight */
export async function OPTIONS(request: Request) {
  const origin = getCorsOrigin(request);

  return new NextResponse(null, {
    status: 200,
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
