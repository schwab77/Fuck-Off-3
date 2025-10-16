import React, { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, ReferenceLine, Area, AreaChart, Bar } from "recharts";

const now = Date.now();
const mkSeries = Array.from({ length: 200 }, (_, i) => {
  const t = new Date(now - (199 - i) * 60 * 60 * 1000);
  const v = 100 + Math.sin(i / 7) * 5 + Math.cos(i / 17) * 3 + i * 0.05;
  return { time: t.toLocaleString(), price: Number(v.toFixed(2)), volume: Math.floor(50 + Math.sin(i / 3) * 25 + Math.random() * 15) };
});

export default function App(){
  const [bt, setBt] = useState({ running: false, trades: 0, winRate: 0, pf: 0, pnl: 0, maxDD: 0, curve: [], tradesList: [] });
  const [market, setMarket] = useState({ symbol: "XAUUSD", tickSize: 0.1 });
  const [riskTicks, setRiskTicks] = useState(20);
  const [useSessions, setUseSessions] = useState(true);
  const [atrMinTicks, setAtrMinTicks] = useState(25);
  const [useRegime, setUseRegime] = useState(true);
  const [smaPeriod, setSmaPeriod] = useState(200);
  const [tradeDir, setTradeDir] = useState("both");
  const [useVolFilter, setUseVolFilter] = useState(true);
  const [useTPBE, setUseTPBE] = useState(true);
  const [useAdx, setUseAdx] = useState(true);
  const [adxPeriod, setAdxPeriod] = useState(14);
  const [adxMin, setAdxMin] = useState(20);
  const [useNewsFilter, setUseNewsFilter] = useState(true);
  const [newsWindowMin, setNewsWindowMin] = useState(30);
  const [newsEvents, setNewsEvents] = useState([]);

  const ema = useMemo(() => {
    let prev = mkSeries[0]?.price ?? 0;
    return mkSeries.map((d, i) => {
      const value = i === 0 ? d.price : prev * 0.9 + d.price * 0.1;
      prev = value;
      return { ...d, ema: Number(value.toFixed(2)) };
    });
  }, []);

  const vwap = useMemo(() => {
    let cumPV = 0, cumV = 0;
    return mkSeries.map(d => {
      const pv = d.price * (d.volume || 1);
      cumPV += pv; cumV += (d.volume || 1);
      const v = cumV > 0 ? cumPV / cumV : d.price;
      return { ...d, vwap: Number(v.toFixed(2)) };
    });
  }, []);

  const rsi = useMemo(() => {
    let gains = 0, losses = 0, period = 14; const res = [];
    for (let i = 0; i < mkSeries.length; i++) {
      if (i === 0) { res.push({ ...mkSeries[i], rsi: 50 }); continue; }
      const ch = mkSeries[i].price - mkSeries[i - 1].price;
      gains = (gains * (period - 1) + Math.max(ch, 0)) / period;
      losses = (losses * (period - 1) + Math.max(-ch, 0)) / period;
      const rs = losses === 0 ? 100 : gains / losses;
      const v = 100 - 100 / (1 + rs);
      res.push({ ...mkSeries[i], rsi: Number(v.toFixed(2)) });
    }
    return res;
  }, []);

  const atr = useMemo(() => {
    const period = 14;
    const arr = [];
    let trSMA = 0;
    for (let i = 0; i < mkSeries.length; i++) {
      const p = mkSeries[i].price;
      const prev = i > 0 ? mkSeries[i - 1].price : p;
      const tr = Math.abs(p - prev);
      trSMA = i < period ? ((trSMA * i + tr) / (i + 1)) : (trSMA * (period - 1) + tr) / period;
      arr.push({ ...mkSeries[i], atr: Number(trSMA.toFixed(4)) });
    }
    return arr;
  }, []);

  const volMA = useMemo(() => {
    const period = 20; let sum = 0; const out = [];
    for (let i = 0; i < mkSeries.length; i++) {
      sum += mkSeries[i].volume || 0;
      const denom = i+1 < period ? i+1 : period;
      const ma = sum / denom;
      if (i >= period) sum -= mkSeries[i - period].volume || 0;
      out.push({ ...mkSeries[i], vma: Number(ma.toFixed(2)) });
    }
    return out;
  }, []);

  const sma = useMemo(() => {
    const p = mkSeries.map(d=>d.price);
    const out = []; let sum = 0;
    for (let i=0;i<p.length;i++){
      sum += p[i];
      if (i>=smaPeriod) sum -= p[i - smaPeriod];
      const val = i+1>=smaPeriod ? sum / smaPeriod : p[i];
      out.push({ ...mkSeries[i], sma: Number(val.toFixed(4)) });
    }
    return out;
  }, [smaPeriod]);

  const adxArr = useMemo(() => {
    const n = Math.max(5, adxPeriod);
    let trEMA = 0, dmPlusEMA = 0, dmMinusEMA = 0;
    const alpha = 1 / n;
    const out = [];
    for (let i=0;i<mkSeries.length;i++){
      const c = mkSeries[i].price;
      const cp = i>0 ? mkSeries[i-1].price : c;
      const up = Math.max(c - cp, 0);
      const dn = Math.max(cp - c, 0);
      const tr = Math.abs(c - cp);
      dmPlusEMA = (1-alpha)*dmPlusEMA + alpha*(up>dn?up:0);
      dmMinusEMA = (1-alpha)*dmMinusEMA + alpha*(dn>up?dn:0);
      trEMA = (1-alpha)*trEMA + alpha*tr;
      const pdi = trEMA>0 ? 100 * (dmPlusEMA / trEMA) : 0;
      const mdi = trEMA>0 ? 100 * (dmMinusEMA / trEMA) : 0;
      const dx = (pdi+mdi)>0 ? 100 * Math.abs(pdi-mdi) / (pdi+mdi) : 0;
      const prevAdx = i>0 ? out[i-1].adx : dx;
      const adx = (1-alpha)*prevAdx + alpha*dx;
      out.push({ ...mkSeries[i], adx: Number(adx.toFixed(2)) });
    }
    return out;
  }, [adxPeriod]);

  function runBacktest(){
    setBt(prev => ({ ...prev, running: true }));
    try{
      const tick = Number(market.tickSize) || 0.1;
      const risk = Number(riskTicks) * tick;
      const fullData = ema.map((d, i) => ({
        time: d.time,
        price: d.price,
        ema: d.ema,
        vwap: vwap[i]?.vwap ?? d.price,
        rsi: rsi[i]?.rsi ?? 50,
        atr: atr[i]?.atr ?? 0,
        vma: volMA[i]?.vma ?? 0,
        sma: sma[i]?.sma ?? d.price,
        adx: adxArr[i]?.adx ?? 0,
        volume: mkSeries[i]?.volume ?? 0,
        hour: (() => { const t = new Date(now - (mkSeries.length - 1 - i) * 3600000); return t.getHours(); })(),
      }));

      const inSession = (h) => {
        if (!useSessions) return true;
        const londonAM = (h >= 8 && h <= 11);
        const nyOverlap = (h >= 14 && h <= 17);
        return londonAM || nyOverlap;
      };

      const isNewsBlocked = (ts) => {
        if (!useNewsFilter) return false;
        const w = Math.max(0, Number(newsWindowMin)) * 60000;
        for (const ev of newsEvents) { if (Math.abs(ts - ev.ts) <= w) return true; }
        return false;
      };

      function runParams(slice, params){
        let pos=null; const trades=[]; let equity=0; let peak=0; let maxDD=0; const curve=[];
        const { rsiMin=52, rsiMax=65, atrTicksMin=atrMinTicks } = params;
        const rsiExit=45;
        for(let i=1;i<slice.length-1;i++){
          const prev=slice[i-1], cur=slice[i], nxt=slice[i+1];
          const ts = now - (mkSeries.length - 1 - i) * 3600000;
          if(!inSession(cur.hour) || isNewsBlocked(ts)) { curve.push({t:cur.time,equity:Number(equity.toFixed(4))}); continue; }
          const crossUp = prev.price <= prev.ema && cur.price > cur.ema;
          const crossDn = prev.price >= prev.ema && cur.price < cur.ema;
          const atrOK = (cur.atr / tick) >= atrTicksMin;
          const volOK = !useVolFilter || (cur.volume >= cur.vma);
          const regimeLongOK = !useRegime || (cur.price >= cur.sma);
          const regimeShortOK = !useRegime || (cur.price <= cur.sma);
          const adxOK = !useAdx || (cur.adx >= adxMin);

          if(!pos){
            let openLong=false, openShort=false;
            const emaRsiLong = (crossUp && cur.rsi >= rsiMin);
            const confluenceLong = (crossUp && cur.price >= cur.vwap && cur.rsi >= rsiMin && cur.rsi <= rsiMax);
            if ((emaRsiLong || confluenceLong) && atrOK && volOK && regimeLongOK && adxOK && (tradeDir==='long' || tradeDir==='both')) openLong=true;

            const emaRsiShort = (crossDn && cur.rsi <= (100 - rsiMin));
            const confluenceShort = (crossDn && cur.price <= cur.vwap && cur.rsi <= (100 - rsiMin) && cur.rsi >= (100 - rsiMax));
            if ((emaRsiShort || confluenceShort) && atrOK && volOK && regimeShortOK && adxOK && (tradeDir==='short' || tradeDir==='both')) openShort=true;

            if (openLong){ const entry=nxt.price; const stop=entry - risk; pos={ dir:'long', entry, stop, tp1: entry + 0.5*risk, tp2: entry + 1.0*risk, tp1Hit:false }; }
            else if (openShort){ const entry=nxt.price; const stop=entry + risk; pos={ dir:'short', entry, stop, tp1: entry - 0.5*risk, tp2: entry - 1.0*risk, tp1Hit:false }; }
          } else {
            if (pos.dir==='long'){
              if (useTPBE && !pos.tp1Hit && cur.price >= pos.tp1) { pos.tp1Hit = true; pos.stop = pos.entry; }
              let exitNow=false; let exitPrice=cur.price; let reason="";
              if (cur.price <= pos.stop){ exitNow=true; exitPrice=pos.stop; reason="SL"; }
              else if (cur.price >= pos.tp2){ exitNow=true; exitPrice=pos.tp2; reason="TP2"; }
              else if ((crossDn || cur.price < cur.vwap || cur.rsi <= rsiExit)) { exitNow = true; reason = "SignalExit"; }
              if (exitNow){ let pnl=0; if (pos.tp1Hit) pnl += 0.5*(pos.tp1 - pos.entry); pnl += 0.5*(exitPrice - pos.entry); trades.push({dir:'long', entry:pos.entry, exit:exitPrice, pnl, reason}); equity += pnl; pos=null; }
            } else {
              if (useTPBE && !pos.tp1Hit && cur.price <= pos.tp1) { pos.tp1Hit = true; pos.stop = pos.entry; }
              let exitNow=false; let exitPrice=cur.price; let reason="";
              if (cur.price >= pos.stop){ exitNow=true; exitPrice=pos.stop; reason="SL"; }
              else if (cur.price <= pos.tp2){ exitNow=true; exitPrice=pos.tp2; reason="TP2"; }
              else if ((crossUp || cur.price > cur.vwap || cur.rsi >= (100 - rsiExit))) { exitNow = true; reason = "SignalExit"; }
              if (exitNow){ let pnl=0; if (pos.tp1Hit) pnl += 0.5*(pos.entry - pos.tp1); pnl += 0.5*(pos.entry - exitPrice); trades.push({dir:'short', entry:pos.entry, exit:exitPrice, pnl, reason}); equity += pnl; pos=null; }
            }
          }
          curve.push({t:cur.time,equity:Number(equity.toFixed(4))});
          peak=Math.max(peak,equity); maxDD=Math.min(maxDD, equity-peak);
        }
        if(pos){
          const last = slice[slice.length-1];
          let pnl=0;
          if (pos.dir==='long') { if (pos.tp1Hit) pnl += 0.5*(pos.tp1 - pos.entry); pnl += 0.5*(last.price - pos.entry); }
          else { if (pos.tp1Hit) pnl += 0.5*(pos.entry - pos.tp1); pnl += 0.5*(pos.entry - last.price); }
          trades.push({dir:pos.dir, entry:pos.entry, exit:last.price, pnl, reason:"CloseEnd"}); equity += pnl;
          peak=Math.max(peak,equity); maxDD=Math.min(maxDD, equity-peak); curve.push({t:last.time,equity:Number(equity.toFixed(4))});
        }
        const wins=trades.filter(t=>t.pnl>0), losses=trades.filter(t=>t.pnl<=0);
        const winRate = trades.length ? (wins.length/trades.length)*100 : 0;
        const grossWin = wins.reduce((a,b)=>a+b.pnl,0); const grossLoss = Math.abs(losses.reduce((a,b)=>a+b.pnl,0));
        const pf = grossLoss>0 ? grossWin/grossLoss : (grossWin>0?Infinity:0);
        const mean = trades.length ? (trades.reduce((a,b)=>a+b.pnl,0)/trades.length) : 0;
        const variance = trades.length ? (trades.reduce((a,b)=>a + Math.pow(b.pnl-mean,2),0) / trades.length) : 0;
        const stdev = Math.sqrt(variance);
        const sharpe = stdev>0 ? mean / stdev : 0;
        return {trades, equity, maxDD, curve, winRate, pf, sharpe};
      }

      const res = runParams(ema.map((d, i) => ({
        time: d.time,
        price: d.price,
        ema: d.ema,
        vwap: vwap[i]?.vwap ?? d.price,
        rsi: rsi[i]?.rsi ?? 50,
        atr: atr[i]?.atr ?? 0,
        vma: volMA[i]?.vma ?? 0,
        sma: sma[i]?.sma ?? d.price,
        adx: adxArr[i]?.adx ?? 0,
        volume: mkSeries[i]?.volume ?? 0,
        hour: (() => { const t = new Date(now - (mkSeries.length - 1 - i) * 3600000); return t.getHours(); })(),
      })), { rsiMin:52, rsiMax:65, atrTicksMin:atrMinTicks });
      const pfVal = (()=>{const w = res.trades.filter(t=>t.pnl>0).reduce((a,b)=>a+b.pnl,0); const l = Math.abs(res.trades.filter(t=>t.pnl<=0).reduce((a,b)=>a+b.pnl,0)); return l>0? (w/l): (w>0?Infinity:0);})();
      const winRate = res.trades.length ? (res.trades.filter(t=>t.pnl>0).length / res.trades.length) * 100 : 0;

      const newState = { running:false, trades: res.trades.length, winRate: Number(winRate.toFixed(1)), pf: Number((pfVal===Infinity?999:pfVal).toFixed(2)), pnl: Number(res.equity.toFixed(4)), maxDD: Number(res.maxDD.toFixed(4)), curve: res.curve, tradesList: res.trades };
      setBt(newState);
      try { window.bt = newState; } catch(_) {}
  } catch(e){ console.error(e); } finally { setBt(prev => ({ ...prev, running: false })); } }

  function exportCSV(kind){
    try{
      if (kind==='trades'){
        const rows = ['time,dir,entry,exit,pnl,reason'];
        (window.bt?.tradesList || []).forEach(t=>{ rows.push([t.time||'', t.dir||'', t.entry, t.exit, t.pnl, t.reason||''].join(',')); });
        const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'trades.csv'; a.click(); URL.revokeObjectURL(url);
      } else {
        const rows = ['time,equity'];
        (window.bt?.curve || []).forEach(p=> rows.push([p.t, p.equity].join(',')));
        const blob = new Blob([rows.join('\\n')], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob); const a = document.createElement('a');
        a.href = url; a.download = 'equity_curve.csv'; a.click(); URL.revokeObjectURL(url);
      }
    } catch(e){ console.error(e); }
  }

  return (
    <div className="min-h-svh w-full bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 text-slate-100">
      <header className="sticky top-0 z-30 backdrop-blur bg-slate-900/70 border-b border-slate-800">
        <div className="max-w-xl mx-auto px-3 py-2 flex items-center justify-between">
          <div className="text-lg font-semibold">Fuck Off Market</div>
          <button onClick={runBacktest} className="btn text-sm">Backtest</button>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-3 py-4 space-y-4">
        <section className="grid grid-cols-2 gap-2">
          <select className="bg-slate-800 border border-slate-700 rounded p-2 text-sm" value={market.symbol} onChange={e=>setMarket(m=>({...m, symbol: e.target.value, tickSize: e.target.value==='WTI'?0.01:0.1}))}>
            <option value="XAUUSD">Gold</option>
            <option value="XAGUSD">Silber</option>
            <option value="WTI">WTI-Öl</option>
          </select>
          <select className="bg-slate-800 border border-slate-700 rounded p-2 text-sm" value={tradeDir} onChange={e=>setTradeDir(e.target.value)}>
            <option value="both">Long & Short</option>
            <option value="long">Nur Long</option>
            <option value="short">Nur Short</option>
          </select>
          <input className="bg-slate-800 border border-slate-700 rounded p-2 text-sm" value={riskTicks} onChange={e=>setRiskTicks(Number(e.target.value)||20)} placeholder="Risk (Ticks)" />
          <input className="bg-slate-800 border border-slate-700 rounded p-2 text-sm" value={atrMinTicks} onChange={e=>setAtrMinTicks(Number(e.target.value)||25)} placeholder="ATR-Min (Ticks)" />
          <button className="btn text-sm" onClick={()=>{
            const iso = prompt('Event (ISO: 2025-10-15T14:30)'); if(!iso) return;
            const d = new Date(iso); if (!isNaN(d.getTime())) setNewsEvents(prev=>[...prev, { ts: d.getTime(), label: 'Event', impact: 'hoch' }]);
          }}>News+</button>
          <button id="install-btn" onClick={()=>window.fo_install && window.fo_install()} className="btn text-sm hidden">Installieren</button>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <KPI label="Trades" value={bt.trades} />
          <KPI label="Win" value={`${bt.winRate}%`} />
          <KPI label="PF" value={bt.pf} />
          <KPI label="PnL" value={bt.pnl} />
          <KPI label="MaxDD" value={bt.maxDD} />
          <KPI label="Bars" value={mkSeries.length} />
        </section>

        <section className="card h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={ema}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" hide />
              <YAxis tick={{ fontSize: 10 }} domain={["auto", "auto"]} />
              <RTooltip />
              <Area type="monotone" dataKey="price" fillOpacity={0.15} />
              <Line type="monotone" dataKey="price" dot={false} />
              <Line type="monotone" dataKey="ema" dot={false} />
              <ReferenceLine x={ema[ema.length-1]?.time} strokeDasharray="2 2" />
              <Bar dataKey="volume" barSize={2} />
            </AreaChart>
          </ResponsiveContainer>
        </section>

        <section className="card h-48">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={bt.curve}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="t" hide />
              <YAxis tick={{ fontSize: 10 }} domain={["auto","auto"]} />
              <RTooltip />
              <Line type="monotone" dataKey="equity" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </section>

        <section className="flex gap-2">
          <button className="btn flex-1" onClick={()=>exportCSV('trades')}>Trades CSV</button>
          <button className="btn flex-1" onClick={()=>exportCSV('equity')}>Equity CSV</button>
        </section>
      </main>
    </div>
  )
}

function KPI({ label, value }){
  return (
    <div className="card px-3 py-2 text-center">
      <div className="text-[11px] text-slate-400">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
    </div>
  )
}
