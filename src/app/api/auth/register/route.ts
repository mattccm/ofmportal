import { NextResponse } from "next/server";

// Registration is disabled - this is a private single-agency portal
// All users (staff and creators) must be invited by the agency owner
export async function POST() {
  return NextResponse.json(
    { error: "Registration is disabled. Please contact your administrator." },
    { status: 403 }
  );
}
