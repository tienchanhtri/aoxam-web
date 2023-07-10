import {DocumentDetail, DocumentFragment, SearchResponse} from "@/lib/aoxam_service";

export interface DocDetailProps {
    q: string,
    docId: string,
    startMs: number,
    docResponse: SearchResponse<DocumentFragment>,
    searchResponse: SearchResponse<DocumentFragment> | null,
    documentDetail: DocumentDetail,
}