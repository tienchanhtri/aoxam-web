import Head from 'next/head'
import {useRouter} from "next/router";
import {MouseEventHandler, useEffect, useRef, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {aoxamService, DocumentFragment, SearchResponse} from "@/pages/aoxam_service";
import YouTube, {YouTubeEvent, YouTubePlayer} from "react-youtube";
import {nextLoop, sleep} from "@/pages/utils";
import styles from "../../styles/Doc.module.css"
import {GetServerSideProps} from "next";

const ytDocRegex = new RegExp('^yt_(.{11})$')

interface DocDetailProps {
    q: string,
    docId: string,
    startMs: number,
    docResponse: SearchResponse<DocumentFragment>,
    searchResponse: SearchResponse<DocumentFragment>,
}

export const getServerSideProps: GetServerSideProps<DocDetailProps> = async (context) => {
    let q = context.query.q
    if (Array.isArray(q)) {
        q = q[0]
    }
    if (q == null) {
        q = ""
    }
    let docId = context.params?.id
    if (typeof docId !== 'string') {
        throw Error(`Invalid docId: ${docId}`)
    }
    let startMs: number = 0
    const startQuery = context.query.startMs
    if (typeof startQuery === 'string') {
        const startNumber = parseInt(startQuery)
        if (startNumber > 0) {
            startMs = startNumber
        }
    }

    const docRequest = aoxamService.searchFragment(
        docId,
        "",
        0,
        999999,
        null,
        null
    )
    const searchRequest = aoxamService.searchFragment(
        docId,
        q,
        0,
        999999,
        "<strong>",
        "</strong>",
    )
    const docResponse = await docRequest
    const searchResponse = await searchRequest
    return {
        props: {
            "q": q,
            "docId": docId,
            "startMs": startMs,
            "docResponse": docResponse.data,
            "searchResponse": searchResponse.data,
        },
    }
}

export default function DocumentDetail(props: DocDetailProps) {
    const router = useRouter()
    const [queryPlayerTimeAC, setQueryPlayerTimeAC] = useState<AbortController | null>(null)
    // in ms
    const [playerTime, setPlayerTime] = useState<number>(props.startMs)
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
        return ytDocRegex.exec(props.docId)?.[1] ?? null
    }

    const youtubeId = resolveYoutubeId()

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
    }, [])

    useEffect(() => {
        scrollToHighlight()
    }, [])

    let foundHighlight = false
    const hits = props.docResponse.hits.sort((a, b) => {
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
    const searchRequestMapping = new Map<string, DocumentFragment>()
    props.searchResponse.hits.forEach((hit) => {
        searchRequestMapping.set(hit.id, hit)
    })
    const fragments = hits.map((hit, hitIndex) => {
        let inner
        if (highlightIndex === hitIndex) {
            inner = <strong ref={highlightCueRef}>{hit.description}</strong>
            foundHighlight = true
        } else {
            const matchDoc = searchRequestMapping.get(hit.id)
            if (matchDoc !== undefined) {
                // improvement: remove the p tag
                inner = <p dangerouslySetInnerHTML={{__html: matchDoc.formatted.description}}></p>
            } else {
                inner = <>{hit.description}</>
            }
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

    const onAutoScrollToHighlightClick: MouseEventHandler<HTMLButtonElement> = (_) => {
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
                    <button className={styles.backButton} onClick={() => {
                        router.back()
                    }}>Back
                    </button>
                </>
            </main>
        </>
    )
}
