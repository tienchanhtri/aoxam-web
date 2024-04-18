import {useEffect} from "react";
import {OidcClient} from "oidc-client-ts";
import {parseWindowUrl} from "@/lib/utils";
import {BrowserOidcClientConfig} from "@/lib/constants";

export default function Auth() {
    let effectRan = false
    useEffect(() => {
        // prevent duplicate useEffect cause by react strict mode
        if (effectRan) {
            return
        }
        effectRan = true
        const client = new OidcClient(BrowserOidcClientConfig)
        const callbackUrl = new URL(BrowserOidcClientConfig.redirect_uri)
        const axRedirectUrl = parseWindowUrl().searchParams.get("axRedirectUrl")
        if (axRedirectUrl) {
            callbackUrl.searchParams.append("axRedirectUrl", axRedirectUrl)
        }
        console.log("callbackUrl", callbackUrl.href, callbackUrl)
        client.createSigninRequest({
            redirect_uri: callbackUrl.href,
        }).then((req) => {
            window.location.href = req.url
        })
    }, []);
    return <>
    </>
}