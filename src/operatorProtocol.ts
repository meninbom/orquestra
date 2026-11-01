export type OperatorTimer = { elapsedMs: number; startedAt: number | null };
export type OperatorState = { scenes: { id: string; name: string }[]; index: number; step: number; maxStep: number; playing: boolean; audience: boolean; fullscreen: boolean; laser: boolean; notes?: string; light: boolean; timer: OperatorTimer };
export type OperatorCommand = { type: 'next' | 'previous' | 'togglePlay' | 'stop' | 'openAudience' | 'closeAudience' | 'toggleFullscreen' | 'toggleLaser' | 'attach' } | { type: 'select'; index: number } | { type: 'timer'; timer: OperatorTimer };
