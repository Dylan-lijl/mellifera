import Store from 'electron-store';
import {stringify, parse} from 'superjson';

const store = new Store();

export function saveData(key: string, value: any) {
    store.set(key, stringify(value));
}

export function deleteData(key: string) {
    store.delete(key);
}

export function getData(key: string) {
    const item = store.get(key) as string | undefined;
    return item ? parse<any>(item) : item;
}

export function getAll() {
    return Object.entries(store.store).map(([key, value]) => ({
        key,
        value,
    }));
}

export default {
    saveData,
    deleteData,
    getData,
    getAll
}