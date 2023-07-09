import '../../lib/async'
import {aoxamServiceInternal, DocumentFragment, SearchResponse} from "@/lib/aoxam_service";
import {GetServerSideProps} from "next";
import {Response} from "ts-retrofit";
import {getRedirectProps, parseLegacyApiKeyFromContext} from "@/lib/auth";
import {DocDetailProps} from "@/lib/doc_detail_common";
import FacebookPostDocumentDetail from "@/lib/facebook_post_doc_detail";
import YoutubeSubtitleDocumentDetail from "@/lib/youtube_subtitle_doc_detail";

export const getServerSideProps: GetServerSideProps<DocDetailProps> = async (context) => {
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

    const docRequest = aoxamServiceInternal.searchFragment(
        docId,
        "",
        0,
        999999,
        null,
        null,
        parseLegacyApiKeyFromContext(context),
    )
    let searchRequest: Promise<Response<SearchResponse<DocumentFragment>> | null> = Promise.resolve(null)
    if (q.length > 0) {
        searchRequest = aoxamServiceInternal.searchFragment(
            docId,
            q,
            0,
            999999,
            "<strong>",
            "</strong>",
            parseLegacyApiKeyFromContext(context),
        )
    }
    const docResponse = await docRequest
    const searchResponse = await searchRequest
    return {
        props: {
            "q": q,
            "docId": docId,
            "startMs": startMs,
            "docResponse": docResponse.data,
            "searchResponse": searchResponse?.data ?? null,
        },
    }
}

export default function DocumentDetail(props: DocDetailProps) {
    if (props.docId.startsWith("fb_")) {
        return <FacebookPostDocumentDetail props={props}/>
    } else if (props.docId.startsWith("yt_")) {
        return <YoutubeSubtitleDocumentDetail props={props}/>
    }
    throw new Error(`Unknown doc id: ${props.docId}`)
}