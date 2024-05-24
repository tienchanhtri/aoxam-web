import {DocumentDetail, DocumentFragment, SearchResponse, ViewMedia} from "@/lib/aoxam_service";

export interface DocDetailProps {
    q: string,
    docId: string,
    startMs: number,
    docResponse: SearchResponse<DocumentFragment>,
    documentDetail: DocumentDetail,
    viewMedia: ViewMedia | undefined,
    showTimestamp: boolean,
}