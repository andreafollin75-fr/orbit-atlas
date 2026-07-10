import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { searchUnsplashPhotos } from "@/lib/unsplash";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;
  const query = req.nextUrl.searchParams.get("query");

if (!query) {
  return NextResponse.json({ error: "query manquante" }, { status: 400 });
}

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

const photos = await searchUnsplashPhotos(query);

return NextResponse.json({ photos });
}
