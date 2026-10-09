class LoadingController {
    private readonly counters = new Map<string | number, number>()

    add(key: string | number) {
        const count = this.counters.get(key) ?? 0

        this.counters.set(key, count + 1)
    }

    remove(key: string | number) {
        const count = this.counters.get(key) ?? 0

        if (count <= 1) {
            this.counters.delete(key)
            return
        }

        this.counters.set(key, count - 1)
    }

    has(key: string | number) {
        return this.counters.has(key)
    }
}