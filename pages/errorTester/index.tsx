import Head from 'next/head'
import React from "react";
import '../../lib/async'
import {getRedirectProps} from "@/lib/auth";
import {GetServerSidePropsContext} from "next/types";

interface ErrorTesterProps {
    q: string,
}

function randomIntFromInterval(min: number, max: number) { // min and max included
    return Math.floor(Math.random() * (max - min + 1) + min)
}

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const redirectProps = await getRedirectProps(context)
    if (redirectProps) {
        return redirectProps
    }
    const r = randomIntFromInterval(1, 100)
    if (r % 2 == 0) {
        throw Error(`even number: ${r}`)
    }
    const props: { props: ErrorTesterProps } = {
        props: {
            q: r.toString(),
        },
    }
    return props
}

export default function ErrorTester(props: ErrorTesterProps) {
    return (
        <>
            <Head>
                <title>Error Tester</title>
            </Head>
            <main>
                <button
                    type="button"
                    onClick={() => {
                        throw new Error("Sentry Frontend Error");
                    }}
                >
                    Throw error for {props.q}
                </button>
            </main>
        </>
    )
}
