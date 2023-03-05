import '@/styles/globals.css'
import type {AppProps} from 'next/app'
import * as smoothscroll from 'smoothscroll-polyfill';
import {useEffect} from "react";

export default function App({Component, pageProps}: AppProps) {
  useEffect(() => {
    smoothscroll.polyfill();
  })
  return <Component {...pageProps} />
}
