import { type Project, validLibrary } from "./library";

export type VersionSource = "manual" | "automatic" | "restore-safety";
export type ProjectVersion = {
  id: string;
  projectId: string;
  createdAt: string;
  source: VersionSource;
  name: string;
  project: Project;
};
export type VersionLimits = { maxPerProject: number; maxBytes: number };
export const VERSION_LIMITS: VersionLimits = { maxPerProject: 30, maxBytes: 100 * 1024 * 1024 };

export function validProjectVersion(value: unknown): value is ProjectVersion {
  const v = value as ProjectVersion;
  if (!v || typeof v !== "object" || typeof v.id !== "string" || typeof v.projectId !== "string" ||
      !Number.isFinite(Date.parse(v.createdAt)) || !["manual", "automatic", "restore-safety"].includes(v.source) ||
      typeof v.name !== "string" || v.name.length > 120 || !v.project || v.project.id !== v.projectId) return false;
  return validLibrary({ format: "orquestra-library", version: 1, activeId: v.project.id, projects: [v.project] });
}

export function versionBytes(version: ProjectVersion): number {
  return new TextEncoder().encode(JSON.stringify(version)).byteLength;
}

/** Persist the candidate first; only then delete the returned old IDs. */
export function versionsToPrune(
  existing: ProjectVersion[],
  candidate: ProjectVersion,
  limits: VersionLimits = VERSION_LIMITS,
): string[] {
  if (!validProjectVersion(candidate)) throw new Error("A versão do projeto é inválida.");
  const size = versionBytes(candidate);
  if (size > limits.maxBytes) throw new Error("Uma versão ultrapassa o limite de 100 MiB.");
  const all = [...existing.filter((version) => version.id !== candidate.id), candidate]
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const removed = new Set<string>();
  const projectVersions = all.filter((version) => version.projectId === candidate.projectId);
  while (projectVersions.length - [...removed].filter((id) => projectVersions.some((v) => v.id === id)).length > limits.maxPerProject) {
    const oldest = projectVersions.find((version) => version.id !== candidate.id && !removed.has(version.id));
    if (!oldest) break;
    removed.add(oldest.id);
  }
  const activeBytes = () => all.filter((version) => !removed.has(version.id)).reduce((sum, version) => sum + versionBytes(version), 0);
  while (activeBytes() > limits.maxBytes) {
    const oldest = all.find((version) => version.id !== candidate.id && !removed.has(version.id));
    if (!oldest) throw new Error("Não há espaço para salvar a nova versão sem ultrapassar o limite global.");
    removed.add(oldest.id);
  }
  return [...removed];
}

export function makeProjectVersion(project: Project, source: VersionSource, name: string): ProjectVersion {
  const cleanName = name.trim().slice(0, 120);
  if (!cleanName) throw new Error("Informe um nome para a versão.");
  return {
    id: crypto.randomUUID(), projectId: project.id, createdAt: new Date().toISOString(),
    source, name: cleanName, project: structuredClone(project),
  };
}
