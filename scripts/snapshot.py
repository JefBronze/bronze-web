import json, urllib.request, csv, io, datetime as dt, sys
UA={'User-Agent':'bronze-web-snapshot/0.1 (+https://bronze-engenharia.com.br)'}
def get(url, timeout=25):
    r=urllib.request.Request(url, headers=UA); return urllib.request.urlopen(r, timeout=timeout).read().decode('utf-8','replace')
out={'takenAt': dt.datetime.now(dt.timezone.utc).isoformat(timespec='seconds'), 'sources': {}}
def put(k, fn):
    try: out['sources'][k]=fn()
    except Exception as e: out['sources'][k]={'error': repr(e)}; print('FAIL',k,e,file=sys.stderr)

def ons():
    today=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=3)).date()
    d0=(today-dt.timedelta(days=2)).isoformat(); d1=today.isoformat()
    res={}
    for a in ['SECO','S','NE','N']:
        j=json.loads(get(f'https://apicarga.ons.org.br/prd/cargaverificada?dat_inicio={d0}&dat_fim={d1}&cod_areacarga={a}'))
        rows=j if isinstance(j,list) else j.get('cargaVerificada') or j.get('records') or []
        # The API publishes val_cargaglobal=0 for half-hours not yet verified.
        rows=[r for r in rows if (r.get('val_cargaglobal') or 0)>0]
        rows.sort(key=lambda r:r['din_referenciautc'])
        res[a]={'latest':rows[-1], 'series_last24':[{'t':r['din_referenciautc'],'mw':r['val_cargaglobal']} for r in rows[-48:]]}
    res['sin_mw_now']=sum(v['latest']['val_cargaglobal'] for v in res.values())
    return {'name':'ONS carga verificada','unit':'MW','data':res}
put('ons_carga', ons)

def hq():
    j=json.loads(get('https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/demande-electricite-quebec/records?order_by=date%20desc&limit=96&where=valeurs_demandetotal%20is%20not%20null'))
    # Peak-event fields are datedebut/datefin (not date_debut, which gets a 400).
    ev=json.loads(get('https://donnees.hydroquebec.com/api/explore/v2.1/catalog/datasets/evenements-pointe/records?order_by=datedebut%20desc&limit=3'))
    return {'name':'Hydro-Québec demande','unit':'MW','latest':j['results'][0],'series_last24':[{'t':r['date'],'mw':r['valeurs_demandetotal']} for r in reversed(j['results'])],'peak_events_latest':ev['results']}
put('hq_demand', hq)

def fred(sid):
    rows=[r for r in csv.reader(io.StringIO(get(f'https://fred.stlouisfed.org/graph/fredgraph.csv?id={sid}'))) if r and r[1] not in ('.','') and r[0]!='observation_date']
    return [{'d':r[0],'v':float(r[1])} for r in rows[-60:]]
put('fred', lambda: {'name':'FRED (St. Louis Fed)','WTI_DCOILWTICO':fred('DCOILWTICO'),'Brent_DCOILBRENTEU':fred('DCOILBRENTEU'),'HenryHub_DHHNGSP':fred('DHHNGSP'),'unit':'USD/bbl, USD/MMBtu'})

def poly():
    ev=json.loads(get('https://gamma-api.polymarket.com/events?limit=10&active=true&closed=false&tag_slug=oil&order=volume24hr&ascending=false'))
    wti=[e for e in ev if 'WTI' in e['title'] and 'hit' in e['title']]
    e=wti[0]
    ladder=[]
    for m in e['markets']:
        q=m['question']; p=json.loads(m['outcomePrices'])
        ladder.append({'question':q,'p_yes':float(p[0]),'volume':m.get('volume'),'liquidity':m.get('liquidity')})
    return {'name':'Polymarket','event':e['title'],'slug':e['slug'],'endDate':e['endDate'],'volume':e.get('volume'),'ladder':ladder,'other_oil_events':[x['title'] for x in ev[:8]]}
put('polymarket', poly)

def kalshi():
    j=json.loads(get('https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open&series_ticker=KXWTI'))
    ms=[{'ticker':m['ticker'],'strike':m.get('floor_strike'),'yes_bid':m.get('yes_bid_dollars'),'yes_ask':m.get('yes_ask_dollars'),'last':m.get('last_price_dollars'),'close':m['close_time'],'title':m.get('title')} for m in j['markets']]
    ms.sort(key=lambda m:(m['close'],m['strike'] or 0))
    return {'name':'Kalshi','series':'KXWTI','markets':ms}
put('kalshi', kalshi)

def caiso():
    rows=list(csv.DictReader(io.StringIO(get('https://www.caiso.com/outlook/current/fuelsource.csv'))))
    rows=[r for r in rows if any(v.strip() for k,v in r.items() if k!='Time')]
    return {'name':'CAISO Today\'s Outlook — fuel source','unit':'MW','date_local':'today (America/Los_Angeles)','latest':rows[-1],'series':rows}
put('caiso_fuel', caiso)

def nyiso():
    d=dt.datetime.now(dt.timezone.utc)
    for day in (d, d-dt.timedelta(days=1)):
        try:
            rows=list(csv.DictReader(io.StringIO(get(f'https://mis.nyiso.com/public/csv/rtfuelmix/{day:%Y%m%d}rtfuelmix.csv')))); break
        except Exception: rows=[]
    last_ts=rows[-1]['Time Stamp']
    latest={r['Fuel Category']:float(r['Gen MW']) for r in rows if r['Time Stamp']==last_ts}
    return {'name':'NYISO real-time fuel mix','unit':'MW','timestamp':last_ts,'latest':latest}
put('nyiso_fuel', nyiso)

def cmo():
    txt=get(f'https://ons-aws-prod-opendata.s3.amazonaws.com/dataset/cmo_tm/CMO_SEMIHORARIO_{dt.date.today().year}.csv', timeout=60)
    lines=txt.splitlines(); hdr=lines[0]
    today=(dt.datetime.now(dt.timezone.utc)-dt.timedelta(hours=3)).strftime('%Y-%m-%d')
    rows=[l.split(';') for l in lines[1:] if today in l]
    by={}
    for r in rows: by.setdefault(r[0],[]).append({'t':r[2],'brl_mwh':float(r[3].replace(',','.'))})
    return {'name':'ONS CMO semi-horário','unit':'R$/MWh','header':hdr,'day':today,'by_subsystem':by}
put('ons_cmo', cmo)

def meteo():
    r={}
    for name,lat,lon in [('Curitiba',-25.43,-49.27),('Montréal',45.50,-73.57)]:
        r[name]=json.loads(get(f'https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current=temperature_2m,wind_speed_10m,shortwave_radiation&timezone=auto'))['current']
    return {'name':'Open-Meteo','data':r}
put('open_meteo', meteo)

json.dump(out, open('design-data.json','w'), ensure_ascii=False, indent=1)
print({k:('ok' if 'error' not in v else 'ERR') for k,v in out['sources'].items()})
