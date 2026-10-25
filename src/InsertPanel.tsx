import { useEffect, useRef, useState } from "react";
import {
  X,
  Search,
  Shapes,
  ImagePlus,
  Link2,
  Upload,
  Video,
  Music,
  FileText,
  Plus,
} from "lucide-react";
import { iconCatalog } from "./icons";
import { supportedFiles, safeLink } from "./media";
export function InsertPanel({
  initialTab = "icons",
  onIcon,
  onFiles,
  onLink,
  onClose,
  busy,
}: {
  initialTab?: string;
  onIcon(name: string): void;
  onFiles(files: File[]): Promise<void>;
  onLink(url: string, title: string): void;
  onClose(): void;
  busy: boolean;
}) {
  const [tab, setTab] = useState(initialTab),
    [category, setCategory] = useState("Todos"),
    [query, setQuery] = useState(""),
    [url, setUrl] = useState(""),
    [title, setTitle] = useState(""),
    [error, setError] = useState("");
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        if (!busy) onClose();
      }
    };
    window.addEventListener("keydown", key, true);
    return () => window.removeEventListener("keydown", key, true);
  }, [busy, onClose]);
  const normalized = (v: string) =>
    v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const icons = iconCatalog.filter(
    (i) =>
      (category === "Todos" || category === i.category) &&
      normalized(i.label + " " + i.name).includes(normalized(query)),
  );
  return (
    <div
      className="modal-backdrop"
      onClick={() => {
        if (!busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Inserir conteúdo"
        className="insert-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="insert-heading">
          <div>
            <span className="projects-kicker">DÊ FORMA ÀS SUAS IDEIAS</span>
            <h2>Adicionar ao board</h2>
          </div>
          <button
            className="icon-button"
            title="Fechar inserção"
            disabled={busy}
            onClick={onClose}
          >
            <X />
          </button>
        </div>
        <nav className="insert-tabs">
          <button
            className={tab === "icons" ? "active" : ""}
            onClick={() => setTab("icons")}
          >
            <Shapes size={16} />
            Ícones <small>{iconCatalog.length}</small>
          </button>
          <button
            className={tab === "media" ? "active" : ""}
            onClick={() => setTab("media")}
          >
            <ImagePlus size={16} />
            Mídia e arquivos
          </button>
          <button
            className={tab === "link" ? "active" : ""}
            onClick={() => setTab("link")}
          >
            <Link2 size={16} />
            Link
          </button>
        </nav>
        {tab === "icons" ? (
          <>
            <div className="icon-search">
              <Search size={17} />
              <input
                autoFocus
                aria-label="Pesquisar ícones"
                placeholder="Pesquisar: agente, nuvem, banco de dados…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <div className="icon-categories">
              {["Todos", ...new Set(iconCatalog.map((i) => i.category))].map(
                (c) => (
                  <button
                    key={c}
                    className={category === c ? "active" : ""}
                    onClick={() => setCategory(c)}
                  >
                    {c}
                  </button>
                ),
              )}
            </div>
            <div className="icon-grid">
              {icons.map((i) => (
                <button
                  key={i.name}
                  title={i.label}
                  aria-label={`Inserir ícone ${i.label}`}
                  onClick={() => onIcon(i.name)}
                >
                  <i.icon size={29} strokeWidth={1.6} />
                  <span>{i.label}</span>
                </button>
              ))}
              {!icons.length && (
                <p className="icon-empty">Nenhum ícone encontrado.</p>
              )}
            </div>
            <p className="insert-tip">
              Ícones vetoriais: ajuste tamanho, cor e animação no painel Estilo.
            </p>
          </>
        ) : tab === "media" ? (
          <div
            className="media-import-panel"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              if (!busy) void onFiles([...e.dataTransfer.files]);
            }}
          >
            <button
              disabled={busy}
              className="media-dropzone"
              onClick={() => file.current?.click()}
            >
              <Upload size={32} />
              <strong>
                {busy
                  ? "Guardando arquivos…"
                  : "Escolha ou arraste seus arquivos"}
              </strong>
              <span>
                Você também pode soltar no canvas ou colar uma imagem com
                Ctrl+V.
              </span>
              <em>
                <Plus size={14} />
                Selecionar arquivos
              </em>
            </button>
            <div className="media-formats">
              <div>
                <ImagePlus size={20} />
                <strong>Imagens e GIFs</strong>
                <span>PNG, JPG, WebP, GIF, SVG, AVIF</span>
              </div>
              <div>
                <Video size={20} />
                <strong>Vídeos</strong>
                <span>MP4, WebM, OGV, MOV</span>
              </div>
              <div>
                <Music size={20} />
                <strong>Áudio</strong>
                <span>MP3, WAV, OGG, M4A, FLAC</span>
              </div>
              <div>
                <FileText size={20} />
                <strong>Documentos</strong>
                <span>PDF, Office, texto, CSV e ZIP</span>
              </div>
            </div>
            <p className="insert-tip">
              Até 100 MB por arquivo. Imagens, vídeos e áudio ficam disponíveis
              offline. A reprodução depende do codec do arquivo.
            </p>
          </div>
        ) : (
          <div className="insert-link">
            <Link2 size={32} />
            <h3>Conecte uma referência.</h3>
            <p>
              Adicione um site, vídeo do YouTube ou documento online como um
              cartão clicável.
            </p>
            <label>
              Endereço
              <input
                aria-label="Endereço do link"
                placeholder="https://…"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
              />
            </label>
            <label>
              Título do cartão
              <input
                aria-label="Título do link"
                placeholder="Ex.: Vídeo de referência"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            {error && (
              <p role="alert" className="insert-error">
                {error}
              </p>
            )}
            <button
              className="create-project-button"
              onClick={() => {
                try {
                  onLink(safeLink(url), title);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              <Plus size={16} />
              Adicionar link
            </button>
            <p className="insert-tip">
              O cartão abre no navegador. Para reproduzir no board, insira o
              arquivo de vídeo.
            </p>
          </div>
        )}
        <input
          ref={file}
          type="file"
          multiple
          accept={supportedFiles}
          hidden
          onChange={(e) => {
            if (e.target.files && !busy) void onFiles([...e.target.files]);
            e.target.value = "";
          }}
        />
      </section>
    </div>
  );
}
