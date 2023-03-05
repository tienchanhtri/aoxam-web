import Head from 'next/head'
import {useRouter} from "next/router";
import {ChangeEventHandler, useEffect, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {Async, Uninitialized} from "@/pages/async";
import * as process from "process";
import {aoxamService, DocumentWindow, SearchResponse} from "@/pages/aoxam_service";
import Link from "next/link";

interface SearchProps {
    name: String
}

const windowIdRegex = new RegExp("^yt_(.{11})_(\\d+)_(\\d+)$")

export default function Search(props: SearchProps) {
    const router = useRouter()

    function resolveQuery(): string {
        return router.query.q as string ?? ""
    }

    const [query, setQuery] = useState<string>(resolveQuery())
    const [summitedQuery, setSubmittedQuery] = useState<string | null>(query)
    const limit = 20 // 20 document per page
    const [offset, setOffset] = useState<number>(0)
    const [searchRequestAC, setSearchRequestAC] = useState<AbortController | null>(null)
    const [hits, setHits] = useState<Array<DocumentWindow>>([])
    const [searchAsync, setSearchAsync] = useState<Async<SearchResponse<DocumentWindow>>>(new Uninitialized<SearchResponse<DocumentWindow>>())
    const [isEndOfResult, setIsEndOfResult] = useState(false)


    useEffect(() => {
        if (!router.isReady) {
            return
        }
        const q = resolveQuery()
        setQuery(q)
        setSubmittedQuery(q)
        if (q) {
            loadMoreSearchResult(q)
        }
    }, [router.isReady])

    function submitNewSearch(q: string) {
        // noinspection JSIgnoredPromiseFromCall
        router.push(
            {
                pathname: "/search",
                query: {
                    q: q
                }
            }
        )
        setSubmittedQuery(q)
        setHits([])
        setOffset(0)
        setSearchAsync(new Uninitialized())
        setIsEndOfResult(false)
        loadSearchResult(true, q, 0)
    }

    function loadMoreSearchResult(q: string) {
        if (isEndOfResult) {
            return
        }
        loadSearchResult(false, q, offset ?? 0)
    }

    function loadSearchResult(
        ignoreIfLoading: boolean,
        q: string,
        searchOffset: number,
    ) {
        if (ignoreIfLoading && searchAsync.isLoading()) {
            return
        }
        console.log(`load more q: ${q} offset: ${searchOffset}`)
        searchRequestAC?.abort()
        const ac = new AbortController()
        setSearchRequestAC(ac)

        aoxamService.search(q, searchOffset, limit, "<strong>", "</strong>")
            .abortWith(ac)
            .then((response) => {
                return response.data
            })
            .abortWith(ac)
            .execute(ac, searchAsync?.value, (async: Async<SearchResponse<DocumentWindow>>) => {
                if (async.isSucceed()) {
                    setHits(prevHits => [...prevHits, ...async.value?.hits ?? []])
                    setOffset(prevOffset => +prevOffset + limit)
                    const currentHitCount = async.value?.hits?.length ?? 0
                    if (currentHitCount < limit) {
                        setIsEndOfResult(true)
                    }
                }
                setSearchAsync(async)
            })
    }

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
    }

    const handleSearchKeyDown = (event: { key: string; }) => {
        if (event.key === 'Enter') {
            submitNewSearch(query)
        }
    };

    const hitElements = hits.map((hit) => {
        const windowId = hit.id
        if (!windowId.startsWith("yt_")) {
            throw new Error("Unknown window id format")
        }
        const match = windowIdRegex.exec(windowId)
        if (match == null) {
            throw Error(`Invalid window id: ${windowId}`)
        }
        const documentId = hit.id.substring(0, 14)
        const startMs = match[2]
        return <>
            <Link
                scroll
                href={
                    {
                        pathname: `/doc/${documentId}`,
                        query: {
                            startMs: startMs
                        }
                    }
                }
            >
                Title for doc: {documentId}
            </Link>
            <p key={hit.id} dangerouslySetInnerHTML={{__html: hit.formatted.description}}></p>
        </>
    })
    const estimatedTotalHits = searchAsync.value?.estimatedTotalHits
    console.log(`hit size: ${hits.length} estimatedTotalHits: ${estimatedTotalHits}`)
    let title = "Áo Xám Search"
    if (summitedQuery) {
        title += ` - ${summitedQuery}`
    }
    return (
        <>
            <Head>
                <title>{title}</title>
            </Head>
            <main>
                <p>Hello world search, query: {router.query.q}</p>
                <p>API host is {process.env.NEXT_PUBLIC_API_HOST}</p>
                <input type="text"
                       onChange={onQueryChanged}
                       onKeyDown={handleSearchKeyDown}
                       value={query}/>
                {
                    estimatedTotalHits != null ?
                        <p>Estimate hit: {estimatedTotalHits}</p> : null
                }
                {hitElements}
                {
                    !isEndOfResult ? <button onClick={() => loadMoreSearchResult(query)}>Load more</button> : null
                }

            </main>
        </>
    )
}
