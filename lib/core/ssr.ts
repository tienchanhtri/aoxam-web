import {GetServerSidePropsContext} from "next/types";
import {AxiosError} from "axios";
import {redirectToAuthThenCurrentContext, redirectToHome} from "@/lib/auth";

export async function apiResponseOrRedirectProps<T>(
    context: GetServerSidePropsContext,
    block: () => Promise<T>
): Promise<readonly [T | undefined, any | undefined]> {
    try {
        const result = await block()
        return [result, undefined] as const
    } catch (error) {
        if (error instanceof AxiosError) {
            const statusCode = error.response?.status
            if (statusCode == 401) {
                const redirectProps = redirectToAuthThenCurrentContext(context)
                console.log("401 redirect to ", redirectProps)
                return [undefined, redirectToAuthThenCurrentContext(context)] as const
            }
            if (statusCode == 403) {
                console.log("403 redirect to ", redirectToHome)
                // TODO redirect to permission denied page
                return [undefined, redirectToHome]
            }
        }
        throw error
    }
}