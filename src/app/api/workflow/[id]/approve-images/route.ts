import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { triggerUnsplashDownload } from "@/lib/unsplash";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;
  const body = await req.json();
  const images = body?.images;

if (!images || typeof images !== "object") {
  return NextResponse.json({ error: "images invalides" }, { status: 400 });
}

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const downloadTriggers = Object.values(images)
  .map((img: any) => img?.unsplashDownloadLocation)
  .filter(Boolean);

await Promise.all(downloadTriggers.map((loc: any) => triggerUnsplashDownload(loc)));

const updated = await db.carouselWorkflow.update({
  where: { id },
  data: {
    images: JSON.stringify(images),
    status: "RENDERING",
  },
});

return NextResponse.json({ workflow: updated });
}
