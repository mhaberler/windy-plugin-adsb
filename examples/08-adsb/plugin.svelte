{#if isMobileOrTablet}
    <section class="adsb-mobile">
        <span class="size-xs">{statusText}</span>
        <div
            class="button button--variant-orange size-s"
            class:adsb-disabled={cooldownLeft > 0}
            on:click={startLiveWindow}
        >
            {cooldownLeft > 0 ? `Refresh (${cooldownLeft}s)` : 'Refresh'}
        </div>
    </section>
{:else}
    <section class="plugin__content">
        <div
            class="plugin__title plugin__title--chevron-back"
            on:click={() => bcast.emit('rqstOpen', 'menu')}
        >
            {title}
        </div>
        <div class="mb-10">{count} aircraft in view</div>
        <div class="mb-10 size-xs">{statusText}</div>
        {#if capped}
            <div class="mb-10 size-xs">Showing {MAX_RADIUS_NM} nm around center</div>
        {/if}
        {#if error}
            <div class="mb-10 size-xs adsb-error">{error}</div>
        {/if}
        <div
            class="button button--variant-orange size-s"
            class:adsb-disabled={cooldownLeft > 0}
            on:click={startLiveWindow}
        >
            {cooldownLeft > 0 ? `Refresh (${cooldownLeft}s)` : 'Refresh'}
        </div>
        <p class="size-xs mt-20">Data: airplanes.live</p>
    </section>
{/if}

<script lang="ts">
    import bcast from '@windy/broadcast';
    import { map } from '@windy/map';
    import { isMobileOrTablet } from '@windy/rootScope';

    import { onDestroy } from 'svelte';

    import config from './pluginConfig';
    import {
        fetchAircraft,
        distanceNm,
        altitudeColor,
        aircraftIcon,
        popupHtml,
        MAX_RADIUS_NM,
        type Aircraft,
    } from './adsb';

    const { title } = config;

    const LIVE_WINDOW_MS = 10_000;
    // airplanes.live allows ~15 requests per ~30 s, then 429 with retry-after ~30 s
    const POLL_GAP_MS = 2_000;
    const COOLDOWN_MS = 30_000;

    interface Shown {
        marker: L.Marker;
        iconKey: string;
    }

    const shown = new Map<string, Shown>();

    let liveUntil = 0;
    let generation = 0; // invalidates loops of earlier Live Windows
    let timer: ReturnType<typeof setTimeout> | null = null;
    let live = false;
    let lastUpdate: Date | null = null;
    let count = 0;
    let capped = false;
    let error = '';
    let cooldownLeft = 0; // s until Refresh is allowed again
    let cooldownTimer: ReturnType<typeof setInterval> | null = null;

    const startCooldown = () => {
        const until = Date.now() + COOLDOWN_MS;
        const tick = () => {
            cooldownLeft = Math.max(0, Math.ceil((until - Date.now()) / 1000));
            if (cooldownLeft === 0 && cooldownTimer) {
                clearInterval(cooldownTimer);
                cooldownTimer = null;
            }
        };
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = setInterval(tick, 1000);
        tick();
    };

    $: statusText = live
        ? `live · updated ${lastUpdate?.toLocaleTimeString() ?? '…'}`
        : lastUpdate
          ? `paused · data from ${lastUpdate.toLocaleTimeString()}`
          : 'paused';

    const setDimmed = (dimmed: boolean) => {
        shown.forEach(s => s.marker.setOpacity(dimmed ? 0.4 : 1));
    };

    const updateMarkers = (list: Aircraft[]) => {
        const bounds = map.getBounds();
        const seen = new Set<string>();

        for (const a of list) {
            if (a.lat === undefined || a.lon === undefined) continue;
            if (!bounds.contains([a.lat, a.lon])) continue;
            seen.add(a.hex);

            const color = altitudeColor(a.alt_baro);
            const track = Math.round(a.track ?? 0);
            const iconKey = `${track}|${color}`;
            const existing = shown.get(a.hex);

            if (existing) {
                existing.marker.setLatLng([a.lat, a.lon]);
                if (existing.iconKey !== iconKey) {
                    existing.marker.setIcon(aircraftIcon(track, color));
                    existing.iconKey = iconKey;
                }
                existing.marker.setPopupContent(popupHtml(a));
            } else {
                const marker = new L.Marker([a.lat, a.lon], {
                    icon: aircraftIcon(track, color),
                })
                    .bindPopup(popupHtml(a))
                    .addTo(map);
                shown.set(a.hex, { marker, iconKey });
            }
        }

        for (const [hex, s] of shown) {
            if (!seen.has(hex)) {
                s.marker.remove();
                shown.delete(hex);
            }
        }
        count = shown.size;
    };

    const poll = async (gen: number) => {
        if (gen !== generation) return;
        if (Date.now() >= liveUntil) {
            live = false;
            setDimmed(true);
            return;
        }

        const center = map.getCenter();
        const ne = map.getBounds().getNorthEast();
        const radius = distanceNm(center.lat, center.lng, ne.lat, ne.lng);
        capped = radius > MAX_RADIUS_NM;

        try {
            const list = await fetchAircraft(
                center.lat,
                center.lng,
                Math.max(1, Math.min(radius, MAX_RADIUS_NM)),
            );
            if (gen !== generation) return;
            updateMarkers(list);
            lastUpdate = new Date();
            error = '';
        } catch (e) {
            if (gen !== generation) return;
            // Any failure is treated as a rate limit (429 is opaque to the browser):
            // end the Live Window and block Refresh during the cooldown.
            error = `Fetch failed (${(e as Error).message}), likely rate limited`;
            live = false;
            setDimmed(true);
            startCooldown();
            return;
        }
        timer = setTimeout(() => poll(gen), POLL_GAP_MS);
    };

    const startLiveWindow = () => {
        if (cooldownLeft > 0) return;
        if (timer) clearTimeout(timer);
        generation++;
        liveUntil = Date.now() + LIVE_WINDOW_MS;
        live = true;
        setDimmed(false);
        poll(generation);
    };

    export const onopen = () => {
        startLiveWindow();
    };

    onDestroy(() => {
        generation++;
        if (timer) clearTimeout(timer);
        if (cooldownTimer) clearInterval(cooldownTimer);
        shown.forEach(s => s.marker.remove());
        shown.clear();
    });
</script>

<style lang="less">
    .adsb-mobile {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
    }
    .adsb-disabled {
        opacity: 0.5;
        pointer-events: none;
    }
    .adsb-error {
        color: #f66;
    }
    :global(.adsb-aircraft) {
        background: none;
        border: none;
    }
</style>
