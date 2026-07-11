// Helper to duplicate a Figma template file via the Figma REST API.
// Used by Node 8 (render) of the AI carousel workflow.
// Requires the FIGMA_ACCESS_TOKEN environment variable (a personal access token).

const FIGMA_API_BASE = "https://api.figma.com/v1";

export interface DuplicatedFigmaFile {
    fileKey: string;
    fileUrl: string;
}

export async function duplicateFigmaFile(sourceFileKey: string, name: string): Promise<DuplicatedFigmaFile> {
    const token = process.env.FIGMA_ACCESS_TOKEN;
    if (!token) {
          throw new Error("FIGMA_ACCESS_TOKEN is not configured");
    }

  const res = await fetch(`${FIGMA_API_BASE}/files/${sourceFileKey}/duplicate`, {
        method: "POST",
        headers: {
                "X-Figma-Token": token,
                "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
  });

  if (!res.ok) {
        const text = await res.text();
        throw new Error(`Figma duplicate failed (status ${res.status}): ${text}`);
  }

  const data = await res.json();
    const fileKey: string | undefined = data.key ?? data.file_key ?? data.id;
    if (!fileKey) {
          throw new Error("Figma duplicate response did not include a file key");
    }

  return { fileKey, fileUrl: `https://www.figma.com/file/${fileKey}` };
}
