import Head from 'next/head'
import {useRouter} from "next/router";
import {ChangeEventHandler, KeyboardEventHandler, useEffect, useState} from "react";
import '../../lib/async'
import {aoxamServiceInternal, DocumentWindow, Filter, SearchResponse} from "@/lib/aoxam_service";
import Link from "next/link";
import styles from "../../styles/Search.module.css";
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {Async, Uninitialized} from "@/lib/async";
import {Chip, LinearProgress} from "@mui/material";
import {getRedirectProps, parseLegacyApiKeyFromContext} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {logClick, logPageView} from "@/lib/tracker";
import {convertStringToMap, groupBySet} from "@/lib/utils";
import * as process from "process";
import {Strings} from "@/lib/strings";

interface SearchProps {
    q: string,
    start: number,
    searchResponse: SearchResponse<DocumentWindow>,
}

const youtubeWindowIdRegex = new RegExp("^yt_(.{11})_(\\d+)_(\\d+)$")
const facebookWindowIdRegex = new RegExp("^fb_(\\d+)_(\\d+)_(\\d+)$")

const perPageLimit = 10

const hostToDomain = convertStringToMap(process.env.HOST_TO_DOMAIN)

function parseFirstString(value: string | string[] | undefined): string | undefined {
    if (typeof value === "string") {
        return value
    }
    if (Array.isArray(value)) {
        return value[0]
    }
    return undefined
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }
    let q = context.query.q
    let host = context.req.headers.host ?? ""
    const domain = hostToDomain.get(host)
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
        parseLegacyApiKeyFromContext(context),
        domain,
        parseFirstString(context.query.ytChannel),
        parseFirstString(context.query.fbProfileId),
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

function buildQuery(filters: Array<Filter>): Record<string, string> {
    const queryNameToQueryValues = groupBySet(
        filters.filter(f => f.isSelected),
        f => f.queryName,
        f => f.queryValue
    )
    const result: Record<string, string> = {}
    queryNameToQueryValues.forEach((queryValues, queryName) => {
        result[queryName] = Array.from(queryValues).join(",")
    })
    return result
}

function buildFilterParam(filters: Array<Filter>): Record<string, Array<string>> {
    const result: Record<string, Array<string>> = {}
    let selectedFilters = filters.filter(f => f.isSelected)
    if (selectedFilters.length == 0) {
        selectedFilters = filters
    }

    const queryNameValueDisplay: Array<string> = []
    groupBySet(selectedFilters, f => f.queryNameDisplay, f => f.queryValueDisplay)
        .forEach((queryValueDisplays, queryNameDisplay) => {
            queryValueDisplays.forEach((queryValueDisplay) => {
                queryNameValueDisplay.push(`${queryNameDisplay} = ${queryValueDisplay}`)
            })
        })
    result["query_name_value_display"] = queryNameValueDisplay


    const queryNameValue: Array<string> = []
    groupBySet(selectedFilters, f => f.queryName, f => f.queryValue)
        .forEach((queryValues, queryName) => {
            queryValues.forEach((queryValue) => {
                queryNameValue.push(`${queryName} = ${queryValue}`)
            })
        })
    result["query_name_value"] = queryNameValue

    return result
}

export default function Search(props: SearchProps) {
    const hits = props.searchResponse.hits
    const [showUserQuery, setShowUserQuery] = useState<boolean>(false)
    const router = useRouter()
    const [query, setQuery] = useState<string>(props.q)
    const [filters, setFilters] = useState<Array<Filter>>(props.searchResponse.filters ?? [])
    const [navigateAsync, setNavigateAsync] = useState<Async<boolean>>(new Uninitialized<boolean>())

    useEffect(() => {
        logPageView("search", {
            "q": props.q,
            "start": props.start,
            ...buildFilterParam(filters),
            "filter_selected": filters.filter((f) => f.isSelected).length != 0
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
                    ...buildQuery(filters)
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

        let startMs = null
        if (windowId.startsWith("yt_")) {
            const match = youtubeWindowIdRegex.exec(windowId)
            if (match == null) {
                throw Error(`Invalid window id: ${windowId}`)
            }
            startMs = match[2]
        } else if (windowId.startsWith("fb_")) {
            const match = facebookWindowIdRegex.exec(windowId)
            if (match == null) {
                throw Error(`Invalid window id: ${windowId}`)
            }
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
                        pathname: `/${hit.slug}`,
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

    const filterElements = filters.map((filter: Filter) => {
        return <>
            <Chip
                sx={{borderColor: "rgb(234,234,234)"}}
                className={styles.filterChip}
                key={`${filter.queryValue}-${filter.queryName}-${filter.isSelected}`}
                label={filter.queryValueDisplay}
                variant={filter.isSelected ? "filled" : "outlined"}
                onClick={() => {
                    const newFilter = filters.slice()
                    logClick("search", "filter", filter)
                    newFilter.forEach((f) => {
                        if (f.queryName == filter.queryName && f.queryValue == filter.queryValue) {
                            f.isSelected = !filter.isSelected
                        }
                    })
                    setFilters(newFilter)
                    router.push({
                        pathname: `/search`,
                        query: {
                            q: props.q,
                            ...buildQuery(newFilter)
                        }
                    }).onAsync((async: Async<boolean>) => {
                        setNavigateAsync(async)
                    })
                }}
            />
            <span
                key={`${filter.queryValue}-${filter.queryName}-${filter.isSelected}-separator`}
                className={styles.filterChipSeparator}
            />
        </>
    })

    let titlePrefix = Strings.searchTitlePrefix
    if (props.q) {
        titlePrefix += `${props.q}`
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
        endText = Strings.searchNoResult
    } else if (isEndOfResult) {
        endText = Strings.searchEndOfResult
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
                <title>{titlePrefix}</title>
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
                <div className={styles.filterContainer}>
                    {filterElements}
                </div>
                <div className={styles.hitList}>
                    <div className={styles.hitDiviner}></div>
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
                                                start: props.start + perPageLimit,
                                                ...buildQuery(filters)
                                            }
                                        }
                                    }
                                    className={styles.nextPageButton}
                                >
                                    <div>{Strings.searchNextPage}</div>
                                    <KeyboardArrowRightIcon className={styles.nextPageIcon}/>
                                </Link>
                            </div> : endElement
                    }
                </div>
            </main>
        </>
    )
}
