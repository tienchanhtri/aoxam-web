import '@/styles/globals.css'
import type {AppProps} from 'next/app'
import * as smoothscroll from 'smoothscroll-polyfill';
import {useEffect} from "react";
import Head from "next/head";

export default function App({Component, pageProps}: AppProps) {
    useEffect(() => {
        smoothscroll.polyfill();
    })
    return <>
        <Head>
            <meta name="viewport" content="initial-scale=1, maximum-scale=1"/>
        </Head>
        <Component {...pageProps} />
    </>
}
