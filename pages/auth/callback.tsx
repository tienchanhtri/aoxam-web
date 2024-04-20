import {useEffect} from "react";
import {OidcClient} from "oidc-client-ts";
import Const, {BrowserOidcClientConfig} from "@/lib/constants";
import {parseWindowUrl} from "@/lib/utils";
import {getBrowserAuthService} from "@/lib/auth_service";
import {logEvent} from "@/lib/tracker";

export default function AuthCallback() {
    let effectRan = false
    useEffect(() => {
        // prevent duplicate useEffect cause by react strict mode
        if (effectRan) {
            return
        }
        effectRan = true
        const client = new OidcClient(BrowserOidcClientConfig)
        let redirectUrl = Const.NEXT_PUBLIC_WEB_HOST
        client.processSigninResponse(window.location.href)
            .then((response) => {
                getBrowserAuthService().saveTokens(response)
                const token = getBrowserAuthService().getAccessTokenParsed()
                const axRedirectUrl = parseWindowUrl().searchParams.get("axRedirectUrl")
                logEvent("sign_in", {
                    "user_id": token?.sub,
                    "username": token?.preferred_username,
                    "success": true,
                    "page_name": "callback",
                })
                if (axRedirectUrl) {
                    redirectUrl = axRedirectUrl
                }
            })
            .catch((e) => {
                logEvent("sign_in", {
                    "success": false,
                    "error_message": e?.message,
                    "page_name": "callback",
                })
                console.error(e)
            })
            .finally(() => {
                window.location.href = redirectUrl
            })
    }, []);
}