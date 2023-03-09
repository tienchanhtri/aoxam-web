import Head from 'next/head'
import {useRouter} from "next/router";
import {MouseEventHandler, useEffect, useRef, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {aoxamService, DocumentFragment, SearchResponse} from "@/pages/aoxam_service";
import YouTube, {YouTubeEvent} from "react-youtube";
import {nextLoop, pad, sleep} from "@/pages/utils";
import styles from "../../styles/Doc.module.css"
import {GetServerSideProps} from "next";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FocusIcon from '@mui/icons-material/MenuOpen';

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
    const [query, setQuery] = useState<string>(props.q ?? "")

    function onPlayerReady(event: YouTubeEvent) {
        setPlayer(event.target);
        (event.target as YT.Player).seekTo(props.startMs / 1000, true)
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
        let startMsEqualPlayerTime = false
        let tmpIndex = hits.findIndex((hit) => {
            const found = hit.startMs >= playerTime
            if (hit.startMs === playerTime) {
                startMsEqualPlayerTime = true
            }
            return found
        })
        if (startMsEqualPlayerTime) {
            return tmpIndex
        }
        return tmpIndex - 1
    }

    const highlightIndex = resolveHighlightIndex()
    const searchRequestMapping = new Map<string, DocumentFragment>()
    props.searchResponse.hits.forEach((hit) => {
        searchRequestMapping.set(hit.id, hit)
    })
    const fragments = hits.map((hit, hitIndex) => {
        let para
        const onClick = () => {
            playerRef.current?.seekTo(hit.startMs / 1000, true)
            setPlayerTime(hit.startMs)
        }

        const matchDoc = searchRequestMapping.get(hit.id)
        let cueContainerClassName = styles.cueContainer
        let cueRef = null
        if (highlightIndex === hitIndex) {
            cueContainerClassName = `${cueContainerClassName} ${styles.cueContainerHighlight}`
            cueRef = highlightCueRef
        }

        if (props.q.length > 0 && matchDoc !== undefined) {
            // improvement: remove the p tag
            para = <div
                key={"text"}
                className={styles.cueText}
                dangerouslySetInnerHTML={{__html: matchDoc.formatted.description}}>
            </div>
        } else {
            para = <div
                key={"text"}
                className={styles.cueText}
            >
                {hit.description}
            </div>
        }

        const startTime = <div key={"time"} className={styles.cueTime}>
            {formatCueTime(hit.startMs)}
        </div>
        return <div
            key={hit.id}
            ref={cueRef}
            onClick={onClick}
            className={cueContainerClassName}
        >
            {startTime}
            {para}
        </div>
    })

    const onAutoScrollToHighlightClick: MouseEventHandler<HTMLDivElement> = (_) => {
        setAutoScrollToHighlight(true)
    }

    let autoHighlightClass = styles.searchButton
    if (autoScrollToHighlight) {
        autoHighlightClass = `${autoHighlightClass} ${styles.buttonEnabled}`
    }
    const title = `Aoxam doc ${props.docId}`
    return (
        <>
            <Head>
                <title>{title}</title>
            </Head>
            <main>
                <div className={styles.main}>
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
                        {fragments}
                    </div>
                </div>

                <div className={styles.contentBottom}>
                    <input
                        className={styles.searchInput}
                        placeholder={"Tìm trong bài..."}
                        type={"text"}
                        value={query}
                        onChange={() => {
                        }}
                    />
                    <div className={styles.searchIndicator}>300/1000</div>
                    <div className={styles.searchButton}><KeyboardArrowUpIcon/></div>
                    <div className={styles.searchButton}><KeyboardArrowDownIcon/></div>
                    <div
                        className={autoHighlightClass}
                        onClick={onAutoScrollToHighlightClick}
                    >
                        <FocusIcon/>
                    </div>

                </div>
            </main>
        </>
    )
}

function formatCueTime(timeMs: number) {
    const timeSeconds = Math.floor(timeMs / 1000)
    const secondPart = timeSeconds % 60
    const minutesPart = Math.floor(timeSeconds / 60 % 60)
    const hourPath = Math.floor(timeSeconds / 3600)
    if (hourPath > 0) {
        return `${hourPath}:${pad(minutesPart, 2)}:${pad(secondPart, 2)}`
    }
    return `${minutesPart}:${pad(secondPart, 2)}`
}
