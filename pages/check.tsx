import '../lib/async'
import {aoxamServiceInternal} from "@/lib/aoxam_service";
import {GetServerSideProps} from "next";
import {isLegacyApiKeyValid, parseLegacyApiKeyFromContext} from "@/lib/auth";
import {DocDetailProps} from "@/lib/doc_detail_common";

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

    const legacyApi = parseLegacyApiKeyFromContext(context)

    let checkRequest = Promise.resolve(true)
    if (legacyApi) {
        checkRequest = isLegacyApiKeyValid(legacyApi, aoxamServiceInternal)
    }

    const searchFragmentRequest = aoxamServiceInternal.searchFragment(
        docId,
        q,
        0,
        999999,
        null,
        null,
        legacyApi,
    )

    const searchRequest = aoxamServiceInternal.search(
        q,
        0,
        999999,
        "<strong>",
        "</strong>",
        legacyApi,
        undefined,
        undefined,
        undefined,
        false,
    )

    let documentDetailRequest = aoxamServiceInternal
        .documentDetail(docId, legacyApi)

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