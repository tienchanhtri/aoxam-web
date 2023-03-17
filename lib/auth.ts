import {aoxamService} from "@/lib/aoxam_service";
import {GetServerSidePropsContext} from "next/types";

const cookie = require('cookie-cutter');

const redirectToHome = {
    redirect: {
        destination: '/',
        permanent: false,
    },
}

export async function getRedirectProps(context: GetServerSidePropsContext) {
    const legacyApiKey = parseLegacyApiKeyFromContext(context)
    if (!legacyApiKey) {
        return redirectToHome
    }
    try {
        const keyValid = await isLegacyApiKeyValid(legacyApiKey)
        if (!keyValid) {
            return redirectToHome
        }
    } catch (e) {
        return redirectToHome
    }
    return null
}

export async function isLegacyApiKeyValid(value: string | null) {
    if (!value) {
        return false
    }
    try {
        const response = await aoxamService.check("legacyApiKey", value)
        if (response.status !== 204) {
            return false
        }
    } catch (e) {
        return false
    }
    return true
}

export function parseLegacyApiKeyFromContext(context: GetServerSidePropsContext): string | null {
    return context.req.cookies["legacyApiKey"] ?? null
}

export function parseLegacyApiKeyFromCookie(): string | null {
    return cookie.get("legacyApiKey")
}