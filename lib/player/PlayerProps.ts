import {PlayerListenerInterface} from "@/lib/player/PlayerInterface";

export interface PlayerProps {
    listener: PlayerListenerInterface
    youtube?: {
        videoId: string,
        opts: any,
    }
    videojs?: {
        src: string,
    }
}
