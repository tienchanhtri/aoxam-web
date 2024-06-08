import {DocDetailProps} from "@/lib/doc_detail_common";
import Head from "next/head";
import styles from "../styles/Doc.module.css"
import {DocumentFragment, getBrowserAoxamServiceV2, SearchResponse} from "@/lib/aoxam_service";
import {ChangeEventHandler, KeyboardEventHandler, useEffect, useRef, useState} from "react";
import {Async, Uninitialized} from "@/lib/async";
import {sleep} from "@/lib/utils";
import {logEvent} from "@/lib/tracker";
import {LinearProgress} from "@mui/material";
import {NextPage} from "next";
import {Strings} from "@/lib/strings";

const facebookWindowIdRegex = new RegExp("^fb.(\\d+)$")

const FacebookPostDocumentDetail: NextPage<{ props: DocDetailProps }> = (propsWrapper: { props: DocDetailProps }) => {
    const props = propsWrapper.props
    const postId = facebookWindowIdRegex.exec(props.prefixId)!![1]

    const [searchRequest, setSearchRequest] = useState<Async<SearchResponse<DocumentFragment>>>(
        new Uninitialized()
    )
    const [query, setQuery] = useState<string>(props.q ?? "")
    const inputRef = useRef<HTMLInputElement>(null)
    const searchRequestACRef = useRef<AbortController | null>(null)

    const docHits = props.docResponse.hits

    const searchRequestMapping = new Map<string, DocumentFragment>()
    const searchHits = searchRequest.value?.hits ?? []
    searchHits.forEach((hit) => {
        searchRequestMapping.set(hit.id, hit)
    })

    useEffect(() => {
        if (props.q.length > 0) {
            makeSearchRequest(props.q, 0, "page_load")
        }
    }, []);

    const onQueryChanged: ChangeEventHandler<HTMLInputElement> = (event) => {
        setQuery(event.target.value)
        makeSearchRequest(event.target.value, 350, "user_type")
    }

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
                return getBrowserAoxamServiceV2().searchFragment(
                    props.prefixId,
                    q,
                    0,
                    999999,
                    "<strong>",
                    "</strong>",
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

    const handleSearchKeyDown: KeyboardEventHandler<HTMLInputElement> = (event) => {
        if (event.key === 'Enter') {
            (event.target as HTMLElement).blur()
            makeSearchRequest(query, 0, "user_enter")
        }
    };

    const fragments = docHits.map((hit, hitIndex) => {
        let para
        const matchDoc = searchRequestMapping.get(hit.id)
        let cueContainerClassName = styles.cueContainer
        let cueRef = null

        if (query.length > 0 && matchDoc !== undefined) {
            // improvement: remove the p tag
            para = <div
                key={"text"}
                className={styles.facebookPostText}
                dangerouslySetInnerHTML={{__html: matchDoc._formatted.content}}>
            </div>
        } else {
            para = <div
                key={"text"}
                className={styles.facebookPostText}
            >
                {hit.content}
            </div>
        }

        return <div
            key={hit.id}
            ref={cueRef}
            className={cueContainerClassName}
        >
            {para}
        </div>
    })

    let searchProgress = null
    if (searchRequest.isLoading()) {
        searchProgress = <LinearProgress className={styles.searchProgress}/>
    }

    return <>
        <Head>
            <title>{props.documentDetail.title}</title>
        </Head>
        <main>
            <div className={styles.main}>
                <div className={styles.contentTopFacebookPost}>
                    <iframe
                        className={styles.contentTopFacebookIframe}
                        src={`https://www.facebook.com/plugins/post.php?href=https%3A%2F%2Ffacebook.com%2F100011332746607%2Fposts%2F${postId}&show_text=true&width=500`}
                        width="500"
                        height="316"
                        allowFullScreen={true}
                        allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share">
                    </iframe>
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
                        placeholder={Strings.docSearchPlaceHolder}
                        type={"text"}
                        value={query}
                        onChange={onQueryChanged}
                        onKeyDown={handleSearchKeyDown}
                    />
                </div>
            </div>
        </main>
    </>
}

export default FacebookPostDocumentDetail