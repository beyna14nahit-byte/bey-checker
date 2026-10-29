import { NextResponse } from "next/server";
import { getPublicState, toClientState } from "@/lib/public-state";
import { NO_STORE } from "@/lib/http";

export const dynamic = "force-dynamic";

// The current price according to the server clock. Pages call this before showing the order
// review and again when a promotion starts or ends while the page is open.
export async function GET() {
  return NextResponse.json({ ok: true, ...toClientState(await getPublicState()) }, { headers: NO_STORE });
}
