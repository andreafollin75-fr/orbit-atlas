import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

function parseJson(value: string | null) {
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
  include: { template: { include: { slides: true } } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

return NextResponse.json({
  workflow: {
    ...workflow,
    config: parseJson(workflow.config),
    sources: parseJson(workflow.sources),
    outline: parseJson(workflow.outline),
    images: parseJson(workflow.images),
    renderedUrls: parseJson(workflow.renderedUrls),
  },
});
}
