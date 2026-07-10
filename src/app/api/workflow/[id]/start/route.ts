import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeSources, ScrapingConfig } from "@/lib/scraping";

export const maxDuration = 60;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const { id } = await params;

const workflow = await db.carouselWorkflow.findFirst({
  where: { id, business: { userId: session.user.id } },
});

if (!workflow) {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

let config: ScrapingConfig;
  try {
    const parsedConfig = JSON.parse(workflow.config || "{}");
    config = { consigne: workflow.prompt, ...parsedConfig };
  } catch {
    config = { consigne: workflow.prompt };
  }

try {
  const sources = await scrapeSources(config);

  const updated = await db.carouselWorkflow.update({
    where: { id },
    data: {
      sources: JSON.stringify(sources),
      status: "AWAITING_SOURCES",
    },
  });

  return NextResponse.json({ workflow: updated, sources });
} catch (err) {
  console.error("workflow start error", err);
  await db.carouselWorkflow.update({
    where: { id },
    data: {
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "Erreur de scraping",
    },
  });
  return NextResponse.json({ error: "Scraping failed" }, { status: 500 });
}
}
