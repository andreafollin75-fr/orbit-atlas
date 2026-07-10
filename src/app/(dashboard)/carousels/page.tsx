"use client";

import { useEffect, useState } from "react";

interface SlotDef {
  name: string;
  kind: "text" | "image";
}
interface SlideRow {
  id: string;
  index: number;
  figmaFrameName: string;
  slots: string;
}
interface CarouselTemplate {
  id: string;
  name: string;
  slides: SlideRow[];
}
interface CarouselWorkflow {
  id: string;
  status: string;
  templateId: string;
}
interface SocialAccount {
  id: string;
  username?: string;
  platform?: string;
}
interface Business {
  id: string;
  name: string;
  socialAccounts: SocialAccount[];
}

const SLIDES_EXAMPLE = `[
  { "figmaFrameName": "slide_1_hook", "type": "hook",
    "slots": [{ "name": "TITRE", "kind": "text" }, { "name": "IMAGE_1", "kind": "image" }] },
  { "figmaFrameName": "slide_2_contexte", "type": "context",
    "slots": [{ "name": "TEXTE", "kind": "text" }] }
]`;

export default function CarouselsPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [templates, setTemplates] = useState<CarouselTemplate[]>([]);
  const [workflows, setWorkflows] = useState<CarouselWorkflow[]>([]);

  const [businessId, setBusinessId] = useState("");
  const [socialAccountId, setSocialAccountId] = useState("");

  const [templateName, setTemplateName] = useState("");
  const [editorialStyle, setEditorialStyle] = useState("");
  const [slidesJson, setSlidesJson] = useState(SLIDES_EXAMPLE);

  const [templateId, setTemplateId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [slotValues, setSlotValues] = useState<Record<string, string>>({});

  const [createdId, setCreatedId] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/businesses").then((r) => r.json()).then(setBusinesses);
    fetch("/api/carousel-templates").then((r) => r.json()).then(setTemplates);
    fetch("/api/workflow").then((r) => r.json()).then(setWorkflows);
  }, []);

  const business = businesses.find((b) => b.id === businessId);
  const template = templates.find((t) => t.id === templateId);

  async function createTemplate() {
    setBusy(true);
    setError("");
    try {
      let slides;
      try {
        slides = JSON.parse(slidesJson);
      } catch {
        throw new Error("Le JSON des slides est invalide");
      }
      const res = await fetch("/api/carousel-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: businessId || null, name: templateName, editorialStyle, slides }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setTemplates((prev) => [data, ...prev]);
      setTemplateName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  async function createWorkflow() {
    setBusy(true);
    setError("");
    setCreatedId("");
    try {
      if (!template) throw new Error("Choisis un template");
      const slides = template.slides.map((s) => {
        const defs: SlotDef[] = JSON.parse(s.slots || "[]");
        const slots: Record<string, string> = {};
        defs.forEach((d) => {
          if (d.kind === "text") slots[d.name] = slotValues[`t:${s.index}:${d.name}`] || "";
        });
        return { index: s.index, slots };
      });
      const images: Record<string, string> = {};
      template.slides.forEach((s) => {
        const defs: SlotDef[] = JSON.parse(s.slots || "[]");
        if (defs.some((d) => d.kind === "image")) {
          images[String(s.index)] = slotValues[`i:${s.index}`] || "";
        }
      });
      const res = await fetch("/api/workflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, templateId, socialAccountId: socialAccountId || null, prompt, slides, images }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erreur");
      setCreatedId(data.id);
      setWorkflows((prev) => [data, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="p-8 max-w-3xl mx-auto space-y-10">
      <h1 className="text-2xl font-semibold text-[#1c1a17]">Carousels Figma</h1>

      <a href="/carousels/ai" className="inline-block text-sm underline text-[#1c1a17]">Nouveau: generer un carrousel avec l'IA (nodes 1-7) &rarr;</a>
    </a>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <section className="space-y-3">
        <h2 className="font-medium text-[#1c1a17]">Business</h2>
        <select
          className="border rounded px-3 py-2 w-full"
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
        >
          <option value="">Choisir un business</option>
          {businesses.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="font-medium text-[#1c1a17]">1. Creer un template (frames Figma)</h2>
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Nom du template"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
        />
        <input
          className="border rounded px-3 py-2 w-full"
          placeholder="Style editorial (optionnel)"
          value={editorialStyle}
          onChange={(e) => setEditorialStyle(e.target.value)}
        />
        <textarea
          className="border rounded px-3 py-2 w-full font-mono text-xs h-40"
          value={slidesJson}
          onChange={(e) => setSlidesJson(e.target.value)}
        />
        <button
          disabled={busy || !templateName}
          onClick={createTemplate}
          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
        >
          Creer le template
        </button>
      </section>

      <section className="space-y-3 border-t pt-6">
        <h2 className="font-medium text-[#1c1a17]">2. Choisir un template</h2>
        <select
          className="border rounded px-3 py-2 w-full"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Choisir un template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name} ({t.slides.length} slides)</option>
          ))}
        </select>
      </section>

      {template && (
        <section className="space-y-3 border-t pt-6">
          <h2 className="font-medium text-[#1c1a17]">3. Remplir le contenu</h2>
          <select
            className="border rounded px-3 py-2 w-full"
            value={socialAccountId}
            onChange={(e) => setSocialAccountId(e.target.value)}
          >
            <option value="">Compte social (optionnel)</option>
            {(business?.socialAccounts ?? []).map((a) => (
              <option key={a.id} value={a.id}>{a.username || a.platform}</option>
            ))}
          </select>
          <textarea
            className="border rounded px-3 py-2 w-full h-20"
            placeholder="Prompt / consigne"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          {template.slides.map((s) => {
            const defs: SlotDef[] = JSON.parse(s.slots || "[]");
            return (
              <div key={s.id} className="border rounded p-3 space-y-2">
                <p className="text-xs text-[#857f74]">{s.figmaFrameName}</p>
                {defs.map((d) =>
                  d.kind === "image" ? (
                    <input
                      key={d.name}
                      className="border rounded px-3 py-2 w-full"
                      placeholder={`URL image (${d.name})`}
                      value={slotValues[`i:${s.index}`] || ""}
                      onChange={(e) =>
                        setSlotValues((prev) => ({ ...prev, [`i:${s.index}`]: e.target.value }))
                      }
                    />
                  ) : (
                    <input
                      key={d.name}
                      className="border rounded px-3 py-2 w-full"
                      placeholder={d.name}
                      value={slotValues[`t:${s.index}:${d.name}`] || ""}
                      onChange={(e) =>
                        setSlotValues((prev) => ({ ...prev, [`t:${s.index}:${d.name}`]: e.target.value }))
                      }
                    />
                  )
                )}
              </div>
            );
          })}
          <button
            disabled={busy || !businessId}
            onClick={createWorkflow}
            className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
          >
            Creer le workflow
          </button>
        </section>
      )}

      {createdId && (
        <section className="border-t pt-6 space-y-2">
          <h2 className="font-medium text-[#1c1a17]">Workflow ID a coller dans le plugin Figma</h2>
          <div className="flex gap-2">
            <input readOnly className="border rounded px-3 py-2 w-full font-mono text-sm" value={createdId} />
            <button
              onClick={() => navigator.clipboard.writeText(createdId)}
              className="border rounded px-3 py-2"
            >
              Copier
            </button>
          </div>
        </section>
      )}

      <section className="border-t pt-6 space-y-2">
        <h2 className="font-medium text-[#1c1a17]">Workflows existants</h2>
        {workflows.length === 0 && <p className="text-sm text-[#857f74]">Aucun workflow pour le moment.</p>}
        {workflows.map((w) => (
          <div key={w.id} className="flex items-center justify-between border rounded px-3 py-2">
            <span className="font-mono text-xs">{w.id}</span>
            <span className="text-xs text-[#857f74]">{w.status}</span>
            <button
              onClick={() => navigator.clipboard.writeText(w.id)}
              className="text-xs border rounded px-2 py-1"
            >
              Copier
            </button>
          </div>
        ))}
      </section>
    </div>
  );
}
