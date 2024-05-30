import {Response} from "ts-retrofit";
import axios, {AxiosInstance} from "axios";
import {AuthService, getAuthService, getBrowserAuthService} from "@/lib/auth_service";
import {GetServerSidePropsContext} from "next/types";
import Const from "@/lib/constants";
import {
    PermissionTicketRepresentation,
    UserResourcePermissionResponse
} from "@/lib/aoxam-service/urp/user-resource-permission-response";
import {HttpError} from "@/lib/core/error";

export interface EchoResponse {
    host: string;
    method: string;
}

export interface SearchResponse<T> {
    hits: Array<T>,
    processingTimeMs: number,
    limit: number,
    offset: number,
    estimatedTotalHits?: number,
    filters?: Array<Filter>,
    sematicSearch?: boolean,
}

export interface Filter {
    queryName: string,
    queryNameDisplay: string,

    queryValue: string,
    queryValueDisplay: string,

    isSelected: boolean,
}

export interface DocumentWindow {
    id: string,
    title: string,
    description: string,
    slug: string,
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
    slug: string,
}

export interface ViewMedia {
    src: string,
    poster: string | undefined
}

export interface Post {
    title: string,
    url: string,
}

export interface PostsResponse {
    posts: Post[],
}

export interface ExternalTranscribeRequestStatus {
    videoId: string,
    videoTitle: string | undefined,
    manualSubtitleLink: string | undefined,
    whisperSubtitleLink: string | undefined,
}

export interface GetExternalTranscribeRequestResponse {
    list: ExternalTranscribeRequestStatus[]
}

export class AoxamService {
    private readonly axiosInstance: AxiosInstance
    private readonly authService: AuthService

    constructor(
        baseUrl: string,
        context: GetServerSidePropsContext | undefined,
    ) {
        this.axiosInstance = axios.create({
            baseURL: baseUrl,
        });
        if (context != undefined) {
            this.authService = getAuthService(context)
        } else {
            this.authService = getBrowserAuthService()
        }
        this.configAuthInterceptors()
    }

    async requestViewerAccess(): Promise<PermissionTicketRepresentation> {
        if (!this.authService?.getAccessToken()) {
            return Promise.reject(new HttpError(401))
        }
        const value = await this.axiosInstance.post<PermissionTicketRepresentation>(
            "/space/default/requestViewerAccess"
        )
        return value.data
    }

    async toggleTicket(
        requester: string,
        resource: string,
        scope: string,
    ): Promise<PermissionTicketRepresentation> {
        const value = await this.axiosInstance.post<PermissionTicketRepresentation>(
            "/admin/toggleTicket",
            {
                requester: requester,
                resource: resource,
                scope: scope,
            })
        return value.data
    }

    async getUserResourcePermissionResponse(): Promise<UserResourcePermissionResponse> {
        const response = await this.axiosInstance.get(
            "/admin/userResourcePermission"
        )
        return response.data
    }

    private configAuthInterceptors() {
        this.axiosInstance.interceptors.request.use(
            async (config) => {
                const accessToken = this.authService.getAccessToken()
                const apiKey = this.authService.getLegacyApiKey()
                if (accessToken) {
                    config.headers['Authorization'] = `Bearer ${accessToken}`;
                    // @ts-ignore
                    config._accessToken = accessToken
                }
                if (apiKey) {
                    config.headers[Const.KEY_LEGACY_API] = apiKey
                }
                return config;
            },
            (error) => {
                return Promise.reject(error);
            }
        );
        this.axiosInstance.interceptors.response.use(
            (response) => {
                return response;
            },
            async (error) => {
                const originalRequest = error.config;
                const token = originalRequest._accessToken
                if (error.response?.status == 401 && !originalRequest._retry) {
                    const newToken = await this.authService.refreshTokenFlow(token)
                    if (newToken && newToken != token) {
                        originalRequest._retry = true
                        return this.axiosInstance(originalRequest)
                    }
                }
                return Promise.reject(error);
            }
        );
    }

    async search(
        q: string | null,
        offset: number,
        limit: number,
        highlightPreTag: string | null,
        highlightPostTag: string | null,
        domain: string | undefined,
        ytChannel: string | undefined,
        fbProfileId: string | undefined,
        sematic: boolean | undefined,
    ): Promise<SearchResponse<DocumentWindow>> {
        const response = await this.axiosInstance.get<SearchResponse<DocumentWindow>>(
            "/search",
            this.notNullParams({
                q, offset, limit, highlightPreTag, highlightPostTag, domain,
                ytChannel, fbProfileId, sematic,
            })
        )
        return response.data
    }

    async searchFragment(
        docId: string,
        q: string | null,
        offset: number,
        limit: number,
        highlightPreTag: string | null,
        highlightPostTag: string | null,
    ): Promise<Response<SearchResponse<DocumentFragment>>> {
        return this.axiosInstance.get(
            "/searchFragment",
            this.notNullParams({
                docId, q, offset, limit, highlightPreTag, highlightPostTag,
            })
        )
    };

    async documentDetail(
        docId: string,
    ): Promise<Response<DocumentDetail>> {
        return this.axiosInstance.get(`doc/${encodeURIComponent(docId)}`)
    };

    async viewMedia(
        docId: string,
    ): Promise<Response<ViewMedia>> {
        return this.axiosInstance.get(`viewMedia`, this.notNullParams({docId}))
    };

    async posts(
        tag: string | undefined,
    ): Promise<Response<PostsResponse>> {
        return this.axiosInstance.get(`content`, this.notNullParams({tag}))
    };

    async check(
        key: string,
        value: string,
    ): Promise<Response<void>> {
        return this.axiosInstance.get(`check`, this.notNullParams({key, value}))
    };

    async getExternalVideoTranscribe(
        q: string,
    ): Promise<Response<GetExternalTranscribeRequestResponse>> {
        return this.axiosInstance.get(`externalVideoTranscribe`, this.notNullParams({q}))
    };

    async postExternalVideoTranscribe(
        q: string,
        rerun: boolean | undefined,
    ): Promise<Response<GetExternalTranscribeRequestResponse>> {
        return this.axiosInstance.post(`externalVideoTranscribe`, this.notNullParams({q, rerun}))
    };


    private notNullParams(params: any) {
        return {
            params: Object.fromEntries(
                Object.entries(params)
                    .filter(([_, value]) => value !== null && value !== undefined)
            ),
        }
    }

    async echoAuth(role: string): Promise<EchoResponse> {
        const response = await this.axiosInstance.get<EchoResponse>(
            `/echo/${role}`
        )
        return response.data
    };

    async echo(what: string): Promise<EchoResponse> {
        const response = await this.axiosInstance.get<EchoResponse>(
            `/echo/${what}`
        )
        return response.data
    };
}

const BrowserAoxamServiceV2 = new AoxamService(Const.NEXT_PUBLIC_API_HOST, undefined)

export function getBrowserAoxamServiceV2(): AoxamService {
    return BrowserAoxamServiceV2;
}

export function getAoxamServiceV2(context: GetServerSidePropsContext): AoxamService {
    // @ts-ignore
    let service: AoxamService = context.aoxamService
    if (service != undefined) {
        return service
    }
    service = new AoxamService(Const.INTERNAL_API_HOST, context)
    // @ts-ignore
    context.aoxamService = service
    return service
}