import Head from 'next/head'
import {ChangeEventHandler, KeyboardEventHandler, MouseEventHandler, useEffect, useRef, useState} from "react";
import './async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {aoxamService, DocumentFragment, SearchResponse} from "@/lib/aoxam_service";
import YouTube, {YouTubeEvent} from "react-youtube";
import {nextLoop, pad, sleep} from "@/lib/utils";
import styles from "../styles/Doc.module.css"
import {NextPage} from "next";
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import FocusIcon from '@mui/icons-material/MenuOpen';
import {Async, Uninitialized} from "@/lib/async";
import {LinearProgress} from "@mui/material";
import {parseLegacyApiKeyFromLocalStorage} from "@/lib/auth";
import {logEvent, logPageView} from "@/lib/tracker";
import {DocDetailProps} from "@/lib/doc_detail_common";
import {Strings} from "@/lib/strings";
import {setString} from "@/lib/key_value_storage";

const ytDocRegex = new RegExp('^yt_(.{11})$')

const YoutubeSubtitleDocumentDetail: NextPage<{ props: DocDetailProps }> = (propsWrapper: {
    props: DocDetailProps
}) => {
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
    const [showTimestamp, setShowTimestamp] = useState<boolean>(props.showTimestamp ?? false)

    const [searchRequest, setSearchRequest] = useState<Async<SearchResponse<DocumentFragment>>>(
        new Uninitialized()
    )
    const searchRequestACRef = useRef<AbortController | null>(null)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        logPageView("doc", {
            "q": props.q,
            "docId": props.docId,
            "start_ms": props.startMs,
            "doc_response_size": props.docResponse.hits.length,
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

    useEffect(() => {
        if (props.q.length > 0) {
            makeSearchRequest(props.q, 0, "page_load")
        }
    }, []);

    // TODO redirect to home page if
    function makeSearchRequest(q: string, delayMs: number, source: string) {
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
                    parseLegacyApiKeyFromLocalStorage(),
                )
            })
            .abortWith(ac)
            .then((v) => v.data)
            .execute(ac, searchRequest.value, (async) => {
                setSearchRequest(async)
                if (async.isSucceed()) {
                    logEvent("doc_search", {
                        "doc_query": q,
                        "search_response_size": async.value?.hits?.length,
                        "source": source
                    })
                }
            })
    }

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
        makeSearchRequest(event.target.value, 350, "user_type")
    }

    const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            (event.target as HTMLElement).blur()
            makeSearchRequest(query, 0, "user_enter")
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

    function toggleShowTimestamp() {
        const newValue = !showTimestamp
        setShowTimestamp(newValue)
        setString("showTimestamp", String(newValue))
        setTimeout(() => {
            scrollToHighlight()
        }, 0)
    }

    const highlightIndex = resolveHighlightIndex(playerTime, docHits)
    let paraLength = 0
    const fragments = docHits.map((hit, hitIndex) => {
        let para
        let addBreak = true
        if (!showTimestamp) {
            const lastChar = hit.description.charAt(hit.description.length - 1)
            const lastCharIsBreaker = ".,!?".indexOf(lastChar) != -1
            const toBeLength = hit.description.length + paraLength
            addBreak = (toBeLength > 160 && lastCharIsBreaker) || toBeLength > 320
        }
        if (addBreak) {
            paraLength = 0
        } else {
            paraLength += hit.description.length
        }
        const onClick = () => {
            playerRef.current?.seekTo(hit.startMs / 1000, true)
            setPlayerTime(hit.startMs)
        }

        const matchDoc = searchRequestMapping.get(hit.id)
        let cueContainerClassName = styles.cueContainer
        if (showTimestamp) {
            cueContainerClassName = styles.cueContainerTimestamp
        }
        let cueRef = null
        if (highlightIndex === hitIndex) {
            cueContainerClassName = `${cueContainerClassName} ${styles.cueContainerHighlight}`
            cueRef = highlightCueRef
        }

        let cueTextStyle = styles.cueText
        if (showTimestamp) {
            cueTextStyle = styles.cueTextTimestamp
        }

        if (query.length > 0 && matchDoc !== undefined) {
            // improvement: remove the p tag
            para = <span
                key={"text"}
                className={cueTextStyle}
                dangerouslySetInnerHTML={{__html: matchDoc.formatted.description + " "}}>
            </span>
        } else {
            para = <span
                key={"text"}
                className={cueTextStyle}
            >
                {hit.description + " "}
            </span>
        }


        let startTime = null
        if (showTimestamp) {
            // noinspection HtmlUnknownBooleanAttribute
            startTime = <div key={"time"} data-nosnippet className={styles.cueTime}>
                {formatCueTime(hit.startMs)}
            </div>
        }
        return <>
            <span
                key={hit.id}
                ref={cueRef}
                onClick={onClick}
                className={cueContainerClassName}
            >
                {startTime}
                {para}
            </span>
            {!showTimestamp && addBreak ? <><br/><br/></> : null}
        </>
    })

    const onAutoScrollToHighlightClick: MouseEventHandler<HTMLDivElement> = (_) => {
        setAutoScrollToHighlight(true)
    }

    let autoHighlightClass = styles.searchButton
    if (autoScrollToHighlight) {
        autoHighlightClass = `${autoHighlightClass} ${styles.buttonEnabled}`
    }
    let showTimestampClass = styles.searchButton
    if (showTimestamp) {
        showTimestampClass = `${showTimestampClass} ${styles.buttonEnabled}`
    }
    let searchProgress = null
    if (searchRequest.isLoading()) {
        searchProgress = <LinearProgress className={styles.searchProgress}/>
    }
    let contentMiddleStyle = styles.contentMiddle
    if (showTimestamp) {
        contentMiddleStyle = `${contentMiddleStyle} ${styles.contentMiddleTimestamp}`
    }
    return (
        <>
            <Head>
                <title>{props.documentDetail.title}</title>
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
                                    host: "https://www.youtube-nocookie.com",
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

                    <div className={contentMiddleStyle}>
                        {fragments}
                    </div>
                </div>
                {searchProgress}
                <div className={styles.contentBottom}>
                    <div className={styles.searchContainer}>
                        <input
                            className={styles.searchInput}
                            ref={inputRef}
                            placeholder={Strings.docSearchPlaceHolder}
                            type={"text"}
                            value={query}
                            onChange={onQueryChanged}
                            onKeyDown={handleSearchKeyDown}
                        />
                        {indicatorElement}
                    </div>
                    <div
                        className={showTimestampClass}
                        onClick={toggleShowTimestamp}
                    ><FormatListBulletedIcon/></div>
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