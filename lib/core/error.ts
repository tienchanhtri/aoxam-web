export class HttpError extends Error {
    statusCode: number;

    constructor(statusCode: number) {
        super(`http error: ${statusCode}`);
        this.statusCode = statusCode;
    }
}