// airplanes.live readsb-style JSON (subset of fields used here)
export interface Aircraft {
    hex: string;
    flight?: string;
    r?: string; // registration
    t?: string; // ICAO type
    lat?: number;
    lon?: number;
    alt_baro?: number | 'ground';
    gs?: number; // kt
    track?: number; // deg
    baro_rate?: number; // fpm
    squawk?: string;
    seen_pos?: number; // s
}

interface PointResponse {
    ac?: Aircraft[];
}

const API = 'https://api.airplanes.live/v2/point';
export const MAX_RADIUS_NM = 250;

export const fetchAircraft = async (
    lat: number,
    lon: number,
    radiusNm: number,
): Promise<Aircraft[]> => {
    const url = `${API}/${lat.toFixed(4)}/${lon.toFixed(4)}/${Math.round(radiusNm)}`;
    // Note: airplanes.live sends 429 without CORS headers, so in the browser
    // a rate limit surfaces as a generic network error ("Failed to fetch").
    const res = await fetch(url);
    if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
    }
    const json: PointResponse = await res.json();
    return json.ac ?? [];
};

/** Great-circle distance in nautical miles */
export const distanceNm = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const rad = Math.PI / 180;
    const dLat = (lat2 - lat1) * rad;
    const dLon = (lon2 - lon1) * rad;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
    return 2 * 3440.065 * Math.asin(Math.sqrt(a));
};

// Altitude color ramp (ft), after ISmillex/adsb-flight-map
const STOPS: [number, [number, number, number]][] = [
    [0, [255, 140, 0]],
    [4000, [255, 220, 0]],
    [8000, [40, 170, 60]],
    [20000, [0, 210, 230]],
    [30000, [40, 90, 255]],
    [40000, [170, 60, 230]],
];

export const altitudeColor = (alt: Aircraft['alt_baro']): string => {
    if (alt === 'ground' || alt === undefined) {
        return 'rgb(150,150,150)';
    }
    if (alt <= STOPS[0][0]) {
        return `rgb(${STOPS[0][1].join(',')})`;
    }
    for (let i = 1; i < STOPS.length; i++) {
        const [a1, c1] = STOPS[i];
        if (alt <= a1) {
            const [a0, c0] = STOPS[i - 1];
            const f = (alt - a0) / (a1 - a0);
            const c = c0.map((v, k) => Math.round(v + (c1[k] - v) * f));
            return `rgb(${c.join(',')})`;
        }
    }
    return `rgb(${STOPS[STOPS.length - 1][1].join(',')})`;
};

export const aircraftIcon = (track: number, color: string): L.DivIcon =>
    L.divIcon({
        className: 'adsb-aircraft',
        html: `<svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${track}deg)">
            <path d="M12 2 L13.5 9 L22 13 L22 15 L13.5 12.5 L13 19 L16 21 L16 22.5 L12 21.5 L8 22.5 L8 21 L11 19 L10.5 12.5 L2 15 L2 13 L10.5 9 Z"
                fill="${color}" stroke="#000" stroke-width="0.8"/>
        </svg>`,
        iconSize: [22, 22],
        iconAnchor: [11, 11],
    });

const fmt = (v: number | undefined, unit: string, digits = 0) =>
    v === undefined ? '–' : `${v.toFixed(digits)} ${unit}`;

export const popupHtml = (a: Aircraft): string => {
    const alt =
        a.alt_baro === 'ground'
            ? 'ground'
            : a.alt_baro === undefined
              ? '–'
              : `${a.alt_baro} ft / ${Math.round(a.alt_baro * 0.3048)} m`;
    return `<b>${a.flight?.trim() || a.hex}</b><br/>
        Reg: ${a.r ?? '–'} · Type: ${a.t ?? '–'}<br/>
        Alt: ${alt}<br/>
        GS: ${fmt(a.gs, 'kt')} · Track: ${fmt(a.track, '°')}<br/>
        V/S: ${fmt(a.baro_rate, 'fpm')}<br/>
        Squawk: ${a.squawk ?? '–'}<br/>
        Age: ${fmt(a.seen_pos, 's', 1)}`;
};
