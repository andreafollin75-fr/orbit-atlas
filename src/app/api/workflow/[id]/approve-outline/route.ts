import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;
  const body = await req.json();
  const outline = body?.outline;

if (!outline || !Array.isArray(outline.slides)) {
  return NextResponse.json({ error: "outline invalide" }, { status: 400 });
}

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const updated = await db.carouselWorkflow.update({
  where: { id },
  data: {
    outline: JSON.stringify(outline),
    status: "AWAITING_IMAGES",
  },
});

return NextResponse.json({ workflow: updated });
}
