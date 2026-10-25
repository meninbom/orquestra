import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  ExternalLink,
  Info,
  Link2,
  Maximize2,
  Minimize2,
  Play,
  ShieldCheck,
  X,
} from "lucide-react";
import { normalizePreviewLink, type LinkPreviewTarget } from "./linkPreview";
import "./link-preview.css";

export type LinkPreviewProps = {
  /** Original board URL. It is validated for display and preserved for opening. */
  url: string;
  title?: string;
  onClose: () => void;
  /** Pass the existing safe opener (for example, `openLink` from `media.ts`). */
  onOpenExternal: (originalUrl: string) => void | Promise<void>;
};

const webIframeSandbox = "allow-scripts allow-forms";
const youtubeIframeSandbox =
  "allow-scripts allow-forms allow-same-origin allow-presentation";
const youtubeIframeAllow =
  "accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Não foi possível validar este link.";
}

function resolvePreview(url: string): {
  target: LinkPreviewTarget | null;
  error: string;
} {
  try {
    return { target: normalizePreviewLink(url), error: "" };
  } catch (error) {
    return { target: null, error: errorMessage(error) };
  }
}

export function LinkPreview({
  url,
  title,
  onClose,
  onOpenExternal,
}: LinkPreviewProps) {
  const [preview, setPreview] = useState(() => resolvePreview(url));
  const { target, error: validationError } = preview;
  const [externalError, setExternalError] = useState("");
  const [youtubeActivated, setYoutubeActivated] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const titleId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const expandRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  const previousFocus = useRef<HTMLElement | null>(null);
  const fullscreenRef = useRef(false);
  const expandedRef = useRef(expanded);
  expandedRef.current = expanded;

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    setPreview(resolvePreview(url));
    setExternalError("");
    setYoutubeActivated(false);
    setExpanded(false);
  }, [url]);

  useEffect(() => {
    const dialog = dialogRef.current;
    const onFullscreenChange = () => {
      const active = document.fullscreenElement === dialog;
      const wasActive = fullscreenRef.current;
      fullscreenRef.current = active;
      setFullscreen(active);
      if (wasActive && !active) {
        requestAnimationFrame(() => expandRef.current?.focus());
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      if (dialog && document.fullscreenElement === dialog) {
        void document.exitFullscreen?.().catch(() => {});
      }
    };
  }, []);

  const toggleExpanded = async () => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (document.fullscreenElement === dialog) {
      try {
        await document.exitFullscreen();
      } catch {
        setExpanded(true);
      }
      return;
    }

    if (expanded) {
      setExpanded(false);
      return;
    }

    // Some embedded Chromium builds leave a denied fullscreen request pending.
    // Expand immediately so the control remains useful while that request settles.
    setExpanded(true);
    try {
      if (!dialog.requestFullscreen) throw new Error("Fullscreen indisponível");
      await dialog.requestFullscreen();
      if (dialog.isConnected && document.fullscreenElement === dialog) setExpanded(false);
    } catch {
      if (dialog.isConnected) setExpanded(true);
    }
  };

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    previousFocus.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      // The app's window key handler edits board content. Keep modal key events
      // inside this document even if focus lands on the backdrop or body. Events
      // from the cross-origin iframe do not bubble to this document; browser
      // defaults for controls and Tab stay intact.
      event.stopPropagation();

      if (event.key === "Escape") {
        event.preventDefault();
        if (dialogRef.current && document.fullscreenElement === dialogRef.current) {
          void document.exitFullscreen().catch(() => setExpanded(true));
          return;
        }
        if (expandedRef.current) {
          setExpanded(false);
          requestAnimationFrame(() => expandRef.current?.focus());
          return;
        }
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), iframe, a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = previousOverflow;
      try {
        previousFocus.current?.focus({ preventScroll: true });
      } catch {
        previousFocus.current?.focus();
      }
    };
  }, []);

  const openOriginal = async () => {
    if (!target) return;
    setExternalError("");
    try {
      await onOpenExternal(target.originalUrl);
    } catch (error) {
      setExternalError(errorMessage(error));
    }
  };

  const pageTitle = title?.trim() || (target && new URL(target.originalUrl).hostname) || "Prévia do link";
  const targetIsYoutube = target?.kind === "youtube";
  const showYoutubePlayer = targetIsYoutube && youtubeActivated;
  const isExpanded = expanded || fullscreen;

  return createPortal(
    <div
      className={`link-preview-backdrop${expanded ? " is-expanded" : ""}`}
      onPointerDown={(event) => event.stopPropagation()}
    >
      <section
        ref={dialogRef}
        className="link-preview-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onPointerDown={(event) => event.stopPropagation()}
      >
        <header className="link-preview-header">
          <div className="link-preview-heading">
            <span className="link-preview-mark" aria-hidden="true">
              {target ? <ShieldCheck size={17} /> : <Link2 size={17} />}
            </span>
            <div className="link-preview-heading-copy">
              <h2 id={titleId}>{pageTitle}</h2>
              <span className="link-preview-host">
                {target ? new URL(target.originalUrl).host : "Link recusado"}
              </span>
            </div>
          </div>
          <div className="link-preview-actions">
            <button
              className="link-preview-open"
              type="button"
              onClick={() => void openOriginal()}
              disabled={!target}
            >
              <ExternalLink size={15} />
              <span>Abrir no navegador</span>
            </button>
            <button
              ref={expandRef}
              className="link-preview-expand"
              type="button"
              aria-label={isExpanded ? "Sair da tela cheia" : "Ampliar prévia"}
              aria-pressed={isExpanded}
              title={isExpanded ? "Sair da tela cheia" : "Ampliar prévia"}
              onClick={() => void toggleExpanded()}
            >
              {isExpanded ? <Minimize2 size={17} /> : <Maximize2 size={17} />}
            </button>
            <button
              ref={closeRef}
              className="link-preview-close"
              type="button"
              aria-label="Fechar prévia"
              title="Fechar (Esc)"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          </div>
        </header>

        <main className={`link-preview-content ${targetIsYoutube ? "is-youtube" : "is-web"}`}>
          {!target ? (
            <div className="link-preview-invalid" role="alert">
              <ShieldCheck size={30} />
              <strong>Este link não pode ser pré-visualizado.</strong>
              <span>{validationError}</span>
            </div>
          ) : targetIsYoutube ? (
            showYoutubePlayer ? (
              <iframe
                key={target.iframeUrl}
                className="link-preview-youtube-player"
                src={target.iframeUrl}
                title={`Player do YouTube: ${pageTitle}`}
                sandbox={youtubeIframeSandbox}
                allow={youtubeIframeAllow}
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <div className="link-preview-youtube-prompt">
                <div className="link-preview-play-orb" aria-hidden="true">
                  <Play size={27} fill="currentColor" />
                </div>
                <strong>O vídeo só carrega quando você iniciar a reprodução.</strong>
                <span>Isso evita carregar conteúdo de terceiros ao abrir o quadro.</span>
                <button
                  className="link-preview-play"
                  type="button"
                  onClick={() => setYoutubeActivated(true)}
                >
                  <Play size={16} fill="currentColor" />
                  Reproduzir vídeo
                </button>
              </div>
            )
          ) : (
            <iframe
              key={target.iframeUrl}
              className="link-preview-web-frame"
              src={target.iframeUrl}
              title={`Página incorporada: ${pageTitle}`}
              sandbox={webIframeSandbox}
              allow="encrypted-media; fullscreen; picture-in-picture"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
              loading="eager"
            />
          )}
        </main>

        <footer className="link-preview-footer">
          <p className="link-preview-note">
            <Info size={15} />
            <span>
              O quadro funciona offline; prévias de páginas e vídeos precisam de internet.
              {target?.kind === "web" &&
                " Alguns sites bloqueiam incorporação; se a página não aparecer, abra no navegador."}
              {target?.kind === "youtube" &&
                " Se o player não carregar, abra o link original no navegador."}
            </span>
          </p>
          {externalError && (
            <p className="link-preview-error" role="alert">
              {externalError}
            </p>
          )}
        </footer>
      </section>
    </div>,
    document.body,
  );
}
