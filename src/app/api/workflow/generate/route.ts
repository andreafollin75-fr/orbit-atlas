import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { scrapeSources, ScrapingConfig } from "@/lib/scraping";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

const body = await req.json();
  const businessId = body?.businessId;
  const templateId = body?.templateId;
  const prompt = body?.prompt;
  const tone = body?.tone;
  const language = body?.language;
  const sourceTypes = body?.sourceTypes;
  const maxAgeMonths = body?.maxAgeMonths;
  const excludedDomains = body?.excludedDomains;
  const socialAccountId = body?.socialAccountId;

if (!businessId || !templateId || !prompt) {
  return NextResponse.json({ error: "businessId, templateId et prompt sont requis" }, { status: 400 });
}

const business = await db.business.findFirst({
  where: { id: businessId, userId: session.user.id },
});

if (!business) {
  return NextResponse.json({ error: "Business introuvable" }, { status: 404 });
}

const config = {
  tone: tone || undefined,
  language: language || "FR",
  sourceTypes: Array.isArray(sourceTypes) ? sourceTypes : undefined,
  maxAgeMonths: typeof maxAgeMonths === "number" ? maxAgeMonths : undefined,
  excludedDomains: Array.isArray(excludedDomains) ? excludedDomains : undefined,
};

const workflow = await db.carouselWorkflow.create({
  data: {
    businessId,
    templateId,
    createdById: session.user.id,
    socialAccountId: socialAccountId || null,
    prompt,
    config: JSON.stringify(config),
    status: "SCRAPING",
  },
});

const scrapingConfig: ScrapingConfig = { consigne: prompt, ...config };

try {
  const sources = await scrapeSources(scrapingConfig);

  const updated = await db.carouselWorkflow.update({
    where: { id: workflow.id },
    data: {
      sources: JSON.stringify(sources),
      status: "AWAITING_SOURCES",
    },
  });

  return NextResponse.json({ workflow: updated, sources });
} catch (err) {
  console.error("workflow generate error", err);
  await db.carouselWorkflow.update({
    where: { id: workflow.id },
    data: {
      status: "FAILED",
      errorMessage: err instanceof Error ? err.message : "Erreur de scraping",
    },
  });
  return NextResponse.json({ error: "Scraping failed", workflowId: workflow.id }, { status: 500 });
}
}
