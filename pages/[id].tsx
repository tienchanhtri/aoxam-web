import '../lib/async'
import {GetServerSideProps} from "next";
import {getRedirectProps} from "@/lib/auth";
import {DocDetailProps} from "@/lib/doc_detail_common";
import FacebookPostDocumentDetail from "@/lib/facebook_post_doc_detail";
import YoutubeSubtitleDocumentDetail from "@/lib/youtube_subtitle_doc_detail";
import {getString} from "@/lib/key_value_storage";
import {getAoxamServiceV2} from "@/lib/aoxam_service";
import {apiResponseOrRedirectProps} from "@/lib/core/ssr";

function extractPrefixId(str: string): string {
    const segments = str.split('.');
    return `${segments[segments.length - 2]}.${segments[segments.length - 1]}`;
}

export const getServerSideProps: GetServerSideProps<DocDetailProps> = async (context) => {
    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }

    const aoxamService = getAoxamServiceV2(context)

    let showTimestamp = getString("showTimestamp", context) == "true"
    let showTimestampQuery = context.query.showTimestamp == 'true'
    if (showTimestamp != showTimestampQuery) {
        const fakeHost = "https://example.com"
        const newUrl = new URL(context.resolvedUrl, fakeHost)
        newUrl.searchParams.set("showTimestamp", String(showTimestamp))
        const part = newUrl.toString().substring(fakeHost.length)
        console.log(`redirect ${showTimestampQuery} to ${showTimestamp} ${part}`)
        return {
            redirect: {
                destination: part,
                permanent: false,
            },
        }
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
    let prefixId = extractPrefixId(slug)
    let startMs: number = 0
    const startQuery = context.query.startMs
    if (typeof startQuery === 'string') {
        const startNumber = parseInt(startQuery)
        if (startNumber > 0) {
            startMs = startNumber
        }
    }

    const docRequest = apiResponseOrRedirectProps(context, async () => {
        return await aoxamService.searchFragment(
            prefixId,
            "",
            0,
            999999,
            null,
            null,
        )
    })

    let documentDetailRequest = apiResponseOrRedirectProps(context, async () => {
        return aoxamService.documentDetail(prefixId)
    })

    let viewMediaRequest = null
    if (prefixId.startsWith("pq.")) {
        viewMediaRequest = apiResponseOrRedirectProps(context, async () => {
            return aoxamService.viewMedia(prefixId)
        })
    }

    const [docResponse, docResponseRedirect] = await docRequest
    if (!docResponse) {
        return docResponseRedirect
    }
    const [documentDetail, documentDetailRedirect] = await documentDetailRequest
    if (!documentDetail) {
        return documentDetailRedirect
    }

    let viewMediaResponse = null
    if (viewMediaRequest != null) {
        const [viewMedia, viewMediaRedirect] = await viewMediaRequest
        if (!viewMedia) {
            return viewMediaRedirect
        }
        viewMediaResponse = viewMedia
    }

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
            "prefixId": prefixId,
            "startMs": startMs,
            "docResponse": docResponse.data,
            "documentDetail": documentDetail.data,
            "showTimestamp": showTimestamp,
            viewMedia: viewMediaResponse?.data ?? null,
        } as DocDetailProps,
    }
}

export default function DocumentDetail(props: DocDetailProps) {
    if (props.prefixId.startsWith("fb.")) {
        return <FacebookPostDocumentDetail props={props}/>
    } else if (props.prefixId.startsWith("yt.") || props.prefixId.startsWith("pq.")) {
        return <YoutubeSubtitleDocumentDetail props={props}/>
    }
    throw new Error(`Unknown doc id: ${props.prefixId}`)
}