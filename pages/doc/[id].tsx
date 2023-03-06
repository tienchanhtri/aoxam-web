import Head from 'next/head'
import {useRouter} from "next/router";
import {MouseEventHandler, useEffect, useRef, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {aoxamService, DocumentFragment, SearchResponse} from "@/pages/aoxam_service";
import YouTube, {YouTubeEvent} from "react-youtube";
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
    const highlightCueRef = useRef<HTMLParagraphElement>(null)
    const [autoScrollToHighlight, setAutoScrollToHighlight] = useState<boolean>(true)
    const autoScrollToHighlightRef = useRef<boolean>(autoScrollToHighlight)
    autoScrollToHighlightRef.current = autoScrollToHighlight
    const [player, setPlayer] = useState<YT.Player | null>(null)
    const playerRef = useRef<YT.Player | null>()
    playerRef.current = player

    function onPlayerReady(event: YouTubeEvent) {
        setPlayer(event.target)
    }

    const [playState, setPlayState] = useState<number | null>(null)

    function onPlayStateChanged(event: YouTubeEvent<number>) {
        setPlayState(event.data)
    }

    const queryPlayerTimeRef = useRef<AbortController | null>(null)

    function resolveYoutubeId(): string {
        return ytDocRegex.exec(props.docId)!![1]
    }

    const youtubeId = resolveYoutubeId()

    useEffect(() => {
        if (player == null) {
            return
        }
        const shouldQueryPlayerTime = playState == YT.PlayerState.PLAYING
        if (!shouldQueryPlayerTime) {
            queryPlayerTimeRef.current?.abort()
            return
        }
        const ac = new AbortController()
        queryPlayerTimeRef.current = ac;
        (async () => {
            while (!ac.signal.aborted) {
                console.log("query player time")
                setPlayerTime(player.getCurrentTime() * 1000)
                if (autoScrollToHighlightRef.current) {
                    await nextLoop()
                    scrollToHighlight()
                }
                await sleep(500)
            }
        })()

        return () => {
            queryPlayerTimeRef.current?.abort()
        }
    }, [player, playState])

    function scrollToHighlight() {
        const currentCue = highlightCueRef.current
        const cueContainer = currentCue?.offsetParent
        if (currentCue == null || cueContainer == null) {
            return
        }
        const elementMiddle = currentCue.offsetTop + (currentCue.getBoundingClientRect().height / 2)
        const contentHeight = cueContainer.getBoundingClientRect().height
        cueContainer.scrollTo({
            top: elementMiddle - contentHeight / 2,
            behavior: 'smooth'
        });
    }

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
        let para
        if (highlightIndex === hitIndex) {
            para = <p key={hit.id} ref={highlightCueRef}><strong>{hit.description}</strong></p>
            foundHighlight = true
        } else {
            const matchDoc = searchRequestMapping.get(hit.id)
            if (props.q.length > 0 && matchDoc !== undefined) {
                // improvement: remove the p tag
                para = <p key={hit.id} dangerouslySetInnerHTML={{__html: matchDoc.formatted.description}}></p>
            } else {
                para = <p key={hit.id}>{hit.description}</p>
            }
        }
        return para
    })

    const onAutoScrollToHighlightClick: MouseEventHandler<HTMLButtonElement> = (_) => {
        setAutoScrollToHighlight(true)
    }

    return (
        <>
            <Head>
                <title>Aoxam doc {props.docId}</title>
            </Head>
            <main className={styles.main}>
                <>
                    <div className={styles.contentTop}>
                        <YouTube
                            className={styles.youtubePlayer}
                            videoId={youtubeId}
                            onReady={onPlayerReady}
                            onStateChange={onPlayStateChanged}
                            opts={
                                {
                                    height: '100%',
                                    width: '100%',
                                    playerVars: {
                                        // https://developers.google.com/youtube/player_parameters
                                        start: Math.floor(props.startMs / 1000),
                                        autoplay: 1,
                                        modestbranding: 1,
                                        rel: 0
                                    },
                                }
                            }
                        />
                    </div>

                    <div className={styles.contentMiddle}>
                        <p key={"debugDocId"}>Document id: {props.docId}</p>
                        <p key={"debugYoutubeId"}>Youtube id: {resolveYoutubeId()}</p>
                        {fragments.length}
                        <p>Playing: {playerTime}</p>
                        <p>highlightIndex: {highlightIndex}</p>
                        {fragments}
                    </div>

                    <div className={styles.contentBottom}>
                        <button
                            disabled={autoScrollToHighlight}
                            onClick={onAutoScrollToHighlightClick}
                        >
                            Scroll to highlight
                        </button>
                        <button
                            onClick={() => {
                                router.back()
                            }}
                        >
                            Back
                        </button>
                    </div>
                </>
            </main>
        </>
    )
}
