import { getOpenAI } from "@/lib/openai";

export interface SourceForStructuring {
  title: string;
  url: string;
  summary: string;
  domain: string;
}

export interface SlideSlotDefinition {
  name: string;
  kind: "text" | "image";
  maxChars?: number;
  instruction?: string;
}

export interface SlideDefinition {
  index: number;
  type?: string | null;
  slots: SlideSlotDefinition[];
}

export interface StructuringConfig {
  consigne: string;
  tone?: string;
  language?: string;
}

export interface OutlineSlide {
  index: number;
  type?: string | null;
  slots: Record<string, string>;
}

export interface Outline {
  slides: OutlineSlide[];
}

export async function structureCarousel(
  config: StructuringConfig,
  sources: SourceForStructuring[],
  slides: SlideDefinition[]
  ): Promise<Outline> {
  const openai = getOpenAI();

const sourcesText = sources
  .map((s, i) => "Source " + (i + 1) + " (" + s.domain + "): " + s.title + "\n" + s.summary + "\nURL: " + s.url)
  .join("\n\n");

const slidesSpec = slides
  .map((slide) => {
    const slotsDesc = slide.slots
    .filter((slot) => slot.kind === "text")
    .map((slot) => {
      const maxChars = slot.maxChars ? " (max " + slot.maxChars + " caracteres)" : "";
      const instruction = slot.instruction ? " - " + slot.instruction : "";
      return "  - " + slot.name + maxChars + instruction;
    })
    .join("\n");
    const imageSlots = slide.slots
    .filter((slot) => slot.kind === "image")
    .map((slot) => "  - " + slot.name + " (slot image: fournir un prompt de recherche descriptif en anglais)")
    .join("\n");
    return "Slide " + slide.index + " (type: " + (slide.type || "standard") + "):\n" + slotsDesc + (imageSlots ? "\n" + imageSlots : "");
  })
  .join("\n\n");

const langLabel = config.language === "EN" ? "anglais" : "francais";

const prompt = [
  "Tu es un redacteur editorial specialise dans les carrousels Instagram.",
  "Consigne de l utilisateur: " + config.consigne,
  "Ton editorial souhaite: " + (config.tone || "informatif"),
  "Langue de redaction: " + langLabel,
  "",
  "Voici les sources validees a utiliser pour ecrire le contenu (ne pas inventer de faits hors de ces sources):",
  sourcesText,
  "",
  "Voici la structure exacte des slides du template a remplir. Respecte strictement les noms de slots et les limites de caracteres:",
  slidesSpec,
  "",
  'Reponds uniquement en JSON strict de la forme { "slides": [ { "index": 0, "type": "hook", "slots": { "NOM_DU_SLOT": "texte" } } ] }.',
  "Pour les slots image, mets un prompt de recherche d image court et descriptif en anglais dans le texte du slot.",
  ].join("\n");

const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  response_format: { type: "json_object" },
  messages: [
    { role: "system", content: "Tu structures un carrousel Instagram a partir de sources fiables, en respectant un format JSON strict." },
    { role: "user", content: prompt },
    ],
});

const raw = completion.choices[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);

if (!parsed || !Array.isArray(parsed.slides)) {
  throw new Error("Reponse IA invalide: slides manquantes");
}

return { slides: parsed.slides as OutlineSlide[] };
}
