import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET!;

export const runtime = "nodejs";

type ClerkEmailAddress = {
  id: string;
  email_address: string;
};

type ClerkUserData = {
  id: string;
  first_name?: string | null;
  last_name?: string | null;
  email_addresses?: ClerkEmailAddress[];
  primary_email_address_id?: string | null;
  image_url?: string | null;
};

type ClerkEvent =
  | { type: "user.created"; data: ClerkUserData }
  | { type: "user.deleted"; data: ClerkUserData }
  | { type: string; data: ClerkUserData };

function extractPrimaryEmail(user: ClerkUserData): string | null {
  if (!user.email_addresses || user.email_addresses.length === 0) {
    return null;
  }

  if (user.primary_email_address_id) {
    const match = user.email_addresses.find(
      (email) => email.id === user.primary_email_address_id
    );
    if (match?.email_address) {
      return match.email_address;
    }
  }

  return user.email_addresses[0]?.email_address ?? null;
}

export async function POST(req: NextRequest) {
  const payload = await req.text();
  const headers = {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };

  try {
    const wh = new Webhook(WEBHOOK_SECRET);
    const evt = wh.verify(payload, headers) as ClerkEvent;
    const userData = evt.data as ClerkUserData | undefined;
    const userId = userData?.id;

    if (!userId) {
      return new NextResponse("Missing user id in event", { status: 400 });
    }

    if (evt.type === "user.created") {
      // 1. Create user in users table
      console.log("user.created", userData);
      const firstName = userData?.first_name ?? null;
      const lastName = userData?.last_name ?? null;
      const fullName =
        [firstName, lastName].filter((part) => part && part.trim().length > 0).join(" ") || null;
      const email = userData ? extractPrimaryEmail(userData) : null;
      const avatarUrl = userData?.image_url ?? null;

      const { error: userError } = await supabaseAdmin
        .from("users")
        .upsert(
          {
            user_id: userId,
            status: "active",
            first_name: firstName,
            last_name: lastName,
            full_name: fullName,
            email,
            avatar_url: avatarUrl,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );

      if (userError) {
        console.error("[users upsert] error:", userError);
        return new NextResponse("DB error creating user", { status: 500 });
      }

      console.log(`User created in database: ${userId}`);

      // // 2. Credit welcome tokens (500 tokens)
      // const result = await addTokenTransaction({
      //   userId,
      //   type: 'admin_credit',
      //   amount: 500,
      //   description: 'Welcome bonus - 500 free tokens',
      //   metadata: {
      //     reason: 'new_user_signup',
      //     source: 'clerk_webhook',
      //   },
      // });

      // if (result.success) {
      //   console.log(`Credited 500 welcome tokens to user ${userId}. Balance: ${result.newBalance}`);
      // } else {
      //   console.error(`Failed to credit welcome tokens to user ${userId}`);
      //   // Don't fail the webhook - user is created, tokens can be added manually
      // }

    } else if (evt.type === "user.deleted") {
      // Soft delete user
      const { error } = await supabaseAdmin
        .from("users")
        .update({ status: "deleted" })
        .eq("user_id", userId);

      if (error) {
        console.error("[users soft delete] error:", error);
        return new NextResponse("DB error", { status: 500 });
      }

      console.log(`User soft deleted: ${userId}`);
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[clerk webhook] verify/handle failed:", err);
    return new NextResponse("Invalid signature or handler error", { status: 400 });
  }
}
