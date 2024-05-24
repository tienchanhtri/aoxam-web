export interface PlayerInterface {
    seekTo(seconds: number, allowSeekAhead: boolean): void;

    getCurrentTime(): number;
}

export interface PlayerListenerInterface {
    onReady(player: PlayerInterface): void

    onStateChange(state: PlayerState): void;
}

export enum PlayerState {
    UNSTARTED = -1,
    ENDED = 0,
    PLAYING = 1,
    PAUSED = 2,
    BUFFERING = 3,
    CUED = 5
}