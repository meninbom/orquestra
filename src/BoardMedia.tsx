import { useEffect, useRef, useState } from "react";
import {
  Download,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { type Item } from "./model";
import { getAsset, openLink, saveAsset } from "./media";
export function BoardMedia({
  item,
  interactive,
  active,
  color,
}: {
  item: Item;
  interactive: boolean;
  active: boolean;
  color: string;
}) {
  const [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const media = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    let canceled = false,
      object = "";
    setUrl("");
    setError("");
    if (!item.assetId) return;
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
  }, [item.assetId]);
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
          pointerEvents: interactive ? "auto" : "none",
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
              <small>Arquivo anexado</small>
              <button
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
              <button
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
          ["video", "audio", "file", "link"].includes(item.type) && (
            <div className="media-interact-hint">
              Duplo clique para interagir
            </div>
          )}
      </div>
    </foreignObject>
  );
}
