// js/Constants.js
export const THEMES = {
    sky: {
        name: 'Cloud Sky',
        fogColor: 0xa0c4ff,
        tileColors: { main: '#3a88fe', sub: '#235bb5', border: '#00f2ff' },
        accent: 0x00f2ff,
        ballColor: 0xffffff,
        light: 0xffffff
    },
    cyber: {
        name: 'Cyber Synth',
        fogColor: 0x1f062e,
        tileColors: { main: '#2d0c4e', sub: '#18042b', border: '#ff00aa' },
        accent: 0xff00aa,
        ballColor: 0x00ffff,
        light: 0xffaaff
    },
    inferno: {
        name: 'Inferno Volcano',
        fogColor: 0x240606,
        tileColors: { main: '#401010', sub: '#240808', border: '#ff4400' },
        accent: 0xff3b00,
        ballColor: 0xffcc00,
        light: 0xff8844
    },
    cosmos: {
        name: 'Deep Cosmos',
        fogColor: 0x070b1a,
        tileColors: { main: '#0d1f3d', sub: '#081224', border: '#7000ff' },
        accent: 0x7000ff,
        ballColor: 0x00ffcc,
        light: 0x88bbff
    }
};

export function computeEffectiveTempoBefore(rows, baseTempo, uptoRow) {
    const fallback = (typeof baseTempo === 'number' && !isNaN(baseTempo)) ? baseTempo : 11;
    if (!Array.isArray(rows)) return fallback;
    const start = Math.min(uptoRow - 1, rows.length - 1);
    for (let r = start; r >= 0; r--) {
        const row = rows[r];
        if (!row || !row.tiles || !row.tileTempo) continue;
        for (let c = 0; c < 7; c++) {
            if (row.tiles[c] === 8 && row.tileTempo[c]) {
                return row.tileTempo[c];
            }
        }
    }
    return fallback;
}

export function tempoDirection(value, prevValue) {
    if (value > prevValue + 0.05) return 'up';
    if (value < prevValue - 0.05) return 'down';
    return 'same';
}

export function normalizeLevelData(data) {
    if (!data || typeof data !== 'object') {
        return {
            name: 'Untitled Level',
            theme: 'sky',
            baseTempo: 11,
            rows: []
        };
    }

    const normalized = {
        ...data,
        name: typeof data.name === 'string'
            ? data.name
            : 'Untitled Level',
        theme: THEMES[data.theme]
            ? data.theme
            : 'sky',
        baseTempo: 11,
        rows: Array.isArray(data.rows)
            ? data.rows
            : []
    };

    if (
        typeof data.baseTempo === 'number' &&
        Number.isFinite(data.baseTempo)
    ) {
        normalized.baseTempo = data.baseTempo;
    } else if (
        typeof data.speed === 'number' &&
        Number.isFinite(data.speed)
    ) {
        normalized.baseTempo =
            Math.round(data.speed * 11 * 10) / 10;
    }

    normalized.baseTempo = Math.max(
        2,
        Math.min(40, normalized.baseTempo)
    );

    const normalizeArray = (arr) => {
        if (!Array.isArray(arr)) {
            return [0, 0, 0, 0, 0, 0, 0];
        }

        // Convert legacy five-lane data to seven lanes.
        if (arr.length === 5) {
            return [
                0,
                Number(arr[0]) || 0,
                Number(arr[1]) || 0,
                Number(arr[2]) || 0,
                Number(arr[3]) || 0,
                Number(arr[4]) || 0,
                0
            ];
        }

        return Array.from({ length: 7 }, (_, i) => {
            return Number(arr[i]) || 0;
        });
    };

    normalized.rows = normalized.rows.map(row => {
        row = row && typeof row === 'object' ? row : {};

        return {
            ...row,
            tiles: normalizeArray(row.tiles),
            obstacles: normalizeArray(row.obstacles),
            tileTempo: normalizeArray(row.tileTempo)
        };
    });

    return normalized;
}

export function generatePresetTrack(type) {
    const TOTAL = 120;
    const rows = [];
    for (let r = 0; r < TOTAL; r++) {
        let tiles = [0, 0, 0, 0, 0, 0, 0];
        let obs = [0, 0, 0, 0, 0, 0, 0];

        if (r < 6) {
            tiles = [1, 1, 1, 1, 1, 1, 1];
        } else if (r === TOTAL - 1) {
            tiles = [1, 1, 1, 1, 1, 1, 1];
        } else {
            if (type === 1) {
                const pattern = r % 16;
                if (pattern < 4) tiles = [0, 0, 1, 1, 1, 0, 0];
                else if (pattern < 8) { tiles = [0, 1, 1, 1, 0, 0, 0]; if (pattern === 6) obs[1] = 1; }
                else if (pattern < 12) { tiles = [0, 0, 0, 1, 1, 1, 0]; if (pattern === 10) obs[5] = 1; }
                else tiles = [0, 0, 1, 1, 1, 0, 0];

                if (r === 18 || r === 42 || r === 70 || r === 95) tiles[3] = 2;
                if ((r >= 19 && r <= 21) || (r >= 43 && r <= 45) || (r >= 71 && r <= 73) || (r >= 96 && r <= 98)) tiles = [0, 0, 0, 0, 0, 0, 0];

                if (r % 11 === 0 && r > 6) obs[3] = 6;
                if (r === 30 || r === 65 || r === 105) obs[3] = 7;
                if (r % 14 === 5 && r > 10) obs[2] = 2;
            } else if (type === 2) {
                tiles = [1, 1, 1, 1, 1, 1, 1];
                if (r % 8 === 0) tiles[2] = 4;
                if (r % 8 === 4) tiles[4] = 4;
                if (r === 25 || r === 60 || r === 90) tiles[3] = 5;
                if (r === 35 || r === 70 || r === 100) tiles[3] = 6;

                if (r % 12 === 0) obs[3] = 3;
                // Deterministic alternation replaces non-reproducible Math.random()
                if (r % 10 === 5) obs[r % 4 === 1 ? 1 : 5] = 2;
                if (r % 9 === 0) obs[3] = 6;
                if (r === 32 || r === 68 || r === 110) obs[2] = 7;
            } else {
                const p = r % 10;
                if (p === 0 || p === 1) tiles = [0, 1, 1, 0, 0, 0, 0];
                else if (p === 2 || p === 3) tiles = [0, 0, 1, 1, 1, 0, 0];
                else if (p === 4 || p === 5) tiles = [0, 0, 0, 0, 1, 1, 0];
                else tiles = [0, 0, 1, 1, 1, 0, 0];

                if (r === 20 || r === 55 || r === 85) tiles[3] = 3;
                if ((r >= 21 && r <= 24) || (r >= 56 && r <= 59)) tiles = [0,0,0,0,0,0,0];

                if (r % 7 === 0) obs[3] = 4;
                if (r % 13 === 0) obs[2] = 5;
                if (r % 8 === 0) obs[3] = 6;
                if (r === 28 || r === 62 || r === 108) obs[4] = 7;
            }
        }
        rows.push({ tiles: tiles, obstacles: obs, tileTempo: [0, 0, 0, 0, 0, 0, 0] });
    }
    return rows;
}

export const PRESETS = {
    preset_cloud: { name: "Cloud Meadows", theme: "sky", baseTempo: 11, rows: generatePresetTrack(1) },
    preset_cyber: { name: "Cyber Matrix", theme: "cyber", baseTempo: 13, rows: generatePresetTrack(2) },
    preset_inferno: { name: "Inferno Temple", theme: "inferno", baseTempo: 14.5, rows: generatePresetTrack(3) }
};
