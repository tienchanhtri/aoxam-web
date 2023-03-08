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