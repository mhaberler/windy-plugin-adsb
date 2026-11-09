import type { ExternalPluginConfig } from '@windy/interfaces';

const config: ExternalPluginConfig = {
    name: 'windy-plugin-adsb',
    version: '0.1.0',
    title: 'ADS-B Aircraft',
    icon: '✈',
    description: 'Live ADS-B aircraft in the current map view (data: airplanes.live).',
    author: 'Michael Haberler',
    repository: 'https://github.com/windycom/windy-plugin-template',
    desktopUI: 'rhpane',
    mobileUI: 'small',
    desktopWidth: 220,
    routerPath: '/adsb',
};

export default config;
