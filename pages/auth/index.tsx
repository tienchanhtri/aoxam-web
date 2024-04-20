import {useEffect} from "react";
import {OidcClient} from "oidc-client-ts";
import {parseWindowUrl} from "@/lib/utils";
import Const, {BrowserOidcClientConfig} from "@/lib/constants";
import {from, map, mergeMap} from "rxjs";
import {logEvent} from "@/lib/tracker";
import {CircularProgress} from "@mui/material";

export default function Auth() {
    useEffect(() => {
        const sub = from(
            Promise.resolve() // wait for next event loop to counter strict mode effect
        ).pipe(
            map(() => {
                console.log("process login")
                const client = new OidcClient(BrowserOidcClientConfig)
                const callbackUrl = new URL(BrowserOidcClientConfig.redirect_uri)
                const axRedirectUrl = parseWindowUrl().searchParams.get("axRedirectUrl")
                if (axRedirectUrl) {
                    callbackUrl.searchParams.append("axRedirectUrl", axRedirectUrl)
                    console.log("callbackUrl", callbackUrl.href, callbackUrl)
                }
                return [client, callbackUrl] as const
            }),
            mergeMap(([client, callbackUrl]) => {
                return client.createSigninRequest({
                    redirect_uri: callbackUrl.href,
                })
            })
        ).subscribe({
            next: (req) => {
                window.location.href = req.url
            },
            error: (value) => {
                logEvent("sign_in", {
                    "success": false,
                    "error_message": value?.message,
                    "page_name": "auth",
                })
                window.location.href = Const.NEXT_PUBLIC_WEB_HOST
            }
        })
        return () => {
            sub.unsubscribe()
        }
    }, []);
    return <div style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 64,
    }}>
        <CircularProgress/>
    </div>
}