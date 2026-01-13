import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("Missing STRIPE_SECRET_KEY");
}

if (!process.env.NEXT_PUBLIC_BASE_URL) {
  throw new Error("Missing NEXT_PUBLIC_BASE_URL");
}

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Unauthorized. Please login" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const packageId = body.packageId;

    if (!packageId) {
      return NextResponse.json(
        { error: "Package ID is required" },
        { status: 400 }
      );
    }

    // Fetch the package from your existing token_packages table
    const { data: packageData, error: packageError } = await supabaseAdmin
      .from("token_packages")
      .select("*")
      .eq("id", packageId)
      .single();

    if (packageError || !packageData) {
      console.error("Error fetching package:", packageError);
      return NextResponse.json(
        { error: "Invalid package selected" },
        { status: 400 }
      );
    }

    // Check if user already has an active subscription
    const { data: existingSubscription } = await supabaseAdmin
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (existingSubscription) {
      return NextResponse.json(
        { error: "You already have an active subscription" },
        { status: 400 }
      );
    }

    // Get user email from Clerk
    const user = await auth();
    const userEmail = user?.sessionClaims?.email as string | undefined;

    // Create Stripe checkout session for monthly subscription
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${packageData.name} - Monthly Subscription`,
              description: `${packageData.tokens} tokens per month`,
            },
            unit_amount: Math.round(parseFloat(packageData.priceUSD) * 100), // Convert to cents
            recurring: {
              interval: "month",
            },
          },
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/subscription-cancel`,
      customer_email: userEmail,
      client_reference_id: userId,
      metadata: {
        user_id: userId,
        package_id: packageId,
        tokens: packageData.tokens.toString(),
        package_name: packageData.name,
      },
      subscription_data: {
        metadata: {
          user_id: userId,
          package_id: packageId,
          tokens: packageData.tokens.toString(),
          package_name: packageData.name,
        },
      },
    });

    console.log("✅ Stripe checkout session created:", session.id);

    return NextResponse.json({
      sessionId: session.id,
      url: session.url,
      packageName: packageData.name,
      tokens: packageData.tokens,
      price: packageData.priceUSD,
    });
  } catch (error) {
    console.error("Stripe Create Checkout Session Error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}