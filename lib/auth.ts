import {AoxamService, aoxamService, aoxamServiceInternal} from "@/lib/aoxam_service";
import {GetServerSidePropsContext} from "next/types";
import {isVoySub} from "@/lib/utils";

const cookie = require('cookie-cutter');

const redirectToHome = {
    redirect: {
        destination: '/',
        permanent: false,
    },
}

export async function getRedirectProps(context: GetServerSidePropsContext) {
    if (isVoySub) {
        return null
    }
    const legacyApiKey = parseLegacyApiKeyFromContext(context)
    if (!legacyApiKey) {
        return redirectToHome
    }
    try {
        const keyValid = await isLegacyApiKeyValid(legacyApiKey, aoxamServiceInternal)
        if (!keyValid) {
            return redirectToHome
        }
    } catch (e) {
        console.error(e)
        return redirectToHome
    }
    return null
}

export async function isLegacyApiKeyValid(value: string | null, service: AoxamService | null = null) {
    if (!value) {
        return false
    }
    try {
        const response = await (service ?? aoxamService).check("legacyApiKey", value)
        if (response.status !== 204) {
            return false
        }
    } catch (e) {
        console.log("error when check isLegacyApiKeyValid")
        console.error(e)
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

export function parseLegacyApiKeyFromLocalStorage(): string | null {
    return localStorage.getItem("legacyApiKey")
}

export function setLegacyApiKey(value: string) {
    cookie.set("legacyApiKey", value, {expires: new Date(9999, 1, 1)})
    localStorage.setItem("legacyApiKey", value)
}