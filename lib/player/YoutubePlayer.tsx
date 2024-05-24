import {PlayerProps} from "@/lib/player/PlayerProps";
import styles from "@/styles/Doc.module.css";
import YouTube, {YouTubeEvent} from "react-youtube";
import {PlayerInterface} from "@/lib/player/PlayerInterface";


class YoutubePlayerWrapper implements PlayerInterface {
    player: YT.Player;

    constructor(player: YT.Player) {
        this.player = player;
    }

    getCurrentTime(): number {
        return this.player.getCurrentTime();
    }

    seekTo(seconds: number, allowSeekAhead: boolean): void {
        return this.player.seekTo(seconds, allowSeekAhead)
    }
}

export function YoutubePlayer(props: PlayerProps) {
    const args = props.youtube
    if (args == null) {
        throw Error("missing args")
    }

    const listener = props.listener
    return <YouTube
        className={styles.youtubePlayer}
        videoId={args.videoId}
        onReady={(event: YouTubeEvent) => {
            const player = (event.target as YT.Player)
            listener.onReady(new YoutubePlayerWrapper(player))
        }}
        onStateChange={(event: YouTubeEvent<number>) => {
            listener.onStateChange(event.data)
        }}
        opts={args.opts}
    />
}