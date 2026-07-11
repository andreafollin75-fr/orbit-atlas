import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessAccount } from "@/lib/access";

export const dynamic = "force-dynamic";

interface ApprovePublishBody {
    caption?: string;
    hashtags?: string;
    scheduledAt?: string;
}

// Node 11: creates the final Post (and PostAccount if a social account is
// attached) from the rendered carousel slides, then schedules it. The
// existing /api/cron/publish job (Node 12) will pick it up when it is due.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
    const workflow = await db.carouselWorkflow.findUnique({ where: { id } });
    if (!workflow) return NextResponse.json({ error: "Workflow not found" }, { status: 404 });

  if (workflow.socialAccountId) {
        const allowed = await canAccessAccount(session.user.id, session.user.role, workflow.socialAccountId);
        if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body: ApprovePublishBody = await req.json();
    const caption = body.caption ?? "";
    const hashtags = body.hashtags ?? "";
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();

  const renderedUrls: string[] = workflow.renderedUrls ? JSON.parse(workflow.renderedUrls) : [];
    if (renderedUrls.length === 0) {
          return NextResponse.json({ error: "Aucune slide rendue pour ce workflow" }, { status: 400 });
    }

  const post = await db.post.create({
        data: {
                businessId: workflow.businessId,
                caption,
                hashtags,
                mediaUrls: JSON.stringify(renderedUrls),
                mediaType: "carousel",
                status: "scheduled",
                scheduledAt,
                aiGenerated: true,
                source: "carousel-workflow",
                sourceData: JSON.stringify({ workflowId: workflow.id }),
        },
  });

  if (workflow.socialAccountId) {
        await db.postAccount.create({
                data: { postId: post.id, socialAccountId: workflow.socialAccountId },
        });
  }

  await db.carouselWorkflow.update({
        where: { id },
        data: { caption, hashtags, scheduledAt, status: "SCHEDULED" },
  });

  return NextResponse.json({ ok: true, postId: post.id });
}
