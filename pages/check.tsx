import '../lib/async'
import {GetServerSideProps} from "next";
import {DocDetailProps} from "@/lib/doc_detail_common";
import {getAoxamServiceV2} from "@/lib/aoxam_service";
import {getAuthService} from "@/lib/auth_service";

export interface CheckProps {
}

export const getServerSideProps: GetServerSideProps<CheckProps> = async (context) => {
    let q = context.query.q

    if (typeof q !== 'string') {
        throw Error(`Invalid q: ${q}`)
    }

    let docId = context.query.docId

    if (typeof docId !== 'string') {
        throw Error(`Invalid docId: ${docId}`)
    }

    const authService = getAuthService(context)

    const checkRequest = authService.isLegacyApiKeyValid()

    const aoxamService = getAoxamServiceV2(context)

    const searchFragmentRequest = aoxamService.searchFragment(
        docId,
        q,
        0,
        999999,
        null,
        null,
    )

    const searchRequest = aoxamService.search(
        q,
        0,
        999999,
        "<strong>",
        "</strong>",
        undefined,
        false,
    )

    let documentDetailRequest = aoxamService
        .documentDetail(docId)

    await checkRequest;
    await searchFragmentRequest;
    await searchRequest;
    await documentDetailRequest;

    const res = context.res
    res.setHeader("Content-Type", "application/json");
    res.write(JSON.stringify({"status": "ok"}));
    res.end();
    return {
        props: {},
    }
}

export default function CheckPage(props: DocDetailProps) {
    return <></>
}