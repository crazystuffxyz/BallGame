export const Storage = {
    KEY: 'rs_custom_level_v3',
    save(data) {
        try {
            localStorage.setItem(this.KEY, JSON.stringify(data));
            return true;
        } catch(e) { return false; }
    },
    load() {
        try {
            const d = localStorage.getItem(this.KEY);
            return d ? JSON.parse(d) : null;
        } catch(e) { return null; }
    }
};
