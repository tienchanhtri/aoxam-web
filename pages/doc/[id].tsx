import Head from 'next/head'
import {useRouter} from "next/router";
import {useEffect, useState} from "react";
import '../async'
import {AbortController} from "next/dist/compiled/@edge-runtime/primitives/abort-controller";
import {Async, Uninitialized} from "@/pages/async";
import {aoxamService, DocumentFragment, SearchResponse} from "@/pages/aoxam_service";

export default function DocumentDetail() {
    const router = useRouter()
    const [fragmentsAsync, setFragmentsAsync] = useState<Async<SearchResponse<DocumentFragment>>>(
        new Uninitialized<SearchResponse<DocumentFragment>>()
    )

    function resolveDocId(): string {
        return router.query.id as string ?? ""
    }

    useEffect(() => {
        if (!router.isReady) {
            return
        }
        const ac = new AbortController()
        aoxamService.searchFragment(resolveDocId(), "", 0, 999999, "<strong>", "</strong>")
            .abortWith(ac)
            .then((response) => {
                return response.data
            })
            .abortWith(ac)
            .execute(ac, fragmentsAsync.value, (async) => {
                setFragmentsAsync(async)
            })
        return () => {
            ac.abort()
        }
    }, [router.isReady])

    const fragments = [...fragmentsAsync.value?.hits ?? []].sort((a, b) => {
        const aMs = a.startMs ?? -1
        const bMs = b.startMs ?? -1
        return aMs > bMs ? 1 : aMs < bMs ? -1 : 0
    }).map((hit) => {
        return <>
            <p>{hit.description}</p>
        </>
    })

    return (
        <>
            <Head>
                <title>Aoxam doc {resolveDocId()}</title>
            </Head>
            <main>
                <>
                    <p>Document id: {resolveDocId()}</p>
                    {fragments.length}
                    {fragments}
                </>
            </main>
        </>
    )
}
