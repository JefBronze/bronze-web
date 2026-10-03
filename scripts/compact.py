"""Trim design-data.json to the handful of values a mock-up needs (design-data-compact.json)."""
import json, sys

d = json.load(open('design-data.json'))
s = d['sources']
carga = s['ons_carga']['data']
areas = ['SECO', 'S', 'NE', 'N']
n = min(len(carga[a]['series_last24']) for a in areas)


def level(q):
    return float(q.split('$')[1].split(' ')[0])


first_close = s['kalshi']['markets'][0]['close']
c = {
    'takenAt': d['takenAt'],
    'sin_mw': round(carga['sin_mw_now']),
    'sin_by_subsystem_mw': {a: round(carga[a]['latest']['val_cargaglobal']) for a in areas},
    'sin_last24_mw': [round(sum(carga[a]['series_last24'][i]['mw'] for a in areas)) for i in range(n)],
    'quebec_mw': s['hq_demand']['latest']['valeurs_demandetotal'],
    'quebec_t': s['hq_demand']['latest']['date'],
    'quebec_last24_mw': [x['mw'] for x in s['hq_demand']['series_last24']],
    'wti_usd': s['fred']['WTI_DCOILWTICO'][-1],
    'brent_usd': s['fred']['Brent_DCOILBRENTEU'][-1],
    'henry_hub_usd_mmbtu': s['fred']['HenryHub_DHHNGSP'][-1],
    'wti_60d': [x['v'] for x in s['fred']['WTI_DCOILWTICO']],
    'polymarket_event': s['polymarket']['event'],
    'polymarket_ladder': sorted(
        [{'level_usd': level(l['question']), 'kind': 'HIGH' if 'HIGH' in l['question'] else 'LOW', 'p_yes': l['p_yes']}
         for l in s['polymarket']['ladder']],
        key=lambda x: (x['kind'], x['level_usd'])),
    'kalshi_series': 'KXWTI',
    'kalshi_close': first_close,
    'kalshi_ladder': [{'strike': m['strike'], 'yes_bid': m['yes_bid'], 'yes_ask': m['yes_ask']}
                      for m in s['kalshi']['markets'] if m['close'] == first_close][::2],
    'cmo_now_brl_mwh': {k: v[-1]['brl_mwh'] for k, v in s['ons_cmo']['by_subsystem'].items()},
    'cmo_day': s['ons_cmo']['day'],
    'cmo_48_SE': [x['brl_mwh'] for x in s['ons_cmo']['by_subsystem']['SE']],
    'cmo_48_N': [x['brl_mwh'] for x in s['ons_cmo']['by_subsystem']['N']],
    'caiso_time_pt': s['caiso_fuel']['latest']['Time'],
    'caiso_latest_mw': {k: int(v) for k, v in s['caiso_fuel']['latest'].items() if k != 'Time'},
    'nyiso_t': s['nyiso_fuel']['timestamp'],
    'nyiso_latest_mw': s['nyiso_fuel']['latest'],
    'weather': {k: {'temp_c': v['temperature_2m'], 'wind_kmh': v['wind_speed_10m']} for k, v in s['open_meteo']['data'].items()},
    'static': {
        'parana_idle_demand_share': 0.16, 'parana_idle_demand_brl_year': 122e6, 'parana_units_a4': 11780,
        'idle_education': 0.30, 'idle_hospitals': 0.21,
        'openadr_lab': {'load_w_before': '10-14', 'load_w_top_tier': '~0', 'recovery_s': 55},
        'urpx_copel_b1_error_brl': 0.04,
    },
    'company': {
        'name': 'Bronze Engenharia de Energia', 'cnpj': '19.824.419/0001-96', 'crea': 'CREA-PR 194835/D',
        'cities': ['Curitiba', 'Montréal'], 'whatsapp': '+1 438 979 6085', 'email': 'contato@data-joule.com',
    },
}
out = sys.argv[1] if len(sys.argv) > 1 else 'design-data-compact.json'
json.dump(c, open(out, 'w'), ensure_ascii=False, indent=1)
print(out)
