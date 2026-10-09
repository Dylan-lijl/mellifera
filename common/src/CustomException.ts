import type {Result} from "./Result";


export class ResultApiException extends Error {
    code: Result<null>

    constructor(code: Result<null>) {
        super();
        this.code = code;
    }
}

export class UnstoppableException extends ResultApiException{
    constructor(code: Result<null>) {
        super(code);
    }
}
