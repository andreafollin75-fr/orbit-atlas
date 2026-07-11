import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessAccount } from "@/lib/access";
import { duplicateFigmaFile } from "@/lib/figma";

export const dynamic = "force-dynamic";

// Node 8: duplicates the Figma template file for this workflow and moves
// the status to AWAITING_FIGMA_EDIT so the user can open it and adjust it.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
    const workflow = await db.carouselWorkflow.findUnique({ where: { id }, include: { template: true } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  if (workflow.socialAccountId) {
        const allowed = await canAccessAccount(session.user.id, session.user.role, workflow.socialAccountId);
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!workflow.template.figmaFileKey) {
        return NextResponse.json({ error: "Ce template n'a pas de fichier Figma associe" }, { status: 400 });
  }

  try {
        const name = `Orbit Atlas - ${workflow.prompt.slice(0, 60)} - ${workflow.id}`;
        const duplicated = await duplicateFigmaFile(workflow.template.figmaFileKey, name);

      await db.carouselWorkflow.update({
              where: { id },
              data: {
                        figmaFileKey: duplicated.fileKey,
                        figmaFileUrl: duplicated.fileUrl,
                        status: "AWAITING_FIGMA_EDIT",
              },
      });

      return NextResponse.json({ ok: true, figmaFileUrl: duplicated.fileUrl });
  } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        await db.carouselWorkflow.update({ where: { id }, data: { status: "FAILED", errorMessage: message } });
        return NextResponse.json({ error: message }, { status: 500 });
  }
}
