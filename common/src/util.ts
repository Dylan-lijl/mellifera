import {PageData} from "./Result";

export function createPagination(changeListener: () => void) {
    // 💡 关键：先声明一个确定引用的实体对象
    const state = {
        pageSizes: [5, 10, 30, 50, 100, 500],
        pageSize: 10,
        layout: "total, sizes, prev, pager, next, jumper",
        total: 0,
        current: 1,
        changed: () => changeListener(),
        update(data: PageData<any>) {
            if (!data) return;
            state.current = data.pageNum;
            state.total = data.total;
            state.pageSize = data.pageSize;
        },
        reset() {
            state.current = 1;
            state.pageSize = 10;
            state.total = 0;
        },
        get(object: any) {
            return {
                pageNum: state.current,
                pageSize: state.pageSize,
                ...object
            }
        }
    };
    return state;
}

export function escapeLike(value: string): string {
    return value.replace(/[\\%_]/g, '\\$&')
}

export function mapGetOrCreate<K, V>(
    map: Map<K, V>,
    key: K,
    factory: (key: K) => V,
): V {
    //这里不能使用变量来存储创建的对象并返回,那样会使代理失效
    if (map.get(key) === undefined) {
        map.set(key, factory(key))
    }
    return map.get(key) as V;
}