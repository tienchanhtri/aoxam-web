import {BaseService, GET, Path, Query, Response, ServiceBuilder} from "ts-retrofit";
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
    title: string,
    description: string,
    formatted: DocumentWindowFormatted,
}

export interface DocumentWindowFormatted {
    description: string,
}

export interface DocumentFragment {
    id: string,
    description: string,
    startMs: number,
    endMs: number,
    formatted: DocumentFragmentFormatted,
}

export interface DocumentFragmentFormatted {
    description: string,
}

export interface DocumentDetail {
    docId: string,
    title: string,
}

export class AoxamService extends BaseService {
    @GET("search")
    async search(
        @Query('q') q: string | null,
        @Query('offset') offset: number,
        @Query('limit') limit: number,
        @Query('highlightPreTag') highlightPreTag: string | null,
        @Query('highlightPostTag') highlightPostTag: string | null,
        @Query('legacyApiKey') legacyApiKey: string | null,
        @Query('domain') domain: string | undefined,
    ): Promise<Response<SearchResponse<DocumentWindow>>> {
        return <Response<SearchResponse<DocumentWindow>>>{}
    };

    @GET("searchFragment")
    async searchFragment(
        @Query('docId') docId: string,
        @Query('q') q: string | null,
        @Query('offset') offset: number,
        @Query('limit') limit: number,
        @Query('highlightPreTag') highlightPreTag: string | null,
        @Query('highlightPostTag') highlightPostTag: string | null,
        @Query('legacyApiKey') legacyApiKey: string | null,
    ): Promise<Response<SearchResponse<DocumentFragment>>> {
        return <Response<SearchResponse<DocumentFragment>>>{}
    };

    @GET("doc/{docId}")
    async documentDetail(
        @Path('docId') docId: string,
        @Query('legacyApiKey') legacyApiKey: string | null,
    ): Promise<Response<DocumentDetail>> {
        return <Response<DocumentDetail>>{}
    };

    @GET("check")
    async check(
        @Query('key') key: string,
        @Query('value') value: string,
    ): Promise<Response<void>> {
        return <Response<void>>{}
    };
}

export const aoxamServiceInternal: AoxamService = new ServiceBuilder()
    .setStandalone(true)
    .setEndpoint(process.env.INTERNAL_API_HOST!!)
    .build(AoxamService);

export const aoxamService: AoxamService = new ServiceBuilder()
    .setStandalone(true)
    .setEndpoint(process.env.NEXT_PUBLIC_API_HOST!!)
    .build(AoxamService);