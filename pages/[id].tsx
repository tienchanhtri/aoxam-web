import '../lib/async'
import {aoxamServiceInternal, DocumentFragment, SearchResponse} from "@/lib/aoxam_service";
import {GetServerSideProps} from "next";
import {Response} from "ts-retrofit";
import {getRedirectProps, parseLegacyApiKeyFromContext} from "@/lib/auth";
import {DocDetailProps} from "@/lib/doc_detail_common";
import FacebookPostDocumentDetail from "@/lib/facebook_post_doc_detail";
import YoutubeSubtitleDocumentDetail from "@/lib/youtube_subtitle_doc_detail";

function extractLastSegment(str: string): string {
    const segments = str.split('.');
    return segments[segments.length - 1];
}

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
    let slug = context.params?.id
    if (typeof slug !== 'string') {
        throw Error(`Invalid slug: ${slug}`)
    }
    let docId = extractLastSegment(slug)
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
    let documentDetailRequest = aoxamServiceInternal
        .documentDetail(docId, parseLegacyApiKeyFromContext(context))

    const docResponse = await docRequest
    const searchResponse = await searchRequest
    const documentDetail = await documentDetailRequest

    // redirect to the right slug
    if (documentDetail.data.slug !== slug) {
        let destination = `/${documentDetail.data.slug}`
        let queryIndex = context.resolvedUrl.indexOf("?")
        if (queryIndex !== -1) {
            destination = `/${documentDetail.data.slug}${context.resolvedUrl.substring(queryIndex)}`
        }
        return {
            redirect: {
                destination: destination,
                permanent: false,
            }
        }
    }

    return {
        props: {
            "q": q,
            "docId": docId,
            "startMs": startMs,
            "docResponse": docResponse.data,
            "searchResponse": searchResponse?.data ?? null,
            "documentDetail": documentDetail.data
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