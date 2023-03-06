import Head from 'next/head'
import {useRouter} from "next/router";
import {ChangeEventHandler, Fragment, useState} from "react";
import '../async'
import * as process from "process";
import {aoxamService, DocumentWindow, SearchResponse} from "@/pages/aoxam_service";
import Link from "next/link";
import {NextPageContext} from "next";

interface SearchProps {
    q: string,
    start: number,
    searchResponse: SearchResponse<DocumentWindow>,
}

const windowIdRegex = new RegExp("^yt_(.{11})_(\\d+)_(\\d+)$")

const perPageLimit = 10

export async function getServerSideProps(context: NextPageContext): Promise<{ props: SearchProps }> {
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

    const response = await aoxamService.search(
        q as string,
        start,
        10,
        "<strong>",
        "</strong>"
    )
    return {
        props: {
            q: q,
            start: start,
            searchResponse: response.data
        },
    }
}

export default function Search(props: SearchProps) {
    const isEndOfResult = props.searchResponse.hits.length < perPageLimit
    const hits = props.searchResponse.hits


    const router = useRouter()

    const [query, setQuery] = useState<string>(props.q)

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
    }

    const handleSearchKeyDown = (event: { key: string; }) => {
        if (event.key === 'Enter') {
            // noinspection JSIgnoredPromiseFromCall
            router.push({
                pathname: `/search`,
                query: {
                    q: query,
                }
            })
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
        return <Fragment key={hit.id}>
            <Link
                key={"link"}
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
            <p key={"description"} dangerouslySetInnerHTML={{__html: hit.formatted.description}}></p>
        </Fragment>
    })
    const estimatedTotalHits = props.searchResponse.estimatedTotalHits
    console.log(`hit size: ${hits.length} estimatedTotalHits: ${estimatedTotalHits}`)
    let title = "Áo Xám Search"
    if (props.q) {
        title += ` - ${props.q}`
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
                    !isEndOfResult ? <Link
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
                    >Next page</Link> : null
                }
            </main>
        </>
    )
}
