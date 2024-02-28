import * as process from "process";

export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function nextLoop(): Promise<void> {
    return sleep(0)
}

export function pad(num: number, size: number) {
    let numStr = num.toString()
    while (numStr.length < size) {
        numStr = "0" + numStr
    }
    return numStr
}

export function isLocalMachine(): Boolean {
    return process.env.NEXT_PUBLIC_LOCAL_MACHINE === "true";
}

export const isFeatureSematicSearchEnabled = process.env.FEATURE_SEMATIC_SEARCH === "true"

export function convertStringToMap(input: string | undefined): Map<string, string> {
    if (input == undefined) {
        return new Map<string, string>();
    }
    const pairs = input.split(',');
    const map = new Map<string, string>();

    for (let i = 0; i < pairs.length; i += 2) {
        const key = pairs[i].trim();
        const value = pairs[i + 1].trim();
        map.set(key, value);
    }

    return map;
}

export function groupBySet<T, K, V>(
    entries: Array<T>,
    keySelector: (e: T) => K,
    valueTransform: (e: T) => V
): Map<K, Set<V>> {
    const map = new Map<K, Set<V>>()
    entries.forEach((e) => {
        const key = keySelector(e)
        let values = map.get(key)
        if (!values) {
            values = new Set()
        }
        const value = valueTransform(e)
        values.add(value)
        map.set(key, values)
    })
    return map
}

export const isVoySub = process.env.NEXT_PUBLIC_IS_VOYSUB === 'true'

export function isValidYoutubeId(id: string): boolean {
    return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

export function extractVideoId(query: string): string | undefined {
    const q = query.trim();
    if (!q) {
        return undefined
    }

    // Check if the query is a valid video ID
    if (isValidYoutubeId(q)) {
        return q;
    }

    const httpQ = q.startsWith("www.youtube.com") || q.startsWith("youtube.com") || q.startsWith("youtu.be")
        ? `https://${q}`
        : q;

    try {
        const url = new URL(httpQ);

        if (url.hostname.includes("youtube")) {
            const videoId = url.searchParams.get("v")?.trim();
            if (videoId && isValidYoutubeId(videoId)) {
                return videoId;
            }
        }

        if (url.hostname === "youtu.be") {
            const pathSegments = url.pathname.split('/');
            const videoId = pathSegments[1]?.trim();
            if (videoId && isValidYoutubeId(videoId)) {
                return videoId;
            }
        }
    } catch (e) {
        console.log(e)
    }

    return undefined;
}