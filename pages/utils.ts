export async function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function nextLoop(): Promise<void> {
    return sleep(0)
}