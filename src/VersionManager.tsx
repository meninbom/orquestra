import { useEffect, useState } from "react";
import { Clock3, RotateCcw, Save, X } from "lucide-react";
import { type Project } from "./library";
import { type ProjectVersion } from "./versions";
import { listProjectVersions, versionStorageSummary } from "./versionStorage";

type Props = {
  project: Project;
  onClose(): void;
  onCreate(name: string): Promise<unknown>;
  onRestore(version: ProjectVersion): Promise<void>;
};

const sourceName: Record<ProjectVersion["source"], string> = {
  manual: "Manual",
  automatic: "Automática",
  "restore-safety": "Segurança antes da restauração",
};
const formatMiB = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MiB`;

export function VersionManager({ project, onClose, onCreate, onRestore }: Props) {
  const [versions, setVersions] = useState<ProjectVersion[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [restoreVersion, setRestoreVersion] = useState<ProjectVersion | null>(null);
  const reload = async () => {
    setLoading(true);
    try {
      setVersions(await listProjectVersions(project.id));
      setError("");
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void reload(); }, [project.id]);
  const summary = versionStorageSummary(versions);
  return (
    <div className="modal-backdrop version-backdrop" onClick={onClose}>
      <section
        className="version-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Histórico de versões do projeto"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="version-heading">
          <div>
            <span className="projects-kicker"><Clock3 size={14} /> HISTÓRICO DO PROJETO</span>
            <h2>{project.board.title}</h2>
            <p>Versões guardam o conteúdo do projeto e suas mídias continuam no armazenamento local.</p>
          </div>
          <button className="icon-button" aria-label="Fechar histórico" onClick={onClose}><X /></button>
        </header>
        <form className="version-create" onSubmit={async (event) => {
          event.preventDefault();
          if (!name.trim() || busy) return;
          setBusy(true);
          try { await onCreate(name); setName(""); await reload(); }
          catch (cause) { setError((cause as Error).message); }
          finally { setBusy(false); }
        }}>
          <input aria-label="Nome da versão" maxLength={120} placeholder="Ex.: Antes da revisão" value={name} onChange={(event) => setName(event.target.value)} />
          <button disabled={!name.trim() || busy}><Save size={15} /> Salvar versão</button>
        </form>
        <div className="version-limits">Retenção: até {summary.maxPerProject} versões por projeto e {formatMiB(summary.maxBytes)} no dispositivo. Neste projeto: {summary.count} versão(s) · {formatMiB(summary.bytes)}. Snapshots não duplicam arquivos de mídia.</div>
        {error && <p role="alert" className="version-error">{error}</p>}
        <div className="version-list" aria-live="polite">
          {loading ? <p>Carregando versões…</p> : versions.map((version) => (
            <article className="version-row" key={version.id}>
              <div>
                <strong>{version.name}</strong>
                <small>{sourceName[version.source]} · {new Date(version.createdAt).toLocaleString("pt-BR")}</small>
              </div>
              <button disabled={busy} onClick={() => setRestoreVersion(version)}>
                <RotateCcw size={14} /> Restaurar
              </button>
            </article>
          ))}
          {!loading && !versions.length && !error && <p>Nenhuma versão salva ainda.</p>}
        </div>
        <footer className="version-footer"><span>Versões automáticas são registradas quando há mudanças e pelo menos 5 minutos desde a última versão.</span><button onClick={onClose}>Fechar</button></footer>
        {restoreVersion && (
          <div className="version-confirm-backdrop">
            <section className="version-confirm" role="alertdialog" aria-modal="true" aria-label="Confirmar restauração">
              <h3>Restaurar versão?</h3>
              <p>Restaurar “{restoreVersion.name}”? A versão atual será guardada antes da troca.</p>
              <footer>
                <button disabled={busy} onClick={() => setRestoreVersion(null)}>Cancelar</button>
                <button className="danger-action" disabled={busy} onClick={async () => {
                setBusy(true);
                try { await onRestore(restoreVersion); onClose(); }
                catch (cause) { setError((cause as Error).message); }
                finally { setBusy(false); setRestoreVersion(null); }
                }}>Restaurar versão</button>
              </footer>
            </section>
          </div>
        )}
      </section>
    </div>
  );
}
