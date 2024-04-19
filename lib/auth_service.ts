import {GetServerSidePropsContext} from "next/types";
import {LocalMutex} from "@/lib/local_mutex";
import {runCatchingOrNull, runCatchingOrNullAsync} from "@/lib/std";
import {jwtDecode} from "jwt-decode";
import {getStringObservable, getStringUndefinedIfEmpty, removeString, setString} from "@/lib/key_value_storage";
import Const, {BrowserOidcClientConfig} from "@/lib/constants";
import axios, {AxiosError, AxiosInstance} from "axios";
import {OidcClient, SigninResponse} from "oidc-client-ts";
import {KeycloakTokenParsed} from "keycloak-js";
import {map, Observable} from "rxjs";
import {HttpError} from "@/lib/core/error";

export interface TokenParsed extends KeycloakTokenParsed {
    preferred_username: string
}

export class AuthService {
    private readonly context: GetServerSidePropsContext | undefined
    private readonly mutex: LocalMutex
    private readonly authAxios: AxiosInstance
    private readonly checkAxios: AxiosInstance
    private oidcClient: OidcClient | undefined

    constructor(context: GetServerSidePropsContext | undefined = undefined) {
        this.context = context
        this.mutex = new LocalMutex(30000)
        this.authAxios = axios.create({
            baseURL: Const.NEXT_PUBLIC_OIDC_CLIENT_AUTHORITY,
        });
        if (context) {
            this.checkAxios = axios.create({baseURL: Const.INTERNAL_API_HOST})
        } else {
            this.checkAxios = axios.create({baseURL: Const.NEXT_PUBLIC_API_HOST})
        }
    }

    async isLegacyApiKeyValid(): Promise<boolean> {
        const value = this.getLegacyApiKey()
        if (!value) {
            return false
        }
        try {
            const response = await this.checkAxios.get(`check`, {
                params: {
                    "key": "legacyApiKey",
                    "value": value,
                },
            })
            if (response.status !== 204) {
                return false
            }
        } catch (e) {
            return false
        }
        return true
    }

    private requireOidcClient(): OidcClient {
        let client = this.oidcClient
        if (client != undefined) {
            return client
        }
        client = new OidcClient(BrowserOidcClientConfig)
        this.oidcClient = client
        return client
    }

    getAccessTokenParsed(): TokenParsed | undefined {
        const token = this.getAccessToken()
        if (!token) {
            return undefined
        }
        return runCatchingOrNull(() => jwtDecode<TokenParsed>(token))
    }

    getAccessTokenParsedStream(): Observable<TokenParsed | undefined> {
        return getStringObservable(Const.KEY_AX_ACCESS_TOKEN)
            .pipe(
                map((token) => {
                    if (!token) {
                        return undefined
                    }
                    return runCatchingOrNull(() => jwtDecode<TokenParsed>(token))
                }),
            )
    }

    removeTokens() {
        removeString(Const.KEY_AX_ID_TOKEN)
        removeString(Const.KEY_AX_ACCESS_TOKEN)
        removeString(Const.KEY_AX_REFRESH_TOKEN)
    }

    async logout() {
        const refreshToken = this.getRefreshToken()
        const idToken = this.getIdToken()
        this.removeTokens()
        if (!refreshToken) {
            return
        }
        await runCatchingOrNullAsync(async () => {
            await this.requireOidcClient()
                .createSignoutRequest()
                .then((req) => {
                    const url = new URL(req.url)
                    const params = new URLSearchParams()
                    if (idToken) {
                        params.append("id_token_hint", idToken)
                    }
                    params.append("client_id", Const.NEXT_PUBLIC_OIDC_CLIENT_ID)
                    params.append("refresh_token", refreshToken)
                    return axios.post(url.href, params)
                })
        })
    }

    getAccessToken(): string | undefined {
        return getStringUndefinedIfEmpty(Const.KEY_AX_ACCESS_TOKEN, this.context)
    }

    getLegacyApiKey(): string | undefined {
        return getStringUndefinedIfEmpty(Const.KEY_LEGACY_API, this.context) ?? this.getLegacyApiKeyFromMeilisearch()
    }

    private getLegacyApiKeyFromMeilisearch(): string | undefined {
        if (typeof localStorage == "undefined") {
            return undefined
        }
        let meilisearchKey = localStorage.getItem("apiKey") ?? undefined
        if (meilisearchKey && meilisearchKey[0] === '"' && meilisearchKey[meilisearchKey.length - 1] === '"') {
            meilisearchKey = meilisearchKey.substring(1, meilisearchKey.length - 1)
        }
        if (meilisearchKey) {
            return meilisearchKey
        }
        return undefined
    }

    setLegacyApiKey(value: string) {
        setString(Const.KEY_LEGACY_API, value)
    }

    getRefreshToken(): string | undefined {
        return getStringUndefinedIfEmpty(Const.KEY_AX_REFRESH_TOKEN, this.context)
    }

    getIdToken(): string | undefined {
        return getStringUndefinedIfEmpty(Const.KEY_AX_ID_TOKEN, this.context)
    }

    private getLockName(refreshToken: string): string {
        if (this.context) {
            const headers = this.context.req.headers
            const jwt = runCatchingOrNull(() => {
                if (!refreshToken) {
                    return undefined
                }
                return jwtDecode(refreshToken)
            })
            return `refresh_token ${headers["x-forwarded-for"]} ${jwt?.sub}`
        } else {
            return "refresh_token local"
        }
    }

    private shouldRefreshEagerly(token: string | undefined, maxRemainMs: number | undefined) {
        if (token == undefined) {
            return true
        }
        if (maxRemainMs == undefined) {
            // incase we refresh from 401 flow, maxRemainMs will be undefined
            // => return false because we already have checked other condition
            return false
        }
        if (maxRemainMs == -1) {
            return true
        }
        const tokenParsed = runCatchingOrNull(() => jwtDecode(token))
        if (tokenParsed == undefined) {
            // invalid token => refresh
            return true
        }
        let exp = tokenParsed.exp
        if (exp == undefined) {
            // if exp is not define then assume token valid forever => no need to refresh
            // , or we wait for client making api call -> 401 -> refresh
            return false
        }
        exp = exp * 1000 // exp is in seconds

        // might want to get from ntp if device time is wrong
        const now = (new Date()).getTime()
        const remainMs = exp - now
        // noinspection RedundantIfStatementJS
        if (remainMs > maxRemainMs) {
            return false
        }
        return true
    }

    async refreshTokenFlow(
        rejectedToken: string | undefined = undefined,
        maxRemainMs: number | undefined = undefined,
    ) {
        let newToken = this.getAccessToken()
        if (newToken == undefined || newToken == rejectedToken || this.shouldRefreshEagerly(newToken, maxRemainMs)) {
            const refreshToken = this.getRefreshToken()
            if (refreshToken) {
                await this.mutex.withLock(this.getLockName(refreshToken), async () => {
                    newToken = this.getAccessToken()
                    if (newToken == undefined || newToken == rejectedToken || this.shouldRefreshEagerly(newToken, maxRemainMs)) {
                        await this.refreshToken()
                    }
                })
            }
        }
        return this.getAccessToken()
    }

    syncTokens() {
        // sync token from cookie to local storage
        // call in browser only
        const accessToken = this.getAccessToken()
        const refreshToken = this.getRefreshToken()
        const idToken = this.getIdToken()
        setString(Const.KEY_AX_ACCESS_TOKEN, accessToken ?? "")
        setString(Const.KEY_AX_REFRESH_TOKEN, refreshToken ?? "")
        setString(Const.KEY_AX_ID_TOKEN, idToken ?? "")
    }

    saveTokens(data: SigninResponse) {
        setString(Const.KEY_AX_ACCESS_TOKEN, data.access_token ?? "", this.context)
        setString(Const.KEY_AX_REFRESH_TOKEN, data.refresh_token ?? "", this.context)
        setString(Const.KEY_AX_ID_TOKEN, data.id_token ?? "", this.context)
    }

    private async refreshToken() {
        console.log(new Date(), "refresh_token_flow", this.getLockName(this.getRefreshToken() ?? ""))
        // await new Promise(resolve => setTimeout(resolve, 1500));
        const refreshToken = this.getRefreshToken()
        if (!refreshToken) {
            throw new HttpError(401)
        }
        const params = new URLSearchParams({
            "grant_type": "refresh_token",
            "client_id": Const.NEXT_PUBLIC_OIDC_CLIENT_ID,
            "refresh_token": refreshToken,
        })
        let tokenResponse
        try {
            tokenResponse = await this.authAxios.post("protocol/openid-connect/token", params)
        } catch (e) {
            if (e instanceof AxiosError) {
                const statusCode = e.response?.status
                if (statusCode == 400) {
                    // {error: "invalid_grant", error_description: "Stale token"}
                    this.removeTokens()
                }
            }
            throw e
        }
        const statusCode = tokenResponse.status
        if (statusCode != 200) {
            throw new HttpError(tokenResponse.status)
        }
        const data = tokenResponse.data
        this.saveTokens(data)
        console.log("refresh_token_flow done")
    }
}

let browserAuthService: AuthService

export function getBrowserAuthService(): AuthService {
    if (typeof browserAuthService != "undefined") {
        return browserAuthService
    }
    browserAuthService = new AuthService()
    return browserAuthService
}

export function getAuthService(context: GetServerSidePropsContext): AuthService {
    // @ts-ignore
    let service: AuthService = context.authService
    if (service != undefined) {
        return service
    }
    service = new AuthService(context)
    // @ts-ignore
    context.authService = service
    return service
}