import '@/styles/globals.css'
import type {AppProps} from 'next/app'
import * as smoothscroll from 'smoothscroll-polyfill';
import {useEffect} from "react";
import Head from "next/head";
import {getFirebaseAnalytic} from "@/lib/firebase";
import {init, setUserId as setAmplitudeUserId} from "@amplitude/analytics-browser";
import {getBrowserAuthService} from "@/lib/auth_service";
import Const from "@/lib/constants";
import {setUserId as setFirebaseAnalyticUserId} from "@firebase/analytics";

export default function App({Component, pageProps}: AppProps) {
    useEffect(() => {
        smoothscroll.polyfill();
        if (!Const.NEXT_PUBLIC_LOCAL_MACHINE) {
            getFirebaseAnalytic()
        }
        init(Const.NEXT_PUBLIC_AMPLITUDE_API_KEY)
        getBrowserAuthService().syncTokens()
        const sub = getBrowserAuthService().getAccessTokenParsedStream()
            .subscribe({
                next: (value) => {
                    if (!Const.NEXT_PUBLIC_LOCAL_MACHINE) {
                        setAmplitudeUserId(value?.sub)
                        setFirebaseAnalyticUserId(getFirebaseAnalytic(), value?.sub ?? null)
                    }
                }
            })
        return () => {
            sub.unsubscribe()
        }
    }, [])

    return <>
        <Head>
            <meta name="viewport" content="initial-scale=1, maximum-scale=1"/>
        </Head>
        <Component {...pageProps} />
    </>
}
