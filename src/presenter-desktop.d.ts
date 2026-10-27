import type { PresenterState } from "./presenterProtocol";
export {};
declare global {
  interface Window {
    orquestraPresenter?: {
      isAudience: boolean;
      openAudience(): Promise<{ opened: boolean; displayCount: number }>;
      closeAudience(): Promise<void>;
      publish(state: PresenterState): Promise<void>;
      laser(point: { x: number; y: number } | null): void;
      onLaser(callback: (point: { x: number; y: number } | null) => void): () => void;
      onState(callback: (state: PresenterState) => void): () => void;
      onAudienceClosed(callback: () => void): () => void;
      setFullscreen(value: boolean): Promise<boolean>;
      setAudienceFullscreen(value: boolean): Promise<boolean>;
      onFullscreen(callback: (value: boolean) => void): () => void;
      onCommand(callback: (command: "next" | "previous" | "stop") => void): () => void;
      command(command: "next" | "previous" | "stop"): void;
    };
  }
}
