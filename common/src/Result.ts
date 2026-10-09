export interface Result<T> {
    code?: number
    message?: string
    data?: T | null
    other?:any
}

export interface PageData<T> {
    pageNum: number,
    pageSize: number,
    totalPage: number,
    total: number,
    list: T[],
}
