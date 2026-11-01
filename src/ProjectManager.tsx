import { useRef, useState } from "react";
import {
  X,
  Plus,
  FolderOpen,
  Copy,
  Trash2,
  Combine,
  Download,
  Upload,
  Search,
  Check,
  Folder,
  Clock3,
} from "lucide-react";
import {
  type Library,
  type Project,
  makeProject,
  mergeProjects,
  removeProject,
  cloneBoard,
} from "./library";

import { importPayload } from "./media";
import { transitions, type Transition, uid } from "./model";
import { transitionLabels } from "./AnimationControls";
import { ModalDialog } from "./ModalDialog";
import "./projects-dialog.css";
type Props = {
  library: Library;
  onChange(value: Library): void;
  onClose(): void;
  onSave(): Promise<void>;
  onBackup(): void;
  onOpen(id: string): void;
  notify(message: string): void;
  onVersions(id: string): void;
};
export function ProjectManager({
  library,
  onChange,
  onClose,
  onSave,
  onBackup,
  onOpen,
  notify,
  onVersions,
}: Props) {
  const [query, setQuery] = useState(""),
    [name, setName] = useState(""),
    [template, setTemplate] = useState(false);
  const [selected, setSelected] = useState<string[]>([]),
    [mergeName, setMergeName] = useState("Projeto mesclado");
  const [deleting, setDeleting] = useState<Project | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const projects = library.projects.filter((p) =>
    p.board.title
      .toLocaleLowerCase("pt-BR")
      .includes(query.trim().toLocaleLowerCase("pt-BR")),
  );
  const allVisibleSelected = projects.length > 0 && projects.every((p) => selected.includes(p.id));
  const add = () => {
    const p = makeProject(name || "Novo projeto", template);
    onChange({
      ...library,
      activeId: p.id,
      projects: [...library.projects, p],
    });
    setName("");
    notify("Projeto criado");
    onClose();
  };
  const merge = () => {
    try {
      onChange(mergeProjects(library, selected, mergeName));
      setSelected([]);
      notify("Projeto mesclado criado. Os originais foram mantidos.");
      onClose();
    } catch (e) {
      notify((e as Error).message);
    }
  };
  const duplicate = (p: Project) => {
    const n = makeProject(p.board.title + " — cópia");
    n.board = cloneBoard(p.board);
    n.board.title += " — cópia";
    n.styles = p.styles?.map((style) => ({ ...style, id: uid() }));
    onChange({ ...library, projects: [...library.projects, n] });
    notify("Cópia criada");
  };
  return (
    <ModalDialog className="projects-dialog" label="Biblioteca de projetos" onClose={onClose}>
      <section className="projects-modal">
        <div className="projects-heading">
          <div>
            <span className="projects-kicker">
              <FolderOpen size={15} />
              SEU ESPAÇO DE TRABALHO
            </span>
            <h2>
              Meus projetos<span>{library.projects.length}</span>
            </h2>
            <p>Uma biblioteca para todas as suas ideias.</p>
          </div>
          <button
            className="icon-button"
            title="Fechar projetos"
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <div className="projects-body">
          <div className="projects-main">
            <div className="projects-search">
              <Search size={16} />
              <input
                autoFocus
                aria-label="Pesquisar projetos"
                placeholder="Pesquisar projetos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <button
                disabled={!projects.length}
                onClick={() =>
                  setSelected((current) => allVisibleSelected
                    ? current.filter((id) => !projects.some((p) => p.id === id))
                    : [...new Set([...current, ...projects.map((p) => p.id)])])
                }
              >
                {allVisibleSelected ? "Desmarcar visíveis" : "Selecionar todos"}
              </button>
            </div>
            <p className="projects-result-count" role="status">
              {projects.length} {projects.length === 1 ? "projeto" : "projetos"}{query.trim() ? " encontrados" : " na biblioteca"}
              {selected.length > 0 && ` · ${selected.length} selecionado${selected.length === 1 ? "" : "s"}`}
            </p>
            <div className="project-list">
              {projects.map((p) => (
                <article
                  className={`project-row ${p.id === library.activeId ? "current" : ""} ${selected.includes(p.id) ? "selected" : ""}`}
                  data-project={p.id}
                  key={p.id}
                >
                  <input
                    type="checkbox"
                    aria-label={`Selecionar ${p.board.title}`}
                    checked={selected.includes(p.id)}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, p.id]
                          : selected.filter((id) => id !== p.id),
                      )
                    }
                  />
                  <button
                    className="project-open"
                    onClick={() => {
                      onOpen(p.id);
                      onClose();
                    }}
                  >
                    <span className="project-symbol">
                      <FolderOpen size={22} />
                    </span>
                    <span>
                      <strong>{p.board.title || "Projeto sem título"}</strong>
                      <small>
                        {p.board.scenes.length}{" "}
                        {p.board.scenes.length === 1 ? "seção" : "seções"} ·{" "}
                        {p.board.scenes.reduce((n, s) => n + s.items.length, 0)}{" "}
                        elementos ·{" "}
                        {new Date(p.updatedAt).toLocaleDateString("pt-BR")}
                        {p.id === library.activeId && (
                          <em>
                            <Check size={10} />
                            Em edição
                          </em>
                        )}
                      </small>
                    </span>
                  </button>
                  <button
                    className="icon-button"
                    title={`Histórico de versões de ${p.board.title}`}
                    aria-label={`Histórico de versões de ${p.board.title}`}
                    onClick={() => onVersions(p.id)}
                  >
                    <Clock3 size={15} />
                  </button>
                  <button
                    className="icon-button"
                    title={`Duplicar ${p.board.title}`}
                    onClick={() => duplicate(p)}
                  >
                    <Copy size={15} />
                  </button>
                  <button
                    className="icon-button delete-project"
                    title={`Excluir ${p.board.title}`}
                    onClick={() => setDeleting(p)}
                  >
                    <Trash2 size={15} />
                  </button>
                </article>
              ))}
              {!projects.length && (
                <div className="projects-empty">
                  <Search size={26} />
                  <p>{query.trim() ? "Nenhum projeto encontrado para esta busca." : "Sua biblioteca ainda não tem projetos."}</p>
                  {query.trim() && <button onClick={() => setQuery("")}>Limpar busca</button>}
                </div>
              )}
            </div>
            {selected.length >= 2 ? <div className="merge-box">
              <div>
                <Combine size={18} />
                <span>
                  <strong>Conecte suas ideias</strong>
                  <small>
                    Mescle seções em um novo projeto. Os originais ficam
                    guardados.
                  </small>
                </span>
              </div>
              <div className="merge-actions">
                <input
                  aria-label="Nome do projeto mesclado"
                  value={mergeName}
                  onChange={(e) => setMergeName(e.target.value)}
                />
                <button disabled={selected.length < 2} onClick={merge}>
                  <Combine size={15} />
                  Mesclar {selected.length > 0 ? `(${selected.length})` : ""}
                </button>
              </div>
            </div> : <p className="projects-selection-help">Selecione dois ou mais projetos para mesclar suas seções.</p>}
          </div>
          <div className="projects-create">
            <span className="projects-kicker">UM NOVO COMEÇO</span>
            <h3>Criar projeto</h3>
            <label>
              Nome do projeto
              <input
                aria-label="Nome do novo projeto"
                placeholder="Ex.: Arquitetura de agentes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") add();
                }}
              />
            </label>
            <label className="template-check">
              <input
                type="checkbox"
                checked={template}
                onChange={(e) => setTemplate(e.target.checked)}
              />
              Usar exemplo de orquestração
            </label>
            <button className="create-project-button" onClick={add}>
              <Plus size={16} />
              Criar projeto
            </button>
            <details className="project-options">
              <summary>Configurações da biblioteca</summary>
            <div className="project-transition">
              <label>
                Transição entre projetos
                <select
                  aria-label="Transição entre projetos"
                  value={library.settings?.projectTransition || "zoom"}
                  onChange={(e) =>
                    onChange({
                      ...library,
                      settings: {
                        ...library.settings,
                        projectTransition: e.target.value as Transition,
                      },
                    })
                  }
                >
                  {transitions.map((t) => (
                    <option value={t} key={t}>
                      {transitionLabels[t]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Duração{" "}
                <span>
                  {((library.settings?.transitionMs || 600) / 1000).toFixed(1)}s
                </span>
                <input
                  aria-label="Duração entre projetos"
                  type="range"
                  min="100"
                  max="2000"
                  step="100"
                  value={library.settings?.transitionMs || 600}
                  onChange={(e) =>
                    onChange({
                      ...library,
                      settings: {
                        ...library.settings,
                        transitionMs: +e.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>
            <div className="project-storage">
              <Folder size={19} />
              <strong>
                {window.orquestraDesktop
                  ? "Salvo no seu computador"
                  : "Salvo neste navegador"}
              </strong>
              <p>
                Salvamento automático. Exporte um backup para transportar sua
                biblioteca.
              </p>
              {window.orquestraDesktop && (
                <button onClick={() => window.orquestraDesktop?.dataFolder()}>
                  Abrir pasta de dados <FolderOpen size={12} />
                </button>
              )}
            </div>
            </details>
          </div>
        </div>
        <footer className="projects-footer">
          <button
            onClick={() => {
              void onSave().catch(() => {});
            }}
          >
            <Check size={15} />
            Salvar agora
          </button>
          <div>
            <button onClick={onBackup}>
              <Download size={15} />
              Backup da biblioteca
            </button>
            <button onClick={() => file.current?.click()}>
              <Upload size={15} />
              Importar projetos
            </button>
          </div>
        </footer>
        <input
          type="file"
          ref={file}
          accept=".json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (!f) return;
            try {
              onChange(
                await importPayload(library, JSON.parse(await f.text())),
              );
              notify("Projetos importados. Os existentes foram mantidos.");
              onClose();
            } catch {
              notify("Arquivo inválido. Use um projeto ou backup Orquestra.");
            }
            if (file.current) file.current.value = "";
          }}
        />
        {deleting && (
          <ModalDialog className="project-confirm-dialog" label="Confirmar exclusão" onClose={() => setDeleting(null)}>
            <div className="project-confirm-content" role="alertdialog">
              <Trash2 size={25} />
              <h3>Excluir “{deleting.board.title}”?</h3>
              <p>
                O projeto e suas seções serão removidos da biblioteca. Exporte
                um backup se quiser guardá-los.
              </p>
              <div>
                <button onClick={() => setDeleting(null)}>Cancelar</button>
                <button
                  className="danger"
                  onClick={() => {
                    onChange(removeProject(library, deleting.id));
                    setSelected((s) => s.filter((id) => id !== deleting.id));
                    setDeleting(null);
                    notify("Projeto excluído");
                  }}
                >
                  Excluir projeto
                </button>
              </div>
            </div>
          </ModalDialog>
        )}
      </section>
    </ModalDialog>
  );
}
