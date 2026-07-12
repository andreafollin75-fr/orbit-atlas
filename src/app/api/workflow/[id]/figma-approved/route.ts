import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { uploadPng } from "@/lib/blob";

export const dynamic = "force-dynamic";

interface FigmaExport { figmaFrameName: string; base64: string; }

// Called by the Figma plugin once the user has reviewed the injected slides.
// Body: { exports: { figmaFrameName: string; base64: string }[] }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
    const workflow = await db.carouselWorkflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  const body = await req.json();
    const exportsList: FigmaExport[] = body.exports ?? [];

  // Node 9 -> Node 10: mark the workflow as exporting while we pull the PNGs
  // out of the Figma plugin payload and push them to Blob storage.
  await db.carouselWorkflow.update({ where: { id }, data: { status: "EXPORTING" } });

  const renderedUrls: string[] = [];
    try {
          for (let i = 0; i < exportsList.length; i++) {
                  const item = exportsList[i];
                  const buffer = Buffer.from(item.base64, "base64");
                  const url = await uploadPng(buffer, `workflow-${id}-slide-${i}.png`);
                  renderedUrls.push(url);
          }
    } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          await db.carouselWorkflow.update({
                  where: { id },
                  data: { status: "FAILED", errorMessage: message },
          });
          return NextResponse.json({ error: `Failed to upload renders: ${message}` }, { status: 500 });
    }

  await db.carouselWorkflow.update({
        where: { id },
        data: { renderedUrls: JSON.stringify(renderedUrls), status: "AWAITING_PUBLISH" },
  });

  return NextResponse.json({ ok: true, renderedUrls });
}
