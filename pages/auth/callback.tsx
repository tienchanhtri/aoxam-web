import {useEffect} from "react";
import {OidcClient} from "oidc-client-ts";
import Const, {BrowserOidcClientConfig} from "@/lib/constants";
import {parseWindowUrl} from "@/lib/utils";
import {getBrowserAuthService} from "@/lib/auth_service";

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
                const axRedirectUrl = parseWindowUrl().searchParams.get("axRedirectUrl")
                if (axRedirectUrl) {
                    redirectUrl = axRedirectUrl
                }
            })
            .catch((e) => {
                console.error(e)
            })
            .finally(() => {
                window.location.href = redirectUrl
            })
    }, []);
}