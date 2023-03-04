import {BaseService, GET, Query, Response, ServiceBuilder} from "ts-retrofit";
import * as process from "process";

export interface SearchResponse<T> {
    hits: Array<T>,
    processingTimeMs: number,
    limit: number,
    offset: number,
    estimatedTotalHits?: number,
}

export interface DocumentWindow {
    id: string,
    description: string,
    formatted: DocumentWindowFormatted,
}

export interface DocumentWindowFormatted {
    description: string,
}


export class AoxamService extends BaseService {
    @GET("/search")
    async search(
        @Query('q') q: string | null,
        @Query('offset') offset: number,
        @Query('limit') limit: number,
        @Query('highlightPreTag') highlightPreTag: string | null,
        @Query('highlightPostTag') highlightPostTag: string | null,
    ): Promise<Response<SearchResponse<DocumentWindow>>> {
        return <Response<SearchResponse<DocumentWindow>>>{}
    };
}

export const aoxamService: AoxamService = new ServiceBuilder()
    .setEndpoint(process.env.NEXT_PUBLIC_API_HOST!!)
    .setStandalone(true)
    .build(AoxamService);