import Head from 'next/head'
import {useRouter} from "next/router";
import React, {ChangeEventHandler, KeyboardEventHandler, useEffect, useState} from "react";
import '../../lib/async'
import {DocumentWindow, Filter, getAoxamServiceV2, SearchResponse} from "@/lib/aoxam_service";
import Link from "next/link";
import styles from "../../styles/Search.module.css";
import SearchIcon from '@mui/icons-material/Search';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import {Async, Uninitialized} from "@/lib/async";
import {Chip, CircularProgress, FormControlLabel, FormGroup, LinearProgress, Switch} from "@mui/material";
import {getRedirectProps} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";
import {logClick, logPageView} from "@/lib/tracker";
import {groupBySet, isFeatureSematicSearchEnabled} from "@/lib/utils";
import {Strings} from "@/lib/strings";
import {getString, setString} from "@/lib/key_value_storage";
import {apiResponseOrRedirectProps} from "@/lib/core/ssr";

interface SearchProps {
    q: string,
    start: number,
    sematic: boolean,
    searchResponse: SearchResponse<DocumentWindow>,
    isFeatureSematicSearchEnabled: boolean,
}

const youtubeWindowIdRegex = new RegExp("^yt_(.{11})_(\\d+)_(\\d+)$")
const phapquangWindowIdRegex = new RegExp("^pq_(\\d+)_(\\d+)_(\\d+)$")
const facebookWindowIdRegex = new RegExp("^fb_(\\d+)_(\\d+)_(\\d+)$")

const perPageLimit = 10

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
    const aoxamService = getAoxamServiceV2(context)
    let q = context.query.q
    // incase we go search page directly via url, we rely on cookie to detect if this request is sematic search
    let sematic = isFeatureSematicSearchEnabled && getString("sematic", context) == "true"
    let sematicQuery = context.query.sematic == 'true'
    if (sematic != sematicQuery) {
        const fakeHost = "https://example.com"
        const newUrl = new URL(context.resolvedUrl, fakeHost)
        newUrl.searchParams.set("sematic", String(sematic))
        const part = newUrl.toString().substring(fakeHost.length)
        console.log(`redirect ${sematicQuery} to ${sematic} ${part}`)
        return {
            redirect: {
                destination: part,
                permanent: false,
            },
        }
    }
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

    const [response, redirect] = await apiResponseOrRedirectProps(context, async () => {
        return await aoxamService.search(
            q as string,
            start,
            10,
            "<strong>",
            "</strong>",
            parseFirstString(context.query.prefixGroupId),
            sematic,
        )
    })

    if (!response) {
        return redirect
    }

    const props: { props: SearchProps } = {
        props: {
            q: q,
            start: start,
            sematic: sematic,
            searchResponse: response,
            isFeatureSematicSearchEnabled: isFeatureSematicSearchEnabled
        },
    }
    return props
}

function buildFilterQuery(filters: Array<Filter>): Record<string, string> {
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
    const [sematic, setSematic] = useState<boolean>(props.sematic ?? false)
    const [navigateAsync, setNavigateAsync] = useState<Async<boolean>>(new Uninitialized<boolean>())

    useEffect(() => {
        logPageView("search", {
            "q": props.q,
            "start": props.start,
            ...buildFilterParam(filters),
            "sematic": props.sematic,
            "filter_selected": filters.filter((f) => f.isSelected).length != 0
        })
        setString("sematic", String(props.sematic))
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
                    ...buildFilterQuery(filters),
                    sematic: sematic,
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
            if (match) {
                startMs = match[2]
            }
        }
        if (windowId.startsWith("pq_")) {
            const match = phapquangWindowIdRegex.exec(windowId)
            if (match) {
                startMs = match[2]
            }
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
            >
                {
                    hit._formatted.title ? <div
                        key={"title"}
                        dangerouslySetInnerHTML={{__html: hit._formatted.title}}
                    /> : hit.title
                }
            </Link>
            <div
                key={"content"}
                className={styles.hitDescription}
                dangerouslySetInnerHTML={{__html: hit._formatted.content}}
            ></div>
        </div>
    })
    const filterElements = filters.map((filter: Filter) => {
        return <>
            <Chip
                sx={{borderColor: "rgb(234,234,234)"}}
                color={filter.isSelected ? "primary" : "default"}
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
                            ...buildFilterQuery(newFilter),
                            sematic: sematic,
                        },
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
    const sematicNotAvailable = !navigateAsync.isLoading() && sematic && props.searchResponse.sematicSearch == false

    const sematicSwitchElement = props.isFeatureSematicSearchEnabled ? <>
        <FormGroup className={styles.sematicContainer}>
            <FormControlLabel
                control={
                    <Switch
                        disabled={sematicNotAvailable}
                        checked={sematic}
                        onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                            const checked = event.target.checked
                            setSematic(checked);
                            router.push({
                                pathname: `/search`,
                                query: {
                                    q: props.q,
                                    ...buildFilterQuery(filters),
                                    sematic: checked,
                                },
                            }).onAsync((async: Async<boolean>) => {
                                setNavigateAsync(async)
                            })
                        }}
                    />
                }
                label={
                    <>
                        <span className={styles.sematicSwitch}>
                            {
                                sematicNotAvailable ? "Tìm theo ngữ nghĩa (tạm thời không khả dụng)"
                                    : "Tìm theo ngữ nghĩa"
                            }
                            <Chip
                                disabled={sematicNotAvailable}
                                className={styles.sematicBeta}
                                label="BETA"
                                color={sematic ? "primary" : "default"}
                                size="small"
                            />
                        </span>
                    </>
                }/>
        </FormGroup>
    </> : <div key={"space sematic search"} style={{height: "10px"}}></div>

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
                    {
                        !navigateAsync.isLoading() ? <SearchIcon className={styles.searchIcon}/>
                            : <CircularProgress size={"24px"} className={styles.searchIcon} color="inherit"/>
                    }
                    <input type="text"
                           className={styles.searchBox}
                           onChange={onQueryChanged}
                           onKeyDown={handleSearchKeyDown}
                           value={displayQuery}/>
                </div>
                <div className={styles.filterContainer}>
                    <div className={styles.filterChipsContainer}>
                        {filterElements}
                    </div>
                    {sematicSwitchElement}
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
                                                ...buildFilterQuery(filters)
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
