import {GetServerSidePropsContext} from "next/types";
import {isVoySub} from "@/lib/utils";
import {getAuthService} from "@/lib/auth_service";
import Const from "@/lib/constants";

export const redirectToHome = {
    redirect: {
        destination: '/',
        permanent: false,
    },
}

export function redirectToAuthThenCurrentContext(context: GetServerSidePropsContext) {
    const authUrl = new URL(`${Const.NEXT_PUBLIC_WEB_HOST}auth`)
    const redirectUrl = new URL(`${Const.NEXT_PUBLIC_WEB_HOST}${context.resolvedUrl}`)
    authUrl.searchParams.append("axRedirectUrl", redirectUrl.toString())
    return {
        redirect: {
            destination: authUrl.toString(),
            permanent: false,
        },
    }
}

export async function getRedirectProps(context: GetServerSidePropsContext) {
    if (isVoySub) {
        return undefined
    }

    const authService = getAuthService(context)
    const accessToken = authService.getAccessTokenParsed()
    const refreshToken = authService.getRefreshToken()
    const hasValidTokenPair = refreshToken != undefined || accessToken != undefined
    const hasLegacyApiKey = authService.getLegacyApiKey() != undefined

    if (hasValidTokenPair || hasLegacyApiKey) {
        return undefined
    }

    return redirectToAuthThenCurrentContext(context)
}