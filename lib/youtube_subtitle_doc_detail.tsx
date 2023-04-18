import Head from 'next/head'
import {ChangeEventHandler, KeyboardEventHandler, MouseEventHandler, useEffect, useRef, useState} from "react";
import './async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {aoxamService, DocumentFragment, SearchResponse} from "@/lib/aoxam_service";
import YouTube, {YouTubeEvent} from "react-youtube";
import {nextLoop, pad, sleep} from "@/lib/utils";
import styles from "../styles/Doc.module.css"
import {NextPage} from "next";
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FocusIcon from '@mui/icons-material/MenuOpen';
import {Async, Success, Uninitialized} from "@/lib/async";
import {LinearProgress} from "@mui/material";
import {parseLegacyApiKeyFromLocalStorage} from "@/lib/auth";
import {logEvent, logPageView} from "@/lib/tracker";
import {DocDetailProps} from "@/lib/doc_detail_common";

const ytDocRegex = new RegExp('^yt_(.{11})$')

const YoutubeSubtitleDocumentDetail: NextPage<{ props: DocDetailProps }> = (propsWrapper: { props: DocDetailProps }) => {
    const props = propsWrapper.props
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

    const [searchRequest, setSearchRequest] = useState<Async<SearchResponse<DocumentFragment>>>(
        props.searchResponse != null ? new Success(props.searchResponse) : new Uninitialized()
    )
    const searchRequestACRef = useRef<AbortController | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        logPageView("doc", {
            "q": props.q,
            "docId": props.docId,
            "start_ms": props.startMs,
            "doc_response_size": props.docResponse.hits.length,
            "search_response_size": props.searchResponse?.hits?.length
        })
    }, [])

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

    // TODO redirect to home page if
    function makeSearchRequest(q: string, delayMs: number) {
        searchRequestACRef.current?.abort()
        if (q.length === 0) {
            setSearchRequest(new Uninitialized())
            return
        }
        const ac = new AbortController()
        searchRequestACRef.current = ac
        sleep(delayMs)
            .abortWith(ac)
            .then(() => {
                return aoxamService.searchFragment(
                    props.docId,
                    q,
                    0,
                    999999,
                    "<strong>",
                    "</strong>",
                    parseLegacyApiKeyFromLocalStorage()!!,
                )
            })
            .abortWith(ac)
            .then((v) => v.data)
            .execute(ac, searchRequest.value, (async) => {
                setSearchRequest(async)
                if (async.isSucceed()) {
                    logEvent("doc_search", {
                        "doc_query": q,
                        "search_response_size": async.value?.hits?.length
                    })
                }
            })
    }

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
        makeSearchRequest(event.target.value, 350)
    }

    const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            (event.target as HTMLElement).blur()
            makeSearchRequest(query, 0)
        }
    };

    const docHits = props.docResponse.hits
    const searchRequestMapping = new Map<string, DocumentFragment>()
    const searchHits = searchRequest.value?.hits ?? []
    searchHits.forEach((hit) => {
        searchRequestMapping.set(hit.id, hit)
    })

    let indicatorText = ""
    if (searchHits.length > 0) {
        let indicatorIndex = resolveHitIndex(playerTime, searchHits)
        indicatorText = `${indicatorIndex + 1}/${searchHits.length}`
    } else if (searchHits.length == 0 && query.length > 0) {
        indicatorText = `0/0`
    }
    let indicatorElement
    if (indicatorText) {
        indicatorElement = <div className={styles.searchIndicator}>{indicatorText}</div>
    }

    function moveToNextHit() {
        let index = resolveHitIndex(playerTime, searchHits)
        let nextIndex = (index + 1) % (searchHits.length)
        let startMs = searchHits[nextIndex].startMs
        player?.seekTo(startMs / 1000, true)
        setPlayerTime(startMs)
        setAutoScrollToHighlight(true)
        nextLoop().then(() => scrollToHighlight())
    }

    function moveToPrevHit() {
        let index = resolveHitIndex(playerTime, searchHits)
        let highlightIndex = resolveHighlightIndex(playerTime, docHits)
        let prevIndex
        if (index < 0) {
            prevIndex = searchHits.length - 1
        } else if (docHits[highlightIndex].startMs > searchHits[index].startMs) {
            prevIndex = index
        } else if (index == 0) { // only when the seconds if false, do not merge with the first if
            prevIndex = searchHits.length - 1
        } else {
            prevIndex = index - 1
        }
        let startMs = searchHits[prevIndex].startMs
        player?.seekTo(startMs / 1000, true)
        setPlayerTime(startMs)
        setAutoScrollToHighlight(true)
        nextLoop().then(() => scrollToHighlight())
    }

    const highlightIndex = resolveHighlightIndex(playerTime, docHits)
    const fragments = docHits.map((hit, hitIndex) => {
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

        if (query.length > 0 && matchDoc !== undefined) {
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
    let searchProgress = null
    if (searchRequest.isLoading()) {
        searchProgress = <LinearProgress className={styles.searchProgress}/>
    }
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
                {searchProgress}
                <div className={styles.contentBottom}>
                    <div className={styles.searchContainer}>
                        <input
                            className={styles.searchInput}
                            ref={inputRef}
                            placeholder={"Tìm trong bài..."}
                            type={"text"}
                            value={query}
                            onChange={onQueryChanged}
                            onKeyDown={handleSearchKeyDown}
                        />
                        {indicatorElement}
                    </div>
                    <div
                        className={styles.searchButton}
                        onClick={moveToPrevHit}
                    ><KeyboardArrowUpIcon/></div>
                    <div
                        className={styles.searchButton}
                        onClick={moveToNextHit}
                    ><KeyboardArrowDownIcon/></div>
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

function resolveHighlightIndex(playerTime: number, hits: Array<DocumentFragment>): number {
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

function resolveHitIndex(playerTime: number, hits: Array<DocumentFragment>): number {
    let index = resolveHighlightIndex(playerTime, hits)
    if (index === 0 && playerTime < hits[0].startMs) {
        index = -1
    }
    return index
}

export default YoutubeSubtitleDocumentDetail