import {PlayerProps} from "@/lib/player/PlayerProps";
import {PlayerInterface, PlayerState} from "@/lib/player/PlayerInterface";
import {useCallback, useEffect, useState} from "react";
import videojs from 'video.js';
import "video.js/dist/video-js.css";
import Player from "video.js/dist/types/player";


class VideojsPlayerWrapper implements PlayerInterface {
    player: Player;

    constructor(player: Player) {
        this.player = player;
    }

    getCurrentTime(): number {
        return this.player.currentTime() ?? 0
    }

    seekTo(seconds: number, allowSeekAhead: boolean): void {
        if (this.getCurrentTime() != seconds) {
            this.player.currentTime(seconds)
        }
    }
}

export function VideoJsPlayer(props: PlayerProps) {
    const args = props.videojs
    if (args == null) {
        throw Error("missing args")
    }
    const [videoEl, setVideoEl] = useState(null);
    const onVideo = useCallback((el: any) => {
        setVideoEl(el)
    }, [])

    useEffect(() => {
        if (videoEl == null) return
        const listener = props.listener
        let player: Player = videojs(videoEl, {
            sources: [{
                // video mp4
                src: args.src
            }]
        })
        player.on("ready", () => {
            const playerWrapper = new VideojsPlayerWrapper(player)
            listener.onReady(playerWrapper)
            player.play()
        })

        player.on('playing', function () {
            listener.onStateChange(PlayerState.PLAYING)
        });

        player.on('ended', function () {
            listener.onStateChange(PlayerState.ENDED)
        });

        player.on('pause', function () {
            listener.onStateChange(PlayerState.PAUSED)
        });

        return () => {
            player.dispose()
        }
    }, [videoEl])
    return (
        <>
            <div data-vjs-player="" style={{
                width: "100%",
                height: "100%"
            }}>
                <video
                    poster={args.poster}
                    width="100%"
                    height="100%"
                    controls
                    className={`video-js`}
                    ref={onVideo}
                />
            </div>
        </>
    )
}