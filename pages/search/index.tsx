import Head from 'next/head'
import {useRouter} from "next/router";
import {ChangeEventHandler, KeyboardEventHandler, useEffect, useState} from "react";
import '../../lib/async'
import {aoxamServiceInternal, DocumentWindow, SearchResponse} from "@/lib/aoxam_service";
import Link from "next/link";
import styles from "../../styles/Search.module.css";
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {Async, Uninitialized} from "@/lib/async";
import {LinearProgress} from "@mui/material";
import {getRedirectProps, parseLegacyApiKeyFromContext} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {logPageView} from "@/lib/tracker";

interface SearchProps {
    q: string,
    start: number,
    searchResponse: SearchResponse<DocumentWindow>,
}

const youtubeWindowIdRegex = new RegExp("^yt_(.{11})_(\\d+)_(\\d+)$")
const facebookWindowIdRegex = new RegExp("^fb_(\\d+)_(\\d+)_(\\d+)$")

const perPageLimit = 10

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }
    let q = context.query.q
    if (Array.isArray(q)) {
        q = q[0]
    }
    if (q == null) {
        q = ""
    }
    let start = 0
    const startQuery = context.query.start
    if (typeof startQuery === 'string') {
        const startNumber = parseInt(startQuery)
        if (startNumber > 0) {
            start = startNumber
        }
    }

    const response = await aoxamServiceInternal.search(
        q as string,
        start,
        10,
        "<strong>",
        "</strong>",
        parseLegacyApiKeyFromContext(context)!!,
    )
    const props: { props: SearchProps } = {
        props: {
            q: q,
            start: start,
            searchResponse: response.data
        },
    }
    return props
}

export default function Search(props: SearchProps) {
    const hits = props.searchResponse.hits
    const [showUserQuery, setShowUserQuery] = useState<boolean>(false)
    const router = useRouter()
    const [query, setQuery] = useState<string>(props.q)
    const [navigateAsync, setNavigateAsync] = useState<Async<boolean>>(new Uninitialized<boolean>())

    useEffect(() => {
        logPageView("search", {
            "q": props.q,
            "start": props.start,
        })
    }, [props])

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setShowUserQuery(true)
        setQuery(event.target.value)
    }

    const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            (event.target as HTMLElement).blur()
            router.push({
                pathname: `/search`,
                query: {
                    q: query,
                }
            }).onAsync((async: Async<boolean>) => {
                setNavigateAsync(async)
            }).then(() => {
                setShowUserQuery(false)
                setQuery(props.q)
            })
        }
    };

    const hitElements = hits.map((hit) => {
        const windowId = hit.id

        let documentId = null
        let startMs = null
        if (windowId.startsWith("yt_")) {
            const match = youtubeWindowIdRegex.exec(windowId)
            if (match == null) {
                throw Error(`Invalid window id: ${windowId}`)
            }
            documentId = hit.id.substring(0, 14)
            startMs = match[2]
        } else if (windowId.startsWith("fb_")) {
            const match = facebookWindowIdRegex.exec(windowId)
            if (match == null) {
                throw Error(`Invalid window id: ${windowId}`)
            }
            documentId = `fb_${match[1]}`
        } else {
            throw new Error(`Unknown window id format ${windowId}`)
        }

        return <div
            key={hit.id}
            className={styles.hitContainer}
        >
            <Link
                // click on link will open new tab (requirement)
                target={"_blank"}
                key={"link"}
                className={styles.hitTitle}
                scroll
                href={
                    {
                        pathname: `/doc/${documentId}`,
                        query: {
                            startMs: startMs,
                            q: props.q,
                        }
                    }
                }
            >{hit.title}</Link>
            <div
                key={"description"}
                className={styles.hitDescription}
                dangerouslySetInnerHTML={{__html: hit.formatted.description}}
            ></div>
        </div>
    })
    let title = "Áo Xám Search"
    if (props.q) {
        title += ` - ${props.q}`
    }
    let displayQuery
    if (showUserQuery) {
        displayQuery = query
    } else {
        displayQuery = props.q
    }
    const isNoResult = props.searchResponse.hits.length == 0
    const isEndOfResult = props.searchResponse.hits.length < perPageLimit
    const showNextPage = !isEndOfResult
    let endText = null
    if (isNoResult) {
        endText = "Không có kết quả nào"
    } else if (isEndOfResult) {
        endText = "Cuối kết quả tìm kiếm"
    }
    let endElement = null
    if (endText) {
        endElement = <div className={styles.endOfResultIndicator}>{endText}</div>
    }
    let navigateProgressIndicator = null
    if (navigateAsync.isLoading()) {
        navigateProgressIndicator = <LinearProgress className={styles.navigateProgressIndicator}/>
    }
    return (
        <>
            <Head>
                <title>{title}</title>
            </Head>
            <main className={styles.main}>
                {navigateProgressIndicator}
                <div className={styles.searchContainer}>
                    <SearchIcon className={styles.searchIcon}/>
                    <input type="text"
                           className={styles.searchBox}
                           onChange={onQueryChanged}
                           onKeyDown={handleSearchKeyDown}
                           value={displayQuery}/>
                </div>
                <div className={styles.hitList}>
                    {hitElements}
                    {
                        showNextPage ?
                            <div className={styles.nextPageRow}>
                                <Link
                                    scroll
                                    href={
                                        {
                                            pathname: `/search`,
                                            query: {
                                                q: props.q,
                                                start: props.start + perPageLimit
                                            }
                                        }
                                    }
                                    className={styles.nextPageButton}
                                >
                                    <div>Trang kế tiếp</div>
                                    <KeyboardArrowRightIcon className={styles.nextPageIcon}/>
                                </Link>
                            </div> : endElement
                    }
                </div>
            </main>
        </>
    )
}
