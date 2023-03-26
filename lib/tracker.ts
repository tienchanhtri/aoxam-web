import {logEvent as amplitudeLogEvent} from "@amplitude/analytics-browser";
import {isLocalMachine} from "@/lib/utils";

export function logEvent(key: string, params: Record<string, any>) {
    if (isLocalMachine()) {
        console.log(`log event key: ${key} param: ${JSON.stringify(params)}`)
    }
    amplitudeLogEvent(key, params)
}

export function logClick(pageName: string, elementName: string, params: Record<string, any> = {}) {
    logEvent(
        "click",
        {
            "page_name": pageName,
            "element_name": elementName,
            ...params,
        }
    )
}

export function logPageView(pageName: string, params: Record<string, any>) {
    logEvent(
        "page_view",
        {
            "page_name": pageName,
            ...params,
            "page_location": window.location.href,
        }
    )
}