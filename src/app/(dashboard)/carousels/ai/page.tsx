"use client";

import { useEffect, useState } from "react";

interface SlotDef {
    name: string;
    kind: "text" | "image";
    maxChars?: number;
    instruction?: string;
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

interface SourceItem {
    title: string;
    url: string;
    summary: string;
    date?: string;
    domain: string;
    score: number;
}

interface OutlineSlide {
    index: number;
    type?: string;
    slots: Record<string, string>;
}

interface Outline {
    slides: OutlineSlide[];
}

interface ImageSelection {
    imageUrl: string;
    imageCredit?: string;
}

interface UnsplashPhoto {
    id: string;
    url: string;
    thumbUrl: string;
    author: string;
    authorUrl: string;
}

interface WorkflowFull {
    id: string;
    status: string;
    prompt: string;
    sources: SourceItem[] | null;
    outline: Outline | null;
    images: Record<string, ImageSelection> | null;
    renderedUrls: string[] | null;
    templateId: string;
    figmaFileUrl?: string | null;
    caption?: string | null;
    hashtags?: string | null;
    scheduledAt?: string | null;
    errorMessage?: string | null;
}

export default function CarouselAiPage() {
    const [businesses, setBusinesses] = useState<Business[]>([]);
    const [templates, setTemplates] = useState<CarouselTemplate[]>([]);

  const [businessId, setBusinessId] = useState("");
    const [socialAccountId, setSocialAccountId] = useState("");
    const [templateId, setTemplateId] = useState("");
    const [prompt, setPrompt] = useState("");
    const [tone, setTone] = useState("Informatif");
    const [language, setLanguage] = useState("FR");
    const [sourceTypes, setSourceTypes] = useState("Encyclopedie,Actualites");
    const [maxAgeMonths, setMaxAgeMonths] = useState(24);
    const [excludeDomains, setExcludeDomains] = useState("reddit.com");

  const [workflowId, setWorkflowId] = useState("");
    const [workflow, setWorkflow] = useState<WorkflowFull | null>(null);

  const [sources, setSources] = useState<SourceItem[]>([]);
    const [outline, setOutline] = useState<Outline | null>(null);
    const [images, setImages] = useState<Record<string, ImageSelection>>({});
    const [unsplashResults, setUnsplashResults] = useState<Record<number, UnsplashPhoto[]>>({});
    const [imageQueries, setImageQueries] = useState<Record<number, string>>({});

  const [captionInput, setCaptionInput] = useState("");
    const [hashtagsInput, setHashtagsInput] = useState("");
    const [scheduledAtInput, setScheduledAtInput] = useState("");

  const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

  useEffect(() => {
        fetch("/api/businesses").then((r) => r.json()).then(setBusinesses);
        fetch("/api/carousel-templates").then((r) => r.json()).then(setTemplates);
  }, []);

  const business = businesses.find((b) => b.id === businessId);
    const template = templates.find((t) => t.id === templateId);

  async function loadWorkflow(id: string) {
        const res = await fetch(`/api/workflow/${id}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Erreur");
        const wf: WorkflowFull = data.workflow;
        setWorkflow(wf);
        if (wf.sources) setSources(wf.sources);
        if (wf.outline) setOutline(wf.outline);
        if (wf.images) setImages(wf.images);
        if (wf.caption) setCaptionInput(wf.caption);
        if (wf.hashtags) setHashtagsInput(wf.hashtags);
        return wf;
  }

  async function generate() {
        setBusy(true);
        setError("");
        try {
                if (!template) throw new Error("Choisis un template");
                const config = {
                          tone,
                          language,
                          sourceTypes: sourceTypes.split(",").map((s) => s.trim()).filter(Boolean),
                          maxAgeMonths,
                          excludeDomains: excludeDomains.split(",").map((s) => s.trim()).filter(Boolean),
                };
                const res = await fetch("/api/workflow/generate", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ businessId, templateId, socialAccountId: socialAccountId || null, prompt, config }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                setWorkflowId(data.id);
                await loadWorkflow(data.id);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  async function refresh() {
        if (!workflowId) return;
        setBusy(true);
        setError("");
        try {
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  function updateSource(i: number, patch: Partial<SourceItem>) {
        setSources((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  }

  function removeSource(i: number) {
        setSources((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function approveSources() {
        setBusy(true);
        setError("");
        try {
                const res = await fetch(`/api/workflow/${workflowId}/approve-sources`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ sources }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  function updateOutlineSlot(slideIndex: number, slotName: string, value: string) {
        setOutline((prev) => {
                if (!prev) return prev;
                return {
                          slides: prev.slides.map((s) =>
                                      s.index === slideIndex ? { ...s, slots: { ...s.slots, [slotName]: value } } : s
                                                          ),
                };
        });
  }

  async function approveOutline() {
        setBusy(true);
        setError("");
        try {
                const res = await fetch(`/api/workflow/${workflowId}/approve-outline`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ outline }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  async function searchImages(slideIndex: number) {
        setBusy(true);
        setError("");
        try {
                const query = imageQueries[slideIndex] || prompt;
                const res = await fetch(`/api/workflow/${workflowId}/images-search?query=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                setUnsplashResults((prev) => ({ ...prev, [slideIndex]: data.photos }));
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  function selectPhoto(slideIndex: number, photo: UnsplashPhoto) {
        setImages((prev) => ({
                ...prev,
                [String(slideIndex)]: { imageUrl: photo.url, imageCredit: `Photo by ${photo.author} on Unsplash` },
        }));
  }

  function setManualImageUrl(slideIndex: number, url: string) {
        setImages((prev) => ({ ...prev, [String(slideIndex)]: { imageUrl: url, imageCredit: "" } }));
  }

  async function approveImages() {
        setBusy(true);
        setError("");
        try {
                const res = await fetch(`/api/workflow/${workflowId}/approve-images`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ images }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  async function triggerRender() {
        setBusy(true);
        setError("");
        try {
                const res = await fetch(`/api/workflow/${workflowId}/render`, { method: "POST" });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  async function approvePublish() {
        setBusy(true);
        setError("");
        try {
                const res = await fetch(`/api/workflow/${workflowId}/approve-publish`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                                      caption: captionInput,
                                      hashtags: hashtagsInput,
                                      scheduledAt: scheduledAtInput ? new Date(scheduledAtInput).toISOString() : undefined,
                          }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || "Erreur");
                await loadWorkflow(workflowId);
        } catch (err) {
                setError(err instanceof Error ? err.message : "Erreur");
        } finally {
                setBusy(false);
        }
  }

  return (
        <div className="p-8 max-w-3xl mx-auto space-y-10">
              <h1 className="text-2xl font-semibold text-[#1c1a17]">Carrousel IA</h1>
        
          {error && <div className="text-sm text-red-600">{error}</div>}
        
          {!workflow && (
                  <section className="space-y-3">
                            <h2 className="font-medium text-[#1c1a17]">1. Business et template</h2>
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
                  
                            <h2 className="font-medium text-[#1c1a17] pt-4">2. Consigne et configuration</h2>
                            <textarea
                                          className="border rounded px-3 py-2 w-full h-24"
                                          placeholder="Ex: Fais un carrousel sur l'eruption du Vesuve"
                                          value={prompt}
                                          onChange={(e) => setPrompt(e.target.value)}
                                        />
                            <div className="grid grid-cols-2 gap-3">
                                        <select className="border rounded px-3 py-2 w-full" value={tone} onChange={(e) => setTone(e.target.value)}>
                                                      <option value="Educatif">Educatif</option>
                                                      <option value="Inspirant">Inspirant</option>
                                                      <option value="Informatif">Informatif</option>
                                        </select>
                                        <select className="border rounded px-3 py-2 w-full" value={language} onChange={(e) => setLanguage(e.target.value)}>
                                                      <option value="FR">Francais</option>
                                                      <option value="EN">Anglais</option>
                                        </select>
                            </div>
                            <input
                                          className="border rounded px-3 py-2 w-full"
                                          placeholder="Types de sources (separes par une virgule)"
                                          value={sourceTypes}
                                          onChange={(e) => setSourceTypes(e.target.value)}
                                        />
                            <div className="grid grid-cols-2 gap-3">
                                        <input
                                                        type="number"
                                                        className="border rounded px-3 py-2 w-full"
                                                        placeholder="Age max des sources (mois)"
                                                        value={maxAgeMonths}
                                                        onChange={(e) => setMaxAgeMonths(Number(e.target.value))}
                                                      />
                                        <input
                                                        className="border rounded px-3 py-2 w-full"
                                                        placeholder="Domaines a exclure"
                                                        value={excludeDomains}
                                                        onChange={(e) => setExcludeDomains(e.target.value)}
                                                      />
                            </div>
                            <button
                                          disabled={busy || !businessId || !templateId || !prompt}
                                          onClick={generate}
                                          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
                                        >
                                        Lancer la generation
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "SCRAPING" && (
                  <section className="space-y-3 border-t pt-6">
                            <p className="text-sm text-[#857f74]">Recherche des sources en cours...</p>
                            <button onClick={refresh} disabled={busy} className="border rounded px-3 py-2">
                                        Rafraichir
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "AWAITING_SOURCES" && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Validation des sources</h2>
                    {sources.map((s, i) => (
                                <div key={i} className="border rounded p-3 space-y-1">
                                              <div className="flex justify-between items-start gap-2">
                                                              <input
                                                                                  className="border rounded px-2 py-1 w-full font-medium"
                                                                                  value={s.title}
                                                                                  onChange={(e) => updateSource(i, { title: e.target.value })}
                                                                                />
                                                              <button onClick={() => removeSource(i)} className="text-xs border rounded px-2 py-1">
                                                                                Supprimer
                                                              </button>
                                              </div>
                                              <p className="text-xs text-[#857f74]">{s.domain} - {s.date || "date inconnue"} - score {s.score}</p>
                                              <textarea
                                                                className="border rounded px-2 py-1 w-full text-sm h-16"
                                                                value={s.summary}
                                                                onChange={(e) => updateSource(i, { summary: e.target.value })}
                                                              />
                                </div>
                              ))}
                            <button
                                          disabled={busy || sources.length === 0}
                                          onClick={approveSources}
                                          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
                                        >
                                        Valider les sources
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "STRUCTURING" && (
                  <section className="space-y-3 border-t pt-6">
                            <p className="text-sm text-[#857f74]">Structuration du carrousel en cours...</p>
                            <button onClick={refresh} disabled={busy} className="border rounded px-3 py-2">
                                        Rafraichir
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "AWAITING_OUTLINE" && outline && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Validation du plan de slides</h2>
                    {outline.slides.map((slide) => (
                                <div key={slide.index} className="border rounded p-3 space-y-2">
                                              <p className="text-xs text-[#857f74]">Slide {slide.index + 1} - {slide.type || ""}</p>
                                  {Object.entries(slide.slots).map(([name, value]) => (
                                                  <div key={name} className="space-y-1">
                                                                    <p className="text-xs text-[#857f74]">{name}</p>
                                                                    <textarea
                                                                                          className="border rounded px-2 py-1 w-full text-sm"
                                                                                          value={value}
                                                                                          onChange={(e) => updateOutlineSlot(slide.index, name, e.target.value)}
                                                                                        />
                                                  </div>
                                                ))}
                                </div>
                              ))}
                            <button
                                          disabled={busy}
                                          onClick={approveOutline}
                                          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
                                        >
                                        Valider le plan
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "AWAITING_IMAGES" && template && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Selection des images</h2>
                    {template.slides.map((s) => {
                                const defs: SlotDef[] = JSON.parse(s.slots || "[]");
                                if (!defs.some((d) => d.kind === "image")) return null;
                                const selected = images[String(s.index)];
                                return (
                                                <div key={s.id} className="border rounded p-3 space-y-2">
                                                                <p className="text-xs text-[#857f74]">{s.figmaFrameName}</p>
                                                                <div className="flex gap-2">
                                                                                  <input
                                                                                                        className="border rounded px-2 py-1 w-full text-sm"
                                                                                                        placeholder="Recherche Unsplash"
                                                                                                        value={imageQueries[s.index] || ""}
                                                                                                        onChange={(e) => setImageQueries((prev) => ({ ...prev, [s.index]: e.target.value }))}
                                                                                                      />
                                                                                  <button onClick={() => searchImages(s.index)} disabled={busy} className="border rounded px-3 py-1 text-sm">
                                                                                                      Rechercher
                                                                                    </button>
                                                                </div>
                                                                <div className="flex gap-2 flex-wrap">
                                                                  {(unsplashResults[s.index] || []).map((p) => (
                                                                      <img
                                                                                              key={p.id}
                                                                                              src={p.thumbUrl}
                                                                                              onClick={() => selectPhoto(s.index, p)}
                                                                                              className={`w-20 h-20 object-cover rounded cursor-pointer border-2 ${selected?.imageUrl === p.url ? "border-[#1c1a17]" : "border-transparent"}`}
                                                                                            />
                                                                    ))}
                                                                </div>
                                                                <input
                                                                                    className="border rounded px-2 py-1 w-full text-sm"
                                                                                    placeholder="Ou colle une URL d'image"
                                                                                    value={selected?.imageUrl || ""}
                                                                                    onChange={(e) => setManualImageUrl(s.index, e.target.value)}
                                                                                  />
                                                  {selected?.imageCredit && <p className="text-xs text-[#857f74]">{selected.imageCredit}</p>}
                                                </div>
                                              );
                  })}
                            <button
                                          disabled={busy}
                                          onClick={approveImages}
                                          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
                                        >
                                        Valider les images
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "RENDERING" && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Rendu Figma</h2>
                            <p className="text-sm text-[#857f74]">Toutes les etapes IA sont terminees. Lance la duplication du fichier Figma pour continuer.</p>
                            <button disabled={busy} onClick={triggerRender} className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50">
                                        Lancer le rendu Figma
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "AWAITING_FIGMA_EDIT" && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Edition dans Figma</h2>
                            <p className="text-sm text-[#857f74]">
                                        Ouvre le fichier Figma duplique, ajuste les slides si besoin, puis lance le plugin Orbit Atlas Sync pour charger le contenu et valider l&apos;export.
                            </p>
                    {workflow.figmaFileUrl && (
                                <a href={workflow.figmaFileUrl} target="_blank" rel="noreferrer" className="text-sm underline text-[#1c1a17]">
                                              Ouvrir le fichier Figma
                                </a>
                            )}
                            <div>
                                        <button onClick={refresh} disabled={busy} className="border rounded px-3 py-2">
                                                      Rafraichir
                                        </button>
                            </div>
                  </section>
              )}
        
          {workflow && workflow.status === "EXPORTING" && (
                  <section className="space-y-3 border-t pt-6">
                            <p className="text-sm text-[#857f74]">Export des slides en cours...</p>
                            <button onClick={refresh} disabled={busy} className="border rounded px-3 py-2">
                                        Rafraichir
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "AWAITING_PUBLISH" && (
                  <section className="space-y-3 border-t pt-6">
                            <h2 className="font-medium text-[#1c1a17]">Validation finale et programmation</h2>
                            <div className="flex gap-2 flex-wrap">
                              {(workflow.renderedUrls || []).map((url) => (
                                  <img key={url} src={url} className="w-24 h-24 object-cover rounded border" />
                                ))}
                            </div>
                            <textarea
                                          className="border rounded px-3 py-2 w-full h-24"
                                          placeholder="Legende Instagram"
                                          value={captionInput}
                                          onChange={(e) => setCaptionInput(e.target.value)}
                                        />
                            <input
                                          className="border rounded px-3 py-2 w-full"
                                          placeholder="Hashtags (separes par des espaces)"
                                          value={hashtagsInput}
                                          onChange={(e) => setHashtagsInput(e.target.value)}
                                        />
                            <input
                                          type="datetime-local"
                                          className="border rounded px-3 py-2 w-full"
                                          value={scheduledAtInput}
                                          onChange={(e) => setScheduledAtInput(e.target.value)}
                                        />
                            <button
                                          disabled={busy || !scheduledAtInput}
                                          onClick={approvePublish}
                                          className="bg-[#1c1a17] text-white px-4 py-2 rounded disabled:opacity-50"
                                        >
                                        Programmer la publication
                            </button>
                  </section>
              )}
        
          {workflow && workflow.status === "SCHEDULED" && (
                  <section className="space-y-3 border-t pt-6">
                            <p className="text-sm text-[#857f74]">
                                        Publication programmee{workflow.scheduledAt ? ` pour le ${new Date(workflow.scheduledAt).toLocaleString("fr-FR")}` : ""}.
                            </p>
                  </section>
              )}
        
          {workflow && workflow.status === "FAILED" && (
                  <section className="space-y-3 border-t pt-6">
                            <p className="text-sm text-red-600">Echec du workflow: {workflow.errorMessage}</p>
                  </section>
              )}
        </div>
      );
}
