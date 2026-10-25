import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  AlertCircle,
  Eye,
  Play,
} from "lucide-react";
import { type Item } from "./model";
import { getAsset, openLink, saveAsset } from "./media";
import { normalizePreviewLink } from "./previewLink";
export function BoardMedia({
  item,
  interactive,
  active,
  color,
  onOpenPdf,
  onOpenLink,
  selected = false,
  youtubeActive = false,
  onStartYoutube,
}: {
  item: Item;
  interactive: boolean;
  active: boolean;
  color: string;
  onOpenPdf: (id: string) => void;
  onOpenLink: () => void;
  selected?: boolean;
  youtubeActive?: boolean;
  onStartYoutube?: () => void;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const media = useRef<HTMLMediaElement | null>(null);
  let youtubeTarget: ReturnType<typeof normalizePreviewLink> | null = null;
  if (item.type === "link" && item.url) {
    try {
      const target = normalizePreviewLink(item.url);
      if (target.kind === "youtube") youtubeTarget = target;
    } catch {}
  }
  const isPdf = item.type === "file" &&
    ((item.assetMime || "").toLowerCase().includes("pdf") || item.assetName?.toLowerCase().endsWith(".pdf"));
  useEffect(() => {
    let canceled = false,
      object = "";
    setUrl("");
    setError("");
    if (!item.assetId || isPdf) return;
    getAsset(item.assetId)
      .then((a) => {
        if (canceled) return;
        object = URL.createObjectURL(a.blob);
        setUrl(object);
      })
      .catch((e) => {
        if (!canceled) setError(e.message);
      });
    return () => {
      canceled = true;
      if (object) URL.revokeObjectURL(object);
    };
  }, [item.assetId, isPdf]);
  useEffect(() => {
    const element = media.current;
    if (!element) return;
    if (!active) {
      element.pause();
      return;
    }
    if (item.mediaAutoplay) {
      void element.play().catch(() => {});
    }
  }, [active, item.mediaAutoplay, url]);
  const failed = () =>
    setError(
      "Formato ou codec não reproduzível. Salve o arquivo para abrir em outro player.",
    );
  if (item.type === "image" && !error && url)
    return (
      <image
        data-asset={item.assetId}
        x={item.x}
        y={item.y}
        width={item.w}
        height={item.h}
        href={url}
        preserveAspectRatio={
          item.mediaFit === "cover" ? "xMidYMid slice" : "xMidYMid meet"
        }
        onError={failed}
      />
    );
  if (youtubeTarget?.kind === "youtube")
    return <foreignObject data-media-snapshot="true" data-youtube-item={item.id} x={item.x} y={item.y} width={item.w} height={item.h}>
      <div className={`board-media media-youtube-inline ${selected ? "is-selected" : ""} ${youtubeActive ? "is-playing" : ""}`} data-media-control="true" style={{ width: "100%", height: "100%", color, borderColor: color + "70", pointerEvents: "auto" }}>
        {youtubeActive ? <iframe
          className="youtube-board-player"
          data-youtube-player={item.id}
          src={youtubeTarget.iframeUrl}
          title={`Player do YouTube: ${item.text || "Vídeo"}`}
          sandbox="allow-scripts allow-forms allow-same-origin allow-presentation"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; fullscreen; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        /> : <div className="youtube-board-thumbnail">
          <div className="youtube-board-title"><strong>{item.text || "Vídeo do YouTube"}</strong><span>YouTube · player integrado</span></div>
          <button type="button" aria-label="Reproduzir vídeo no canvas" onPointerDown={(event) => event.stopPropagation()} onClick={onStartYoutube}>
            <Play size={26} fill="currentColor" />
          </button>
          <div className="youtube-board-footer"><span>▶</span><span>Assista no YouTube</span></div>
        </div>}
      </div>
    </foreignObject>;
  return (
    <foreignObject
      data-media-snapshot="true"
      x={item.x}
      y={item.y}
      width={item.w}
      height={item.h}
    >
      <div
        className={`board-media media-${item.type} ${interactive ? "interactive" : ""}`}
        data-media-control="true"
        style={{
          width: "100%",
          height: "100%",
          color,
          borderColor: color + "70",
          pointerEvents: interactive || isPdf || item.type === "link" ? "auto" : "none",
        }}
      >
        {error ? (
          <div className="media-error">
            <AlertCircle size={22} />
            <span>{error}</span>
            <button
              onClick={() => {
                void saveAsset(item.assetId!).catch((e) => setError(e.message));
              }}
            >
              <Download size={13} />
              Salvar arquivo
            </button>
          </div>
        ) : item.type === "video" && url ? (
          <video
            ref={(e) => {
              media.current = e;
            }}
            data-media-video={item.id}
            src={url}
            controls={interactive}
            preload="metadata"
            playsInline
            loop={item.mediaLoop}
            muted={item.mediaMuted !== false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: item.mediaFit || "contain",
            }}
            onLoadedData={() => {
              if (active && item.mediaAutoplay)
                void media.current?.play().catch(() => {});
            }}
            onError={failed}
          />
        ) : item.type === "audio" && url ? (
          <div className="audio-content">
            <span>{item.assetName}</span>
            <audio
              ref={(e) => {
                media.current = e;
              }}
              src={url}
              controls
              preload="metadata"
              loop={item.mediaLoop}
              muted={item.mediaMuted}
              onError={failed}
            />
          </div>
        ) : item.type === "file" ? (
          <div className="attachment-content">
            <FileText size={30} />
            <div>
              <strong>{item.assetName}</strong>
              <small>{isPdf ? "Documento PDF" : "Arquivo anexado"}</small>
              {isPdf && (
                <button aria-label={`Visualizar PDF ${item.assetName}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => onOpenPdf(item.assetId!)}>
                  <Eye size={13} />
                  Visualizar PDF
                </button>
              )}
              <button
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  void saveAsset(item.assetId!).catch((e) =>
                    setError(e.message),
                  );
                }}
              >
                <Download size={13} />
                Salvar arquivo
              </button>
            </div>
          </div>
        ) : item.type === "link" ? (
          <div className="attachment-content">
            <Link2 size={28} />
            <div>
              <strong>{item.text || new URL(item.url!).hostname}</strong>
              <small>{new URL(item.url!).hostname}</small>
              <button onPointerDown={(event) => event.stopPropagation()} onClick={onOpenLink}>
                <Eye size={13} />
                Pré-visualizar
              </button>
              <button
                onPointerDown={(event) => event.stopPropagation()}
                onClick={() => {
                  void openLink(item.url!).catch((e) => setError(e.message));
                }}
              >
                <ExternalLink size={13} />
                Abrir link
              </button>
            </div>
          </div>
        ) : (
          <div className="media-loading">
            <Loader2 className="spin" size={22} />
            <span>Carregando mídia…</span>
          </div>
        )}
        {!interactive &&
          ["video", "audio", "file"].includes(item.type) && !isPdf && (
            <div className="media-interact-hint">
              Duplo clique para interagir
            </div>
          )}
      </div>
    </foreignObject>
  );
}
