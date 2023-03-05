import Head from 'next/head'
import {useRouter} from "next/router";
import {MouseEventHandler, useEffect, useRef, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {Async, Uninitialized} from "@/pages/async";
import {aoxamService, DocumentFragment, SearchResponse} from "@/pages/aoxam_service";
import YouTube, {YouTubeEvent, YouTubePlayer} from "react-youtube";
import {nextLoop, sleep} from "@/pages/utils";
import styles from "../../styles/Doc.module.css"

const ytDocRegex = new RegExp('^yt_(.{11})$')

export default function DocumentDetail() {
    const router = useRouter()
    const [fragmentsAsync, setFragmentsAsync] = useState<Async<SearchResponse<DocumentFragment>>>(
        new Uninitialized<SearchResponse<DocumentFragment>>()
    )
    const [queryPlayerTimeAC, setQueryPlayerTimeAC] = useState<AbortController | null>(null)
    // in ms
    const [playerTime, setPlayerTime] = useState<number | null>(null)
    const playerTimeRef = useRef<number | null>(playerTime)
    playerTimeRef.current = playerTime
    const highlightCueRef = useRef<HTMLElement>(null)
    const [autoScrollToHighlight, setAutoScrollToHighlight] = useState<boolean>(true)
    const autoScrollToHighlightRef = useRef<boolean>(autoScrollToHighlight)
    autoScrollToHighlightRef.current = autoScrollToHighlight
    const youtubeRef = useRef<HTMLDivElement>(null)

    function resolveDocId(): string | null {
        return router.query.id as string
    }

    function resolveYoutubeId(): string | null {
        if (!resolveDocId()) {
            return null
        }
        return ytDocRegex.exec(resolveDocId() ?? "")?.[1] ?? null
    }

    function resolveStartMs(): number | null {
        if (!router.isReady) {
            return null
        }
        const startMsQuery = router.query?.startMs
        return parseInt(startMsQuery as string)
    }

    const docId = resolveDocId()
    const youtubeId = resolveYoutubeId()

    useEffect(() => {
        if (!router.isReady) {
            return
        }

        const startMs = resolveStartMs()
        if (!playerTimeRef.current) {
            setPlayerTime(startMs)
        }

        const ac = new AbortController()
        aoxamService.searchFragment(resolveDocId() ?? "", "", 0, 999999, "<strong>", "</strong>")
            .abortWith(ac)
            .then((response) => {
                return response.data
            })
            .abortWith(ac)
            .execute(ac, fragmentsAsync.value, (async) => {
                setFragmentsAsync(async)
                if (async.isSucceed()) {
                    (async () => {
                        await nextLoop()
                        if (autoScrollToHighlightRef.current) {
                            scrollToHighlight()
                        }
                    })()
                }
            })
        return () => {
            ac.abort()
        }
    }, [router.isReady])

    useEffect(() => {
        const scrollListener = () => {
            setAutoScrollToHighlight(false)
        }
        const touchMoveListener = () => {
            setAutoScrollToHighlight(false)
        }
        window.addEventListener('wheel', scrollListener);
        window.addEventListener('touchmove', touchMoveListener);
        return () => {
            window.removeEventListener('wheel', scrollListener)
            window.removeEventListener('touchmove', touchMoveListener);
        }
    })

    let foundHighlight = false
    const hits = [...fragmentsAsync.value?.hits ?? []].sort((a, b) => {
        const aMs = a.startMs ?? -1
        const bMs = b.startMs ?? -1
        return aMs > bMs ? 1 : aMs < bMs ? -1 : 0
    })

    function resolveHighlightIndex(): number {
        if (playerTime == null) {
            return -1
        }
        const hitsLength = hits.length
        if (hitsLength == 0) {
            return -1
        }
        if (hitsLength == 1) {
            return 0
        }
        if (playerTime < hits[0].startMs) {
            return 0
        }
        if (playerTime > hits[hitsLength - 1].startMs) {
            return hitsLength - 1
        }
        let tmpIndex = hits.findIndex((hit) => {
            return hit.startMs > playerTime
        })
        return tmpIndex - 1
    }

    const highlightIndex = resolveHighlightIndex()
    const fragments = hits.map((hit, hitIndex) => {
        let inner
        if (highlightIndex === hitIndex) {
            inner = <strong ref={highlightCueRef}>{hit.description}</strong>
            foundHighlight = true
        } else {
            inner = <>{hit.description}</>
        }
        return <p key={hit.id}>{inner}</p>
    })

    function scrollToHighlight() {
        const currentCue = highlightCueRef.current
        if (currentCue != null) {
            const rect = currentCue.getBoundingClientRect();
            const youtubeHeight = youtubeRef.current?.getBoundingClientRect()?.height ?? 0
            const elementMiddle = rect.top + (rect.height / 2)
            const cuesMiddle = (window.innerHeight + youtubeHeight) / 2
            const distance = elementMiddle - cuesMiddle;
            // Scroll the window to the middle of the element
            window.scrollBy({
                top: distance,
                behavior: 'smooth'
            });
        }
    }

    const onAutoScrollToHighlightClick: MouseEventHandler<HTMLButtonElement> = (event) => {
        setAutoScrollToHighlight(true)
    }

    function queryPlayerTime(youtubePlayer: YouTubePlayer) {
        queryPlayerTimeAC?.abort()
        const ac = new AbortController()
        setQueryPlayerTimeAC(ac)
        const job = async () => {
            while (!ac.signal.aborted) {
                console.log("query player time")
                if (youtubePlayer.getPlayerState() != YouTube.PlayerState.PLAYING) {
                    await sleep(500)
                    continue
                }
                setPlayerTime(youtubePlayer.getCurrentTime() * 1000)
                // @ts-ignore
                if (autoScrollToHighlightRef.current) {
                    await nextLoop()
                    scrollToHighlight()
                }
                await sleep(500)
            }
        }
        // noinspection JSIgnoredPromiseFromCall
        job()
    }

    function onPlayerReady(event: YouTubeEvent) {
        queryPlayerTime(event.target)
    }

    let videoIframe = null
    if (youtubeId != null) {
        const startMsQuery = router.query?.startMs
        let start = 0
        if (startMsQuery) {
            start = Math.floor(parseInt(startMsQuery as string) / 1000)
        }
        videoIframe =
            <div ref={youtubeRef} className={styles.youtubePlayerContainer}>
                <YouTube
                    className={styles.youtubePlayer}
                    videoId={youtubeId}
                    onReady={onPlayerReady}
                    opts={
                        {
                            height: '100%',
                            width: '100%',
                            playerVars: {
                                // https://developers.google.com/youtube/player_parameters
                                start: start,
                                autoplay: 1,
                                modestbranding: 1,
                                rel: 0
                            },
                        }
                    }
                />
            </div>
    }
    return (
        <>
            <Head>
                <title>Aoxam doc {resolveDocId()}</title>
            </Head>
            <main className={styles.main}>
                <>
                    {videoIframe}
                    <p key={"debugDocId"}>Document id: {resolveDocId()}</p>
                    <p key={"debugYoutubeId"}>Youtube id: {resolveYoutubeId()}</p>
                    {fragments.length}
                    <p>Playing: {playerTime}</p>
                    <p>highlightIndex: {highlightIndex}</p>
                    {fragments}
                    <button
                        className={styles.autoFocusButton}
                        disabled={autoScrollToHighlight}
                        onClick={onAutoScrollToHighlightClick}
                    >
                        Scroll to highlight
                    </button>
                </>
            </main>
        </>
    )
}
