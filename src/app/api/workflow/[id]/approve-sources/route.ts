import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { structureCarousel, SlideSlotDefinition, SlideDefinition } from "@/lib/structuring";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;
  const body = await req.json();
  const sources = Array.isArray(body?.sources) ? body.sources : null;

if (!sources) {
  return NextResponse.json({ error: "sources manquantes" }, { status: 400 });
}

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
  include: { template: { include: { slides: true } } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

await db.carouselWorkflow.update({
  where: { id },
  data: {
    sources: JSON.stringify(sources),
    status: "STRUCTURING",
  },
});

let config: { consigne: string; tone?: string; language?: string };
  try {
    const parsedConfig = JSON.parse(workflow.config || "{}");
    config = { consigne: workflow.prompt, ...parsedConfig };
  } catch {
    config = { consigne: workflow.prompt };
  }

const slides: SlideDefinition[] = workflow.template.slides
  .sort((a, b) => a.index - b.index)
  .map((slide) => {
    let slots: SlideSlotDefinition[] = [];
    try {
      slots = JSON.parse(slide.slots || "[]");
    } catch {
      slots = [];
    }
    return { index: slide.index, type: slide.type, slots };
  });

try {
  const outline = await structureCarousel(config, sources, slides);

  const updated = await db.carouselWorkflow.update({
    where: { id },
    data: {
      outline: JSON.stringify(outline),
      status: "AWAITING_OUTLINE",
    },
  });

  return NextResponse.json({ workflow: updated, outline });
} catch (err) {
  console.error("approve-sources structuring error", err);
  await db.carouselWorkflow.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "Erreur de structuration",
    },
  });
  return NextResponse.json({ error: "Structuring failed" }, { status: 500 });
}
}
