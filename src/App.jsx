import React, { useMemo, useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, Legend, LabelList, CartesianGrid
} from "recharts";

/**
 * Dynasty Trade Calculator — Multi-Team + CSV import + Stacked Chart
 * - Multi-source ready (Demo + FantasyPros; easily extendable to KTC/Roto).
 * - Superflex/TEP toggles, KTC-like package adjustment, suggestions.
 * - CSV importers: FantasyPros Players, Draft Pick YEAR+slot (1.01 etc).
 * - NEW: Stacked bar chart with per-team total labels (uses adjusted totals).
 */

const uid = () => Math.random().toString(36).slice(2, 9);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const YEAR = new Date().getFullYear();

// ---------------- Demo Market (fallback) ----------------
const DEMO = [
  { name: "Josh Allen", position: "QB", age: 29, mkt_1qb: 850, mkt_sf: 1100 },
  { name: "Patrick Mahomes", position: "QB", age: 30, mkt_1qb: 840, mkt_sf: 1080 },
  { name: "C.J. Stroud", position: "QB", age: 23, mkt_1qb: 820, mkt_sf: 1060 },
  { name: "Jalen Hurts", position: "QB", age: 27, mkt_1qb: 800, mkt_sf: 1040 },
  { name: "Anthony Richardson", position: "QB", age: 22, mkt_1qb: 710, mkt_sf: 980 },
  { name: "Bijan Robinson", position: "RB", age: 22, mkt_1qb: 820, mkt_sf: 820 },
  { name: "Breece Hall", position: "RB", age: 24, mkt_1qb: 800, mkt_sf: 800 },
  { name: "Jahmyr Gibbs", position: "RB", age: 22, mkt_1qb: 740, mkt_sf: 740 },
  { name: "Christian McCaffrey", position: "RB", age: 29, mkt_1qb: 670, mkt_sf: 670 },
  { name: "Justin Jefferson", position: "WR", age: 25, mkt_1qb: 980, mkt_sf: 980 },
  { name: "Ja'Marr Chase", position: "WR", age: 25, mkt_1qb: 960, mkt_sf: 960 },
  { name: "Amon-Ra St. Brown", position: "WR", age: 25, mkt_1qb: 820, mkt_sf: 820 },
  { name: "Puka Nacua", position: "WR", age: 23, mkt_1qb: 760, mkt_sf: 760 },
  { name: "CeeDee Lamb", position: "WR", age: 25, mkt_1qb: 900, mkt_sf: 900 },
  { name: "Marvin Harrison Jr.", position: "WR", age: 22, mkt_1qb: 820, mkt_sf: 820 },
  { name: "Sam LaPorta", position: "TE", age: 23, mkt_1qb: 520, mkt_sf: 520 },
  { name: "Travis Kelce", position: "TE", age: 35, mkt_1qb: 260, mkt_sf: 260 },
];

// ---------------- Helpers ----------------
const ROUND_KEYS = ["1st", "2nd", "3rd", "4th", "5th"];
const basePickCurve = ({ superflex, tePremium }) => {
  const oneQB = { "1st": 600, "2nd": 220, "3rd": 90, "4th": 40, "5th": 20 };
  const sfMult = superflex ? { "1st": 1.25, "2nd": 1.15, "3rd": 1.1, "4th": 1.05, "5th": 1.05 } : { "1st": 1, "2nd": 1, "3rd": 1, "4th": 1, "5th": 1 };
  const tepMult = tePremium ? { "1st": 1.08, "2nd": 1.06, "3rd": 1.04, "4th": 1.02, "5th": 1.02 } : { "1st": 1, "2nd": 1, "3rd": 1, "4th": 1, "5th": 1 };
  const curve = {};
  for (const r of ROUND_KEYS) curve[r] = Math.round(oneQB[r] * sfMult[r] * tepMult[r]);
  return curve;
};
const slotToRoundKey = (slot) => {
  const rn = Number(String(slot).split(".")[0]);
  return ({1:"1st",2:"2nd",3:"3rd",4:"4th",5:"5th"})[rn] || "1st";
};
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  if (!lines.length) return [];
  const header = lines[0].split(",").map(h=>h.trim().toLowerCase());
  const rows = [];
  for (let i=1;i<lines.length;i++) {
    const cols = lines[i].split(",").map(c=>c.trim());
    const row = {};
    header.forEach((h,idx)=> row[h] = cols[idx]);
    rows.push(row);
  }
  return rows;
}
const norm = (s="") => String(s).toLowerCase().replace(/[^a-z0-9]+/g," ").trim();

// ---------------- Chart ----------------
function StackedTeamChart({ teams, getValue, label="Team Totals (Adjusted)", getAdjustedTotalForTeam }) {
  const maxSegs = Math.max(0, ...teams.map(t => (t.items?.length || 0)));
  const palette = ["#2563eb","#22c55e","#f97316","#a855f7","#06b6d4","#e11d48","#84cc16","#0ea5e9","#f59e0b","#10b981"];

  const data = teams.map(t => {
    const vals = (t.items || []).map(it => ({
      name: it.type === "player" ? (it.name || "Player") : `${it.year} ${it.round}`,
      value: Math.max(0, Number(getValue(it)) || 0)
    })).sort((a,b)=>b.value-a.value);

    const row = { team: t.name, total: getAdjustedTotalForTeam ? getAdjustedTotalForTeam(t) : vals.reduce((s,x)=>s+x.value,0) };
    for (let i=0;i<maxSegs;i++){
      row[`seg${i}`] = vals[i]?.value || 0;
      row[`seg${i}_label`] = vals[i]?.name || "";
    }
    return row;
  });

  const bars = [];
  for (let i=0;i<maxSegs;i++){
    const color = palette[i % palette.length];
    bars.push(
      <Bar key={`seg-${i}`} dataKey={`seg${i}`} stackId="stack" fill={color} isAnimationActive={false} />
    );
  }

  return (
    <div style={{border:"1px solid #e5e7eb", borderRadius:12, padding:12, background:"#fff"}}>
      <div style={{fontWeight:700, marginBottom:8}}>{label}</div>
      <div style={{width:"100%", height:320}}>
        <ResponsiveContainer>
          <BarChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 12 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="team" />
            <YAxis />
            <Tooltip formatter={(val, key, ctx) => {
              if (String(key).startsWith("seg")) {
                const idx = Number(String(key).replace("seg",""));
                const name = ctx?.payload?.[`seg${idx}_label`] || "Asset";
                return [val, name];
              }
              if (key === "total") return [val, "Team Total (Adjusted)"];
              return [val, key];
            }}/>
            <Legend payload={[
              { value: "Team Total (Adjusted)", id: "total", type: "line", color: "#111" },
              { value: "Assets (stacked)", id: "stack", type: "square", color: "#2563eb" }
            ]}/>
            <Bar dataKey="total" fill="transparent" isAnimationActive={false}>
              <LabelList dataKey="total" position="top"
                formatter={(v)=>(v?v.toLocaleString():"")}
                style={{ fontFamily:"ui-monospace,Menlo,monospace", fontSize:12, fill:"#111" }}
              />
            </Bar>
            {bars}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{fontSize:12, opacity:.7, marginTop:6}}>
        Stacks show per-asset raw sizes; labels show KTC-adjusted team totals.
      </div>
    </div>
  );
}

// ---------------- App ----------------
export default function App() {
  // League settings
  const [settings, setSettings] = useState({
    scoringMode: "PPR",
    superflex: true,
    tePremium: false,
    leagueSize: 12,
    ktcAdjustment: true,
    ktcDecay: 0.93,
  });

  // Teams
  const [teams, setTeams] = useState([
    { id: uid(), name: "Team A", items: [] },
    { id: uid(), name: "Team B", items: [] },
  ]);

  // Value source toggles (Demo + FantasyPros for now)
  const [valueSource, setValueSource] = useState("Demo"); // Demo | FantasyPros | Blend
  const [blendWeight, setBlendWeight] = useState(0.5);

  // FantasyPros players & picks
  const [fpPlayers, setFpPlayers] = useState([]); // {name, position, value, sf_value}
  const [fpPicks, setFpPicks] = useState({});     // { [year]: { slots:{}, rounds:{ "1st":{value,sf_value} } } }

  // Persist a bit
  useEffect(()=>{ try { localStorage.setItem("dtc_settings", JSON.stringify(settings)); } catch{} }, [settings]);
  useEffect(()=>{ try { localStorage.setItem("dtc_value_source", JSON.stringify(valueSource)); } catch{} }, [valueSource]);
  useEffect(()=>{ try { localStorage.setItem("dtc_blend_weight", JSON.stringify(blendWeight)); } catch{} }, [blendWeight]);

  const pickCurve = useMemo(() => basePickCurve({ superflex: settings.superflex, tePremium: settings.tePremium }), [settings.superflex, settings.tePremium]);

  // --- Team ops
  const addTeam = () => setTeams(t => [...t, { id: uid(), name: `Team ${String.fromCharCode(65+t.length)}`, items: [] }]);
  const removeTeam = (id) => setTeams(t => t.filter(x=>x.id!==id));
  const renameTeam = (id, name) => setTeams(t => t.map(x => x.id===id ? {...x, name} : x));
  const addPlayer = (teamId, p = { name: "", position: "WR", age: undefined }) =>
    setTeams(t => t.map(team => team.id===teamId ? ({...team, items: [...team.items, { id: uid(), type:"player", ...p }]}): team));
  const addPick = (teamId, year = YEAR+1, slot = "1.01") =>
    setTeams(t => t.map(team => team.id===teamId ? ({...team, items: [...team.items, { id: uid(), type:"pick", year, round: slot }]}): team));
  const removeItem = (teamId, itemId) =>
    setTeams(t => t.map(team => team.id===teamId ? ({...team, items: team.items.filter(i=>i.id!==itemId)}): team));
  const updateItem = (teamId, itemId, patch) =>
    setTeams(t => t.map(team => team.id===teamId ? ({...team, items: team.items.map(i => i.id===itemId ? {...i, ...patch} : i)}): team));

  // --- Value resolution
  function demoValueFor(p) {
    const row = DEMO.find(x => x.name === p.name && x.position?.toUpperCase() === (p.position||"").toUpperCase());
    if (!row) return 0;
    return settings.superflex ? row.mkt_sf : row.mkt_1qb;
  }
  function fpValueFor(p) {
    const row = fpPlayers.find(x => norm(x.name) === norm(p.name) && (x.position||"").toUpperCase() === (p.position||"").toUpperCase());
    if (!row) return 0;
    return settings.superflex ? (Number(row.sf_value)||0) : (Number(row.value)||0);
  }
  function resolvePlayerValue(p) {
    const demo = demoValueFor(p);
    const fp   = fpValueFor(p);
    if (valueSource === "FantasyPros") return fp;
    if (valueSource === "Blend") return Math.round((1-blendWeight)*demo + blendWeight*fp);
    return demo;
  }
  function valueFromPickMap(m, year, roundKey, slot) {
    if (!m?.[year]) return 0;
    const y = m[year];
    const slotRow  = y.slots?.[slot];
    const roundRow = y.rounds?.[roundKey] || y.rounds?.[String(slot).split(".")[0]];
    const base = slotRow
      ? (settings.superflex ? slotRow.sf_value : slotRow.value)
      : (roundRow ? (settings.superflex ? roundRow.sf_value : roundRow.value) : 0);
    return Number(base)||0;
  }
  function resolvePickValue(item) {
    const roundKey = slotToRoundKey(item.round);
    let base = pickCurve[roundKey] || 0;
    if (valueSource !== "Demo") {
      const fpBase = valueFromPickMap(fpPicks, item.year, roundKey, item.round);
      if (valueSource === "FantasyPros") base = fpBase || base;
      if (valueSource === "Blend") base = Math.round((1-blendWeight)*base + blendWeight*(fpBase||base));
    }
    const yearsOut = Number(item.year) - YEAR;
    const timeDisc = 1 - clamp(0.04 * yearsOut, 0, 0.16);
    return Math.round(base * timeDisc);
  }
  function computeItemValue(item) {
    if (item.type === "player") return resolvePlayerValue(item);
    if (item.type === "pick")   return resolvePickValue(item);
    return 0;
  }

  // --- Totals
  const teamRaw = teams.map(t => {
    const values = t.items.map(it => computeItemValue(it));
    const total  = values.reduce((s,v)=>s+v,0);
    return { id: t.id, name: t.name, values, total };
  });

  // KTC-like package penalty (decay on sorted items)
  const ktcDecay = clamp(Number(settings.ktcDecay)||0.93, 0.80, 0.99);
  const teamAdj = teamRaw.map(t => {
    if (!settings.ktcAdjustment) return { ...t, adj: t.total };
    const sorted = [...t.values].sort((a,b)=>b-a);
    const adj = Math.round(sorted.reduce((s,v,i)=> s + v*Math.pow(ktcDecay, i), 0));
    return { ...t, adj };
  });
  const grandAdj = teamAdj.reduce((s,t)=>s+t.adj,0);
  const avgAdj = teams.length ? Math.round(grandAdj/teams.length) : 0;

  // --- Suggestions
  const [pref, setPref] = useState("any"); // any | players | picks
  const [tol, setTol]   = useState(0.10);  // ±10%

  const poolPlayers = DEMO.map(d => ({
    key: `P|${d.name}`,
    type: "player",
    name: d.name,
    position: d.position,
    value: settings.superflex ? d.mkt_sf : d.mkt_1qb
  }));
  const poolPicks = ["1st","2nd","3rd","4th","5th"].map(r => ({
    key: `K|${YEAR+1}|${r}`,
    type: "pick",
    name: `${YEAR+1} ${r}`,
    value: pickCurve[r]
  }));
  let pool = [...poolPlayers, ...poolPicks].sort((a,b)=>a.value-b.value);
  if (pref === "players") pool = pool.filter(x=>x.type==="player").concat(pool.filter(x=>x.type==="pick"));
  if (pref === "picks")   pool = pool.filter(x=>x.type==="pick").concat(pool.filter(x=>x.type==="player"));

  function suggestForDelta(delta) {
    const need = Math.abs(delta);
    const lo = need * (1 - tol), hi = need * (1 + tol);
    const one = pool.find(x => x.value >= lo && x.value <= hi);
    if (one) return [one];
    for (let i=0;i<pool.length;i++) {
      for (let j=i;j<Math.min(pool.length,i+80);j++) {
        const s = pool[i].value + pool[j].value;
        if (s >= lo && s <= hi) return [pool[i], pool[j]];
      }
    }
    let best = pool[0];
    for (const x of pool) if (Math.abs(x.value - need) < Math.abs(best.value - need)) best = x;
    return [best];
  }

  // --- Importers handlers
  function onImportFPPlayers(rows) {
    const out = rows.map(r => ({
      name: r.name || r.player || "",
      team: r.team || "",
      position: (r.position || "").toUpperCase(),
      age: r.age ? Number(r.age) : undefined,
      value: Number(r.value)||0,
      sf_value: Number(r["sf value"])||Number(r.sf_value)||0,
    })).filter(x => x.name && x.position);
    setFpPlayers(out);
  }
  function onImportFPPicks(year, map) {
    // Convert rounds keyed by number "1" to "1st" etc
    const rounds = {};
    Object.keys(map.rounds||{}).forEach(rn => {
      const key = ({1:"1st",2:"2nd",3:"3rd",4:"4th",5:"5th"})[Number(rn)] || "1st";
      rounds[key] = map.rounds[rn];
    });
    setFpPicks(prev => ({ ...prev, [year]: { slots: map.slots||{}, rounds } }));
    try { window.__fpPickData = { ...(window.__fpPickData||{}), [year]: { slots: map.slots||{}, rounds } }; } catch {}
  }

  return (
    <div style={{fontFamily:"system-ui, Arial", padding:20, maxWidth:1200, margin:"0 auto"}}>
      <h1 style={{marginBottom:12}}>Dynasty Trade Calculator</h1>

      {/* League Settings */}
      <section style={card}>
        <h2 style={h2}>League Settings</h2>
        <div style={grid2}>
          <label>Scoring
            <select value={settings.scoringMode} onChange={e=>setSettings({...settings, scoringMode:e.target.value})} style={input}>
              <option>PPR</option><option>Half PPR</option><option>Standard</option>
            </select>
          </label>
          <label>League Size
            <input type="number" min="8" max="16" value={settings.leagueSize} onChange={e=>setSettings({...settings, leagueSize:Number(e.target.value)||12})} style={input}/>
          </label>
          <label><input type="checkbox" checked={settings.superflex} onChange={e=>setSettings({...settings, superflex:e.target.checked})}/> Superflex</label>
          <label><input type="checkbox" checked={settings.tePremium} onChange={e=>setSettings({...settings, tePremium:e.target.checked})}/> TE Premium</label>
        </div>
        <div style={{marginTop:10, display:"flex", gap:16, alignItems:"center", flexWrap:"wrap"}}>
          <label>Value Source
            <select value={valueSource} onChange={e=>setValueSource(e.target.value)} style={input}>
              <option>Demo</option><option>FantasyPros</option><option>Blend</option>
            </select>
          </label>
          {valueSource==="Blend" && (
            <label>Blend Weight (FP)
              <input type="number" step="0.05" min="0" max="1" value={blendWeight} onChange={e=>setBlendWeight(clamp(Number(e.target.value)||0.5,0,1))} style={input}/>
            </label>
          )}
          <label><input type="checkbox" checked={settings.ktcAdjustment} onChange={e=>setSettings({...settings, ktcAdjustment:e.target.checked})}/> KTC-like Adjustment</label>
          <label>Decay
            <input type="number" step="0.01" min="0.8" max="0.99" value={settings.ktcDecay} onChange={e=>setSettings({...settings, ktcDecay:e.target.value})} style={input}/>
          </label>
        </div>
      </section>

      {/* Import Values */}
      <section style={card}>
        <h2 style={h2}>Import Values</h2>
        <div style={{display:"flex", gap:16, flexWrap:"wrap"}}>
          <ImportFPPlayers onLoad={onImportFPPlayers}/>
          <ImportFPPicks onLoad={onImportFPPicks}/>
        </div>
        <div style={{fontSize:12, opacity:.7, marginTop:6}}>
          Players CSV: Name/Player, Position, Value, SF Value. &nbsp; Picks CSV: Round (1.01), Value, SF Value (choose YEAR).
        </div>
      </section>

      {/* Teams */}
      <section style={card}>
        <h2 style={h2}>Teams</h2>
        <div style={{display:"flex", gap:8, flexWrap:"wrap"}}>
          <button style={btn} onClick={addTeam}>+ Add Team</button>
        </div>
        <div style={{display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fit,minmax(300px,1fr))", marginTop:12}}>
          {teams.map(team => (
            <div key={team.id} style={subcard}>
              <div style={{display:"flex", gap:8, alignItems:"center", justifyContent:"space-between"}}>
                <input value={team.name} onChange={e=>renameTeam(team.id, e.target.value)} style={{...input, width:160}}/>
                <div style={{display:"flex", gap:6}}>
                  <button style={btn} onClick={()=>addPlayer(team.id)}>+ Player</button>
                  <button style={btn} onClick={()=>addPick(team.id, YEAR+1, "1.01")}>+ {YEAR+1} 1.01</button>
                  {teams.length>2 && <button style={{...btn, color:"#b00020"}} onClick={()=>removeTeam(team.id)}>Remove</button>}
                </div>
              </div>
              <div style={{marginTop:8}}>
                {team.items.length===0 && <div style={{opacity:.6, fontSize:12}}>No assets yet.</div>}
                {team.items.map(it => (
                  <div key={it.id} style={{display:"grid", gridTemplateColumns:"1fr 80px 80px 32px", gap:6, alignItems:"center", margin:"6px 0"}}>
                    {it.type === "player" ? (
                      <>
                        <input placeholder="Player name" value={it.name} onChange={e=>updateItem(team.id, it.id, { name:e.target.value })} style={input}/>
                        <select value={it.position} onChange={e=>updateItem(team.id, it id, { position:e.target.value })} style={input}>
                          <option>QB</option><option>RB</option><option>WR</option><option>TE</option>
                        </select>
                        <input placeholder="Age" type="number" value={it.age||""} onChange={e=>updateItem(team.id, it.id, { age: e.target.value? Number(e.target.value): undefined })} style={input}/>
                      </>
                    ) : (
                      <>
                        <input placeholder="Year" type="number" value={it.year} onChange={e=>updateItem(team.id, it.id, { year: Number(e.target.value)||it.year })} style={input}/>
                        <input placeholder="Slot (e.g., 1.07)" value={it.round} onChange={e=>updateItem(team.id, it.id, { round:e.target.value })} style={input}/>
                        <div style={{fontFamily:"monospace", fontSize:12, textAlign:"right"}}>{resolvePickValue(it).toLocaleString()}</div>
                      </>
                    )}
                    <button style={btnSm} onClick={()=>removeItem(team.id, it.id)}>✕</button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Results */}
      <section style={card}>
        <h2 style={h2}>Results (KTC-Adjusted)</h2>
        <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))", gap:12}}>
          <div style={subcard}>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={label}>Grand (Adj)</span><span style={mono}>{grandAdj.toLocaleString()}</span></div>
            <div style={{display:"flex", justifyContent:"space-between"}}><span style={label}>Avg / Team (Adj)</span><span style={mono}>{avgAdj.toLocaleString()}</span></div>
            <div style={{fontSize:12, opacity:.7, marginTop:8}}>Decay = {ktcDecay.toFixed(2)} (2nd piece ≈ {Math.round(ktcDecay*100)}%).</div>
          </div>
          <div style={subcard}>
            <div style={{fontWeight:600, marginBottom:6}}>Numeric Diff (Adj)</div>
            {teamAdj.map(t=>{
              const delta = t.adj - avgAdj;
              return (
                <div key={t.id} style={{display:"flex", justifyContent:"space-between"}}>
                  <span>{t.name}</span>
                  <span style={{...mono, color: delta<0 ? "#1d4ed8" : "#b45309"}}>{delta>=0?"+":""}{delta.toLocaleString()}</span>
                </div>
              );
            })}
          </div>
          <div style={subcard}>
            <div style={{fontWeight:600, marginBottom:6}}>Suggestions (to make even)</div>
            <div style={{display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:6, fontSize:12}}>
              <label><input type="radio" name="pref" checked={pref==="any"} onChange={()=>setPref("any")}/> Any</label>
              <label><input type="radio" name="pref" checked={pref==="players"} onChange={()=>setPref("players")}/> Players</label>
              <label><input type="radio" name="pref" checked={pref==="picks"} onChange={()=>setPref("picks")}/> Picks</label>
              <label>Tolerance ±
                <input type="number" step="0.01" min="0.01" max="0.5" value={tol} onChange={e=>setTol(clamp(Number(e.target.value)||0.10,0.01,0.5))} style={{...input, width:70, marginLeft:6}}/>
              </label>
            </div>
            {teamAdj.map(t=>{
              const delta = t.adj - avgAdj;
              if (Math.abs(delta) <= 1) return <div key={t.id} style={{opacity:.7, fontSize:12}}>{t.name}: already even.</div>;
              if (delta > 0) return <div key={t.id} style={{opacity:.7, fontSize:12}}>{t.name}: surplus — consider removing a depth piece.</div>;
              const picks = suggestForDelta(delta);
              return (
                <div key={t.id}>
                  <div style={{fontWeight:600}}>{t.name} needs ~{Math.abs(delta).toLocaleString()}</div>
                  <ul style={{marginTop:4, marginBottom:8, paddingLeft:18}}>
                    {picks.map((x,i)=>(<li key={`${t.id}|${x.key}|${i}`}><span style={mono}>+{x.value}</span> → {x.name}</li>))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>

        {/* NEW: Stacked bar chart */}
        <div style={{marginTop:12}}>
          <StackedTeamChart
            teams={teams}
            label="Team Totals (Adjusted) — Stacked by Asset"
            getValue={(item) => computeItemValue(item)}                 // segment sizes = raw per-asset contributions
            getAdjustedTotalForTeam={(team) => {
              const row = teamAdj.find(x=>x.id===team.id);
              return row ? row.adj : 0;                                 // label on top = adjusted team total
            }}
          />
        </div>
      </section>

      <footer style={{fontSize:12, opacity:.6, marginTop:18}}>
        Tip: Switch Value Source to <b>FantasyPros</b> or <b>Blend</b> after importing your CSVs.
      </footer>
    </div>
  );
}

// ---------------- Importers ----------------
function ImportFPPlayers({ onLoad }) {
  function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = parseCSV(String(reader.result));
        const rows = raw.map(r => ({
          name: r.name || r.player || "",
          team: r.team || "",
          position: (r.position || "").toUpperCase(),
          age: r.age ? Number(r.age) : undefined,
          value: Number(r.value)||0,
          sf_value: Number(r["sf value"])||Number(r.sf_value)||0,
        })).filter(x => x.name && x.position);
        onLoad(rows);
      } catch (e) {
        alert("Could not parse Players CSV. Expected headers: Name/Player, Position, Value, SF Value");
      }
    };
    reader.readAsText(file);
  }
  return (
    <label style={uploader}>
      Import FantasyPros CSV (Players)
      <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={handle}/>
    </label>
  );
}

function ImportFPPicks({ onLoad }) {
  const [year, setYear] = useState(YEAR+1);
  function handle(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = parseCSV(String(reader.result));
        const slots = {}, buckets = {};
        raw.forEach(row => {
          const slot = (row.round||"").trim(); if (!slot) return;
          const v = Number(row.value)||0, vsf = Number(row["sf value"])||Number(row.sf_value)||v;
          slots[slot] = { value: v, sf_value: vsf };
          const rn = String(slot).split(".")[0];
          (buckets[rn] ||= []).push({ value:v, sf_value:vsf });
        });
        const rounds = {};
        Object.keys(buckets).forEach(rn => {
          const arr = buckets[rn];
          rounds[rn] = {
            value:  Math.round(arr.reduce((s,x)=>s+x.value,0)/arr.length),
            sf_value: Math.round(arr.reduce((s,x)=>s+x.sf_value,0)/arr.length)
          };
        });
        onLoad(year, { slots, rounds });
      } catch (e) {
        alert("Could not parse Picks CSV. Expected headers: Round (1.01), Value, SF Value");
      }
    };
  reader.readAsText(file);
  }
  return (
    <div style={{display:"flex", alignItems:"center", gap:8}}>
      <label>Year <input type="number" value={year} onChange={e=>setYear(Number(e.target.value)||year)} style={{...input, width:90}}/></label>
      <label style={uploader}>
        Import Draft Pick CSV
        <input type="file" accept=".csv,text/csv" style={{display:"none"}} onChange={handle}/>
      </label>
    </div>
  );
}

// ---------------- Tiny styles ----------------
const card   = { border:"1px solid #e5e7eb", borderRadius:12, padding:12, marginBottom:12, background:"#fff" };
const subcard= { border:"1px solid #eef1f5", borderRadius:10, padding:10, background:"#fafafa" };
const h2     = { fontSize:16, fontWeight:700, marginBottom:8 };
const grid2  = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))", gap:10, alignItems:"center" };
const input  = { border:"1px solid #d1d5db", borderRadius:6, padding:"6px 8px", width:150 };
const btn    = { border:"1px solid #d1d5db", borderRadius:8, padding:"6px 10px", background:"#fff", cursor:"pointer" };
const btnSm  = { border:"1px solid #d1d5db", borderRadius:6, padding:"4px 6px", background:"#fff", cursor:"pointer" };
const label  = { opacity:.7 };
const mono   = { fontFamily:"ui-monospace, SFMono-Regular, Menlo, monospace" };
const uploader = { border:"1px dashed #d1d5db", borderRadius:8, padding:"8px 10px", background:"#f9fafb", cursor:"pointer" };

