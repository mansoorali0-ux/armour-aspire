import { useState, useEffect, useRef } from "react";
import { db, saveGame, listenToGames, updateGame as fbUpdateGame } from "./firebase";
import {
  ROSTER, DEFAULT_POS, LEAGUE_TEAMS, TOURNAMENT_TEAMS, POSITIONS, POS_COLOR,
  FEATURED_ID, HALF_DURATION, GAME_DURATION,
  uid, pById, calcPlayerStats, makeLVURushGame, makeCoppermineGame
} from "./data";


const S = {
  screen: { minHeight:"100vh", background:"#060e1a", color:"#e2e8f0", fontFamily:"-apple-system, sans-serif", paddingBottom:32 },
  header: { background:"linear-gradient(135deg,#1e3a5f,#0f2544)", padding:"16px", borderBottom:"3px solid #2563eb" },
  card:   { background:"#0f172a", border:"1px solid #1e3a5f", borderRadius:12, padding:"12px 14px", marginBottom:10 },
  btn:    (bg, color="#fff") => ({ background:bg, border:"none", borderRadius:10, color, fontWeight:700, cursor:"pointer", padding:"14px", fontSize:14 }),
  lbl:    { fontSize:11, color:"#64748b", fontWeight:700, letterSpacing:1, marginBottom:8, textTransform:"uppercase" },
  input:  { width:"100%", padding:12, borderRadius:10, background:"#1e3a5f", border:"1px solid #334155", color:"#e2e8f0", fontSize:16, boxSizing:"border-box" },
};

function Lbl({ children, mt }) {
  return <div style={{...S.lbl, marginTop:mt||0}}>{children}</div>;
}

function Badge({ gf, ga }) {
  const r = gf>ga?"W":gf<ga?"L":"D";
  const c = r==="W"?"#059669":r==="L"?"#dc2626":"#d97706";
  return <span style={{background:c,color:"#fff",borderRadius:6,padding:"3px 10px",fontSize:13,fontWeight:800}}>{r}</span>;
}


function Modal({ title, onClose, children }) {
  return (
    <div onClick={e=>{if(e.target===e.currentTarget)onClose();}}
      style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.85)",zIndex:200,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div style={{background:"#0f172a",borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"88vh",overflowY:"auto",border:"1px solid #1e3a5f"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 20px",borderBottom:"1px solid #1e3a5f",position:"sticky",top:0,background:"#0f172a"}}>
          <span style={{fontWeight:800,fontSize:16,color:"#e2e8f0"}}>{title}</span>
          <button onClick={onClose} style={{background:"#1e3a5f",border:"none",color:"#94a3b8",borderRadius:8,width:32,height:32,cursor:"pointer",fontSize:14}}>X</button>
        </div>
        <div style={{padding:"16px 20px"}}>{children}</div>
      </div>
    </div>
  );
}


function Loading() {
  return (
    <div style={{minHeight:"100vh",background:"#060e1a",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontSize:22,fontWeight:800,color:"#60a5fa"}}>BALTIMORE ARMOUR</div>
      <div style={{fontSize:12,color:"#93c5fd",letterSpacing:3}}>11G ASPIRE</div>
      <div style={{marginTop:20,width:40,height:40,border:"3px solid #1e3a5f",borderTop:"3px solid #2563eb",borderRadius:"50%",animation:"spin 1s linear infinite"}} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      <div style={{fontSize:12,color:"#475569"}}>Loading...</div>
    </div>
  );
}


function GameDetail({ game, onClose, onUpdate }) {
  const [events, setEvents] = useState(game.events||[]);
  const [editEv, setEditEv] = useState(null);
  const [editMin, setEditMin] = useState("");
  const [editScorer, setEditScorer] = useState(null);
  const [editAssist, setEditAssist] = useState(null);
  const [saving, setSaving] = useState(false);
  const allP = game.allPlayers||ROSTER;
  const stats = calcPlayerStats([{...game,events}]);

  const pName = id => pById(id,allP)?.name||"?";
  const pNum  = id => pById(id,allP)?.num||"?";

  const openEdit = ev => {
    setEditEv(ev); setEditMin(String(ev.minute));
    setEditScorer(ev.scorer||null); setEditAssist(ev.assist||null);
  };

  const saveEdit = async () => {
    const updated = events.map(e=>e.id===editEv.id?{...e,minute:parseInt(editMin)||0,scorer:editScorer,assist:editAssist}:e);
    setEvents(updated);
    const updatedGame = {...game,events:updated};
    setSaving(true);
    await fbUpdateGame(updatedGame);
    setSaving(false);
    onUpdate(updatedGame);
    setEditEv(null);
  };

  const delEdit = async () => {
    const updated = events.filter(e=>e.id!==editEv.id);
    setEvents(updated);
    const updatedGame = {...game,events:updated,
      scoreFor: game.scoreFor-(editEv.type==="goal_for"?1:0),
      scoreAgainst: game.scoreAgainst-(editEv.type==="goal_against"?1:0)
    };
    setSaving(true);
    await fbUpdateGame(updatedGame);
    setSaving(false);
    onUpdate(updatedGame);
    setEditEv(null);
  };

  const goalEvs = events.filter(e=>e.type==="goal_for"||e.type==="goal_against").sort((a,b)=>a.minute-b.minute);
  const subEvs  = events.filter(e=>e.type==="sub").sort((a,b)=>a.minute-b.minute);
  const playerList = allP.filter(p=>(stats[String(p.id)]?.gamesPlayed||0)>0).sort((a,b)=>(stats[String(b.id)]?.totalMins||0)-(stats[String(a.id)]?.totalMins||0));
  const result = game.scoreFor>game.scoreAgainst?"WIN":game.scoreFor<game.scoreAgainst?"LOSS":"DRAW";
  const rc = result==="WIN"?"#059669":result==="LOSS"?"#dc2626":"#d97706";

  return (
    <div style={S.screen}>
      <div style={S.header}>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#60a5fa",fontSize:14,fontWeight:700,cursor:"pointer",padding:0,marginBottom:8}}>{"< Back"}</button>
        <div style={{fontSize:11,color:"#64748b",marginBottom:4}}>{game.date} ? {game.venue} ? {game.status==="completed"?"COMPLETED":""}</div>
        <div style={{fontSize:15,fontWeight:800,color:"#60a5fa",marginBottom:8}}>vs {game.opponent.split(" ").slice(0,4).join(" ")}</div>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:48,fontWeight:900,color:"#fff",lineHeight:1}}>{game.scoreFor}<span style={{color:"#334155",margin:"0 8px"}}>-</span>{game.scoreAgainst}</span>
          <span style={{background:rc,color:"#fff",borderRadius:8,padding:"6px 16px",fontWeight:800,fontSize:16}}>{result}</span>
        </div>
        {saving&&<div style={{fontSize:11,color:"#10b981",marginTop:6}}>Saving to cloud...</div>}
        <div style={{fontSize:11,color:"#64748b",marginTop:6}}>Tap any event to edit</div>
      </div>

      <div style={{padding:14,maxWidth:480,margin:"0 auto"}}>
        {/* Starting Lineups */}
        <Lbl>Starting Lineup</Lbl>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:12}}>
          {(game.starting||[]).map(id=>{
            const p=pById(id,allP); if(!p) return null;
            const pos=(game.positions||{})[id]||p.pos;
            return (
              <div key={id} style={{display:"flex",alignItems:"center",gap:6,background:"#0f172a",border:String(id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f",borderRadius:8,padding:"7px 10px"}}>
                <span style={{width:22,height:22,borderRadius:"50%",background:POS_COLOR[pos]||"#475569",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:9,color:"#fff",flexShrink:0}}>{p.num}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:String(id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ")[0]}</div>
                  <div style={{fontSize:9,color:POS_COLOR[pos]||"#64748b"}}>{pos}</div>
                </div>
              </div>
            );
          })}
        </div>

        {game.secondHalfStarting&&(
          <>
            <Lbl>2nd Half Lineup</Lbl>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5,marginBottom:12}}>
              {game.secondHalfStarting.map(id=>{
                const p=pById(id,allP); if(!p) return null;
                const pos=DEFAULT_POS[id]||p.pos;
                return (
                  <div key={id} style={{display:"flex",alignItems:"center",gap:6,background:"#0f172a",border:String(id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f",borderRadius:8,padding:"7px 10px"}}>
                    <span style={{width:22,height:22,borderRadius:"50%",background:POS_COLOR[pos]||"#475569",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:9,color:"#fff",flexShrink:0}}>{p.num}</span>
                    <div style={{minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:700,color:String(id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ")[0]}</div>
                      <div style={{fontSize:9,color:POS_COLOR[pos]||"#64748b"}}>{pos}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {/* Goals */}
        <Lbl mt={8}>Goals</Lbl>
        {goalEvs.length===0&&<div style={{color:"#475569",fontSize:13,marginBottom:12}}>No goals logged</div>}
        {goalEvs.map(ev=>(
          <div key={ev.id} onClick={()=>openEdit(ev)} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:10,padding:"10px 14px",marginBottom:6,cursor:"pointer"}}>
            <span style={{fontSize:13,fontWeight:800,color:ev.type==="goal_for"?"#60a5fa":"#f87171",minWidth:32}}>{ev.minute}'</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>
                {ev.type==="goal_for"?(ev.ownGoal?"Own Goal (opp)":pName(ev.scorer)):"Goal Conceded"}
              </div>
              {ev.type==="goal_for"&&!ev.ownGoal&&ev.assist&&<div style={{fontSize:11,color:"#10b981"}}>Assist: {pName(ev.assist)}</div>}
              {ev.type==="goal_for"&&!ev.ownGoal&&!ev.assist&&<div style={{fontSize:11,color:"#475569"}}>No assist logged</div>}
            </div>
            <span style={{fontSize:11,color:"#64748b",fontWeight:700}}>{ev.score}</span>
            <span style={{fontSize:10,color:"#2563eb"}}>edit</span>
          </div>
        ))}

        {/* Subs */}
        <Lbl mt={12}>Substitutions</Lbl>
        {subEvs.length===0&&<div style={{color:"#475569",fontSize:13,marginBottom:12}}>No subs logged</div>}
        {subEvs.map(ev=>(
          <div key={ev.id} onClick={()=>openEdit(ev)} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:10,padding:"10px 14px",marginBottom:6,cursor:"pointer"}}>
            <span style={{fontSize:13,fontWeight:800,color:"#f59e0b",minWidth:32}}>{ev.minute}'</span>
            <div style={{flex:1}}>
              <div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>#{pNum(ev.playerOn)} {pName(ev.playerOn)} on</div>
              <div style={{fontSize:11,color:"#64748b"}}>#{pNum(ev.playerOff)} {pName(ev.playerOff)} off</div>
            </div>
            <span style={{fontSize:10,color:"#2563eb"}}>edit</span>
          </div>
        ))}

        {/* Minutes */}
        <Lbl mt={12}>Minutes Played</Lbl>
        {playerList.map(p=>{
          const s=stats[String(p.id)]; if(!s) return null;
          return (
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",border:String(p.id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f",borderRadius:10,padding:"10px 14px",marginBottom:5}}>
              <span style={{width:28,height:28,borderRadius:"50%",background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,color:"#93c5fd",flexShrink:0}}>#{p.num}</span>
              <span style={{flex:1,fontWeight:600,fontSize:13,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span>
              <span style={{fontSize:16,fontWeight:800,color:"#60a5fa"}}>{s.totalMins}'</span>
              {s.goalsScored>0&&<div style={{background:"#1e3a5f",borderRadius:6,padding:"3px 8px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:"#60a5fa"}}>{s.goalsScored}</div><div style={{fontSize:8,color:"#64748b"}}>G</div></div>}
              {s.assistsGiven>0&&<div style={{background:"#1e3a5f",borderRadius:6,padding:"3px 8px",textAlign:"center"}}><div style={{fontSize:13,fontWeight:800,color:"#10b981"}}>{s.assistsGiven}</div><div style={{fontSize:8,color:"#64748b"}}>A</div></div>}
            </div>
          );
        })}

        {/* Optimum XI */}
        <Lbl mt={20}>Optimum XI -- This Game</Lbl>
        {(()=>{
          const eligible=allP.map(p=>({...p,...(stats[String(p.id)]||{})})).filter(p=>(stats[String(p.id)]?.gamesPlayed||0)>0&&stats[String(p.id)]?.net80!==null);
          const top11=[...eligible].sort((a,b)=>(b.net80||0)-(a.net80||0)).slice(0,11);
          const byPos={GK:[],DEF:[],MID:[],FWD:[]};
          top11.forEach(p=>{ if(byPos[p.pos]) byPos[p.pos].push(p); });
          return ["GK","DEF","MID","FWD"].map(pos=>byPos[pos].length>0&&(
            <div key={pos} style={{marginBottom:10}}>
              <div style={{fontSize:9,fontWeight:800,color:POS_COLOR[pos],letterSpacing:1,marginBottom:5}}>{pos}</div>
              {byPos[pos].map(p=>(
                <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,background:"#0f172a",border:String(p.id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f",borderRadius:10,padding:"8px 12px",marginBottom:4}}>
                  <span style={{width:26,height:26,borderRadius:"50%",background:POS_COLOR[pos],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:"#fff",flexShrink:0}}>{p.num}</span>
                  <span style={{flex:1,fontWeight:700,fontSize:13,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:14,fontWeight:900,color:parseFloat(stats[String(p.id)]?.net80)>=0?"#10b981":"#f87171"}}>{stats[String(p.id)]?.net80Str||"-"}</div>
                    <div style={{fontSize:9,color:"#64748b"}}>NET/80</div>
                  </div>
                </div>
              ))}
            </div>
          ));
        })()}
      </div>

      {/* Edit Modal */}
      {editEv&&(
        <Modal title="Edit Event" onClose={()=>setEditEv(null)}>
          <Lbl>Minute</Lbl>
          <input value={editMin} onChange={e=>setEditMin(e.target.value)} type="number" style={{...S.input,fontSize:20,fontWeight:700,marginBottom:12}} />
          {editEv.type==="goal_for"&&(<>
            <Lbl>Scorer</Lbl>
            {allP.map(p=><button key={p.id} onClick={()=>setEditScorer(String(p.id))} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:editScorer===String(p.id)?"#1d4ed8":"#1e3a5f",border:editScorer===String(p.id)?"2px solid #60a5fa":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}</button>)}
            <Lbl mt={8}>Assist</Lbl>
            <button onClick={()=>setEditAssist(null)} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:editAssist===null?"#475569":"#1e3a5f",border:"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>No Assist</button>
            {allP.filter(p=>String(p.id)!==editScorer).map(p=><button key={p.id} onClick={()=>setEditAssist(editAssist===String(p.id)?null:String(p.id))} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:editAssist===String(p.id)?"#065f46":"#1e3a5f",border:editAssist===String(p.id)?"2px solid #10b981":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}</button>)}
          </>)}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={delEdit}  style={{...S.btn("#7f1d1d","#fca5a5"),flex:1}}>Delete</button>
            <button onClick={saveEdit} style={{...S.btn("#2563eb"),flex:2}}>Save</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function HomeScreen({ games, onStart, onStats, onViewGame }) {
  const [showNew, setShowNew] = useState(false);
  const [type, setType]       = useState("regular");
  const [opp, setOpp]         = useState("");
  const [customOpp, setCustomOpp] = useState("");
  const [venue, setVenue]     = useState("Home");
  const teams = type==="regular" ? LEAGUE_TEAMS : TOURNAMENT_TEAMS;
  const played = new Set(games.map(g=>g.opponent));

  const go = () => {
    const opponent = opp==="__custom__" ? customOpp.trim() : opp;
    if (!opponent) return;
    onStart({ type, opponent, venue });
    setShowNew(false);
  };

  return (
    <div style={S.screen}>
      <div style={{...S.header, textAlign:"center", padding:"28px 16px 18px"}}>
        <div style={{fontSize:24,fontWeight:800,color:"#60a5fa",letterSpacing:1}}>BALTIMORE ARMOUR</div>
        <div style={{fontSize:12,color:"#93c5fd",letterSpacing:3,fontWeight:600,marginTop:2}}>11G ASPIRE</div>
        <div style={{fontSize:11,color:"#475569",marginTop:4}}>2025/26 Season</div>
      </div>

      <div style={{padding:16,maxWidth:480,margin:"0 auto"}}>
        {/* Results */}
        {games.length>0&&(
          <>
            <Lbl>Results -- tap to view</Lbl>
            {games.slice().reverse().map((g,i)=>(
              <button key={i} onClick={()=>onViewGame(g)} style={{background:"#0d2137",border:"2px solid #059669",borderRadius:12,padding:"14px",marginBottom:8,width:"100%",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div>
                  <div style={{fontWeight:700,fontSize:14,color:"#e2e8f0"}}>vs {g.opponent.split(" ").slice(0,3).join(" ")}</div>
                  <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{g.date} ? {g.venue} ? {g.type==="tournament"?"Cup":"League"}</div>
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:4}}>
                  <span style={{fontSize:28,fontWeight:900,color:"#fff",lineHeight:1}}>{g.scoreFor}-{g.scoreAgainst}</span>
                  <Badge gf={g.scoreFor} ga={g.scoreAgainst} />
                </div>
              </button>
            ))}
            <div style={{height:8}} />
          </>
        )}

        {/* Upcoming */}
        {(() => {
          const upcoming = [
            {date:"May 16, 2026", opp:"Keystone FC 11G Aspire",                          venue:"Home", type:"regular"},
            {date:"May 23, 2026", opp:"Ellicott City Soccer Club CiTY 2011 Girls Elite", venue:"Away", type:"tournament"},
            {date:"May 23, 2026", opp:"Olney Strikers Blue 2011",                         venue:"Away", type:"tournament"},
            {date:"Nov 23, 2026", opp:"Keystone FC 11G Aspire",                           venue:"Away", type:"regular"},
          ].filter(g=>!played.has(g.opp));
          if (upcoming.length===0) return null;
          return (
            <>
              <Lbl>Upcoming</Lbl>
              {upcoming.map((g,i)=>(
                <button key={i} onClick={()=>{setType(g.type);setOpp(g.opp);setVenue(g.venue);setShowNew(true);}}
                  style={{background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:12,padding:"12px 14px",marginBottom:8,width:"100%",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div>
                    <div style={{fontWeight:700,fontSize:13,color:"#e2e8f0"}}>vs {g.opp.split(" ").slice(0,3).join(" ")}</div>
                    <div style={{fontSize:11,color:"#64748b"}}>{g.date} ? {g.venue}</div>
                  </div>
                  <span style={{background:g.type==="tournament"?"#7c3aed":"#1d4ed8",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:10,fontWeight:700}}>{g.type==="tournament"?"CUP":"LEAGUE"}</span>
                </button>
              ))}
              <div style={{height:8}} />
            </>
          );
        })()}

        {/* Actions */}
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>{setOpp("");setShowNew(true);}} style={{...S.btn("#2563eb"),flex:1}}>+ New Game</button>
          <button onClick={onStats} style={{...S.btn("#1e3a5f","#93c5fd"),flex:1}}>Season Stats</button>
        </div>
      </div>

      {showNew&&(
        <Modal title="New Game" onClose={()=>setShowNew(false)}>
          <Lbl>Game Type</Lbl>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {["regular","tournament"].map(t=><button key={t} onClick={()=>{setType(t);setOpp("");}} style={{...S.btn(type===t?"#2563eb":"#1e3a5f",type===t?"#fff":"#64748b"),flex:1}}>{t==="regular"?"League":"Cup"}</button>)}
          </div>
          <Lbl>Venue</Lbl>
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            {["Home","Away"].map(v=><button key={v} onClick={()=>setVenue(v)} style={{...S.btn(venue===v?"#2563eb":"#1e3a5f",venue===v?"#fff":"#64748b"),flex:1}}>{v}</button>)}
          </div>
          <Lbl>Opponent</Lbl>
          {teams.map(t=><button key={t} onClick={()=>setOpp(t)} style={{width:"100%",padding:"12px 14px",borderRadius:10,marginBottom:5,textAlign:"left",cursor:"pointer",fontWeight:600,fontSize:13,background:opp===t?"#1d4ed8":"#1e3a5f",border:opp===t?"2px solid #60a5fa":"1px solid #1e3a5f",color:opp===t?"#fff":"#94a3b8"}}>{t}</button>)}
          <button onClick={()=>setOpp("__custom__")} style={{width:"100%",padding:"12px 14px",borderRadius:10,marginBottom:8,textAlign:"left",cursor:"pointer",fontWeight:600,fontSize:13,background:opp==="__custom__"?"#1d4ed8":"#1e3a5f",border:"1px dashed #334155",color:"#94a3b8"}}>+ Other / Tournament Final</button>
          {opp==="__custom__"&&<input value={customOpp} onChange={e=>setCustomOpp(e.target.value)} placeholder="Enter opponent name..." style={{...S.input,marginBottom:10}} />}
          <button onClick={go} style={{...S.btn("#2563eb"),width:"100%",padding:16,fontSize:15,marginTop:4}}>Continue to Lineup</button>
        </Modal>
      )}
    </div>
  );
}


function LineupScreen({ gameInfo, onKickoff, onBack }) {
  const [selected, setSelected] = useState([]);
  const [overrides, setOverrides] = useState({});
  const [avail, setAvail]   = useState(Object.fromEntries(ROSTER.map(p=>[p.id,"available"])));
  const [posModal, setPosModal] = useState(null);
  const [guests, setGuests] = useState([]);
  const [guestName, setGuestName] = useState("");
  const [showGuest, setShowGuest] = useState(false);

  const allP = [...ROSTER,...guests];
  const available   = allP.filter(p=>avail[p.id]!=="injured"&&avail[p.id]!=="absent");
  const unavailable = allP.filter(p=>avail[p.id]==="injured"||avail[p.id]==="absent");
  const posFor = id => overrides[id]||DEFAULT_POS[id]||"MID";

  const toggle = id => {
    if (selected.includes(id)) setSelected(s=>s.filter(x=>x!==id));
    else if (selected.length<11) setSelected(s=>[...s,id]);
  };
  const cycleAvail = (id,e) => {
    e.stopPropagation();
    const next={available:"injured",injured:"absent",absent:"available"};
    setAvail(a=>({...a,[id]:next[a[id]||"available"]}));
    setSelected(s=>s.filter(x=>x!==id));
  };
  const addGuest = () => {
    if (!guestName.trim()) return;
    const g={id:"G_"+uid(),num:"G",name:guestName.trim(),pos:"MID",isGuest:true};
    setGuests(gs=>[...gs,g]); setAvail(a=>({...a,[g.id]:"available"}));
    setGuestName(""); setShowGuest(false);
  };
  const kickoff = () => {
    if (selected.length!==11) return;
    const positions = Object.fromEntries(selected.map(id=>[id,posFor(id)]));
    onKickoff({...gameInfo,starting:selected,positions,avail,guests,allPlayers:[...ROSTER,...guests]});
  };

  return (
    <div style={{...S.screen,paddingBottom:100}}>
      <div style={S.header}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#60a5fa",fontSize:14,fontWeight:700,cursor:"pointer",padding:0,marginBottom:8}}>{"< Back"}</button>
        <div style={{fontSize:16,fontWeight:800,color:"#60a5fa"}}>vs {gameInfo.opponent?.split(" ").slice(0,4).join(" ")}</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:6}}>
          <div style={{fontSize:12,color:"#94a3b8"}}>Tap players to pick XI ? tap badge to mark unavailable</div>
          <div style={{fontSize:22,fontWeight:900,color:selected.length===11?"#10b981":"#f59e0b"}}>{selected.length}<span style={{fontSize:13,color:"#64748b"}}>/11</span></div>
        </div>
      </div>

      <div style={{padding:"12px 14px",maxWidth:480,margin:"0 auto"}}>
        {available.map(p=>{
          const isSel=selected.includes(p.id);
          const pos=posFor(p.id);
          return (
            <div key={p.id} onClick={()=>toggle(p.id)} style={{display:"flex",alignItems:"center",gap:10,background:isSel?"#0d2137":"#0f172a",border:isSel?"2px solid #2563eb":String(p.id)===String(FEATURED_ID)?"2px solid #1e3a5f":"1px solid #1e3a5f",borderRadius:12,padding:"12px",marginBottom:6,cursor:"pointer"}}>
              <div style={{width:26,height:26,borderRadius:"50%",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:isSel?"#2563eb":"#1e3a5f",border:isSel?"2px solid #60a5fa":"1px solid #334155"}}>
                {isSel?<span style={{fontSize:13,fontWeight:900,color:"#fff"}}>v</span>:<span style={{fontSize:10,fontWeight:700,color:"#475569"}}>{p.num}</span>}
              </div>
              <span style={{flex:1,fontWeight:700,fontSize:14,color:isSel?"#e2e8f0":String(p.id)===String(FEATURED_ID)?"#93c5fd":"#94a3b8"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span>
              {isSel&&<button onClick={e=>{e.stopPropagation();setPosModal(p.id);}} style={{background:POS_COLOR[pos],border:"none",borderRadius:6,padding:"5px 10px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer"}}>{pos}</button>}
              <button onClick={e=>cycleAvail(p.id,e)} style={{background:avail[p.id]==="available"?"#064e3b":avail[p.id]==="injured"?"#78350f":"#450a0a",border:"none",borderRadius:8,padding:"5px 8px",cursor:"pointer",minWidth:36,fontSize:11,fontWeight:800,color:avail[p.id]==="available"?"#10b981":avail[p.id]==="injured"?"#f59e0b":"#ef4444"}}>
                {avail[p.id]==="available"?"OK":avail[p.id]==="injured"?"Inj":"Out"}
              </button>
            </div>
          );
        })}

        {!showGuest
          ?<button onClick={()=>setShowGuest(true)} style={{width:"100%",padding:12,borderRadius:12,background:"#1e3a5f",border:"1px dashed #334155",color:"#7c3aed",fontWeight:700,fontSize:13,cursor:"pointer",marginBottom:8}}>+ Add Guest Player</button>
          :<div style={{display:"flex",gap:8,marginBottom:8}}>
            <input value={guestName} onChange={e=>setGuestName(e.target.value)} placeholder="Guest name..." style={{...S.input}} />
            <button onClick={addGuest} style={{...S.btn("#7c3aed"),padding:"12px 16px"}}>Add</button>
          </div>
        }

        {unavailable.length>0&&(
          <div style={{marginTop:8,opacity:0.6}}>
            <Lbl>Not Available</Lbl>
            {unavailable.map(p=>(
              <div key={p.id} onClick={e=>cycleAvail(p.id,e)} style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:"#0a0f1a",border:"1px solid #1e293b",borderRadius:10,padding:"10px 14px",marginBottom:5,cursor:"pointer"}}>
                <span style={{fontSize:13,color:"#64748b"}}>{p.name}</span>
                <span style={{fontSize:11,fontWeight:700,color:avail[p.id]==="injured"?"#f59e0b":"#ef4444"}}>{avail[p.id]==="injured"?"Injured":"Absent"} ? tap to restore</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a1628",borderTop:"2px solid #1e3a5f",padding:"12px 16px"}}>
        {selected.length>0&&selected.length<11&&<div style={{textAlign:"center",fontSize:12,color:"#f59e0b",marginBottom:6}}>Select {11-selected.length} more</div>}
        <button onClick={kickoff} disabled={selected.length!==11} style={{...S.btn(selected.length===11?"#2563eb":"#1e3a5f",selected.length===11?"#fff":"#475569"),width:"100%",padding:18,fontSize:16,borderRadius:12,cursor:selected.length===11?"pointer":"not-allowed"}}>
          {selected.length===11?"Kick Off!":selected.length===0?"Tap 11 players":selected.length+"/11 selected"}
        </button>
      </div>

      {posModal&&(
        <Modal title="Set Position" onClose={()=>setPosModal(null)}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
            {POSITIONS.map(pos=><button key={pos} onClick={()=>{setOverrides(o=>({...o,[posModal]:pos}));setPosModal(null);}} style={{padding:24,borderRadius:14,background:posFor(posModal)===pos?POS_COLOR[pos]:"#1e3a5f",border:posFor(posModal)===pos?"3px solid #fff":"3px solid transparent",color:"#fff",fontWeight:800,fontSize:20,cursor:"pointer"}}>{pos}</button>)}
          </div>
        </Modal>
      )}
    </div>
  );
}


function GameScreen({ gameInfo, onEnd, onBack }) {
  const [onField,   setOnField]   = useState(gameInfo.starting);
  const [positions, setPositions] = useState(gameInfo.positions);
  const [half,      setHalf]      = useState(1);
  const [htMode,    setHtMode]    = useState(false);
  const [secs,      setSecs]      = useState(0);
  const [running,   setRunning]   = useState(false);
  const [events,    setEvents]    = useState([]);
  const [gf,        setGf]        = useState(0);
  const [ga,        setGa]        = useState(0);
  const [modal,     setModal]     = useState(null);
  const [editEv,    setEditEv]    = useState(null);
  const [activeTab, setActiveTab] = useState("field");
  const [showBack,  setShowBack]  = useState(false);
  const [showEnd,   setShowEnd]   = useState(false);
  // Goal logging
  const [goalMin,  setGoalMin]  = useState("0");
  const [scorer,   setScorer]   = useState(null);
  const [assist,   setAssist]   = useState(null);
  const [ownGoal,  setOwnGoal]  = useState(false);
  // Sub logging
  const [subOff,   setSubOff]   = useState(null);
  const [subOn,    setSubOn]    = useState(null);
  const [subMin,   setSubMin]   = useState("0");
  const [subPos,   setSubPos]   = useState(null);

  const timer    = useRef(null);
  const startRef = useRef(null);
  const pauseRef = useRef(0);

  useEffect(()=>{
    if (running) {
      startRef.current = Date.now() - pauseRef.current*1000;
      timer.current = setInterval(()=>setSecs(Math.floor((Date.now()-startRef.current)/1000)),500);
    } else {
      clearInterval(timer.current);
      pauseRef.current = secs;
    }
    return ()=>clearInterval(timer.current);
  },[running]);

  const curMin = Math.floor(secs/60);
  const timeStr = String(Math.floor(secs/60)).padStart(2,"0")+":"+String(secs%60).padStart(2,"0");
  const allP = gameInfo.allPlayers;
  const onFieldPlayers = allP.filter(p=>onField.map(String).includes(String(p.id)));
  const benchPlayers   = allP.filter(p=>gameInfo.avail[p.id]==="available"&&!onField.map(String).includes(String(p.id)));

  const openGoal = type => {
    const cm=String(curMin); setGoalMin(cm); setSubMin(cm);
    setScorer(null); setAssist(null); setOwnGoal(false);
    setSubOff(null); setSubOn(null); setSubPos(null);
    setModal(type);
  };

  const logGoalFor = () => {
    const ngf=gf+1; setGf(ngf);
    setEvents(ev=>[...ev,{type:"goal_for",minute:parseInt(goalMin)||0,scorer:ownGoal?null:scorer,assist:ownGoal?null:assist,ownGoal,score:ngf+"-"+ga,half,id:uid()}]);
    setModal(null);
  };
  const logGoalAgainst = () => {
    const nga=ga+1; setGa(nga);
    setEvents(ev=>[...ev,{type:"goal_against",minute:parseInt(goalMin)||0,ownGoal,score:gf+"-"+nga,half,id:uid()}]);
    setModal(null);
  };
  const logSub = () => {
    if (!subOff||!subOn||!subPos) return;
    setOnField(f=>f.map(id=>String(id)===String(subOff)?subOn:id));
    setPositions(p=>{const n={...p};n[subOn]=subPos;delete n[subOff];return n;});
    setEvents(ev=>[...ev,{type:"sub",minute:parseInt(subMin)||0,playerOff:subOff,playerOn:subOn,subType:"tactical",pos:subPos,half,id:uid()}]);
    setModal(null);
  };

  const openEditEv = ev => {
    setEditEv(ev); setGoalMin(String(ev.minute));
    setScorer(ev.scorer?String(ev.scorer):null);
    setAssist(ev.assist?String(ev.assist):null);
    setModal("edit");
  };
  const saveEditEv = () => {
    setEvents(evs=>evs.map(e=>e.id===editEv.id?{...e,minute:parseInt(goalMin)||0,scorer,assist}:e));
    setEditEv(null); setModal(null);
  };
  const delEditEv = () => {
    if (editEv.type==="goal_for") setGf(g=>Math.max(0,g-1));
    else if (editEv.type==="goal_against") setGa(g=>Math.max(0,g-1));
    setEvents(evs=>evs.filter(e=>e.id!==editEv.id));
    setEditEv(null); setModal(null);
  };

  const endHalf = () => { setRunning(false); setHtMode(true); pauseRef.current=HALF_DURATION*60; setSecs(HALF_DURATION*60); setModal("halftime"); };
  const start2H = () => { setHalf(2); setHtMode(false); setSecs(HALF_DURATION*60); pauseRef.current=HALF_DURATION*60; setRunning(false); setModal(null); };

  const pName = id => allP.find(p=>String(p.id)===String(id))?.name?.split(" ")[0]||"?";

  const liveGame = {
    ...gameInfo, events, scoreFor:gf, scoreAgainst:ga,
    date:new Date().toLocaleDateString("en-US"),
    secondHalfStarting: half===2 ? [...onField] : undefined,
    id: gameInfo.id || (new Date().toLocaleDateString("en-US").replace(/\//g,"-")+"-"+gameInfo.opponent.slice(0,10).replace(/\s/g,"-")).toLowerCase()
  };

  return (
    <div style={{...S.screen,paddingBottom:80}}>
      {/* Clock header */}
      <div style={{...S.header}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
          <button onClick={()=>setShowBack(true)} style={{background:"none",border:"none",color:"#60a5fa",fontSize:13,fontWeight:700,cursor:"pointer",padding:0}}>{"< Exit"}</button>
          <div style={{display:"flex",alignItems:"center",gap:6}}>
            <button onClick={()=>setRunning(r=>!r)} style={{background:running?"#dc2626":"#10b981",border:"none",borderRadius:8,padding:"6px 14px",color:"#fff",fontWeight:800,fontSize:12,cursor:"pointer",minWidth:56}}>{running?"PAUSE":"START"}</button>
            <button onClick={()=>{setRunning(false);pauseRef.current=0;setSecs(0);}} style={{background:"#475569",border:"none",borderRadius:8,padding:"6px 10px",color:"#fff",fontWeight:700,fontSize:11,cursor:"pointer"}}>RESET</button>
            <span style={{fontSize:17,fontWeight:800,color:running?"#60a5fa":"#475569",minWidth:46,textAlign:"center"}}>{timeStr}</span>
          </div>
        </div>
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:10,color:"#64748b",marginBottom:2}}>{htMode?"HALF TIME":half===1?"1st Half":"2nd Half"} ? vs {gameInfo.opponent?.split(" ").slice(0,3).join(" ")}</div>
          <div style={{fontSize:52,fontWeight:900,color:"#fff",lineHeight:1}}>
            <span style={{color:"#60a5fa"}}>{gf}</span>
            <span style={{color:"#334155",margin:"0 10px"}}>-</span>
            <span style={{color:"#f87171"}}>{ga}</span>
          </div>
          {!running&&secs===0&&<div style={{fontSize:10,color:"#f59e0b",marginTop:4}}>Tap START to begin clock</div>}
          {!running&&secs>0&&!htMode&&<div style={{fontSize:10,color:"#f59e0b",marginTop:4}}>PAUSED</div>}
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:"flex",borderBottom:"1px solid #1e3a5f",background:"#0a1628"}}>
        {[["field","On Field"],["events","Events"],["bench","Bench"]].map(([t,lbl])=>(
          <button key={t} onClick={()=>setActiveTab(t)} style={{flex:1,padding:"12px 4px",background:"none",border:"none",borderBottom:activeTab===t?"3px solid #2563eb":"3px solid transparent",color:activeTab===t?"#60a5fa":"#64748b",fontWeight:700,fontSize:12,cursor:"pointer"}}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:12,maxWidth:480,margin:"0 auto"}}>
        {activeTab==="field"&&(
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
            {onFieldPlayers.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:6,background:"#0f172a",border:String(p.id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f",borderRadius:10,padding:"8px 10px"}}>
                <span style={{width:26,height:26,borderRadius:"50%",background:POS_COLOR[positions[p.id]]||"#64748b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:"#fff",flexShrink:0}}>{p.num}</span>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:11,fontWeight:700,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name.split(" ")[0]}</div>
                  <div style={{fontSize:9,color:POS_COLOR[positions[p.id]]||"#64748b"}}>{positions[p.id]}</div>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeTab==="events"&&(
          <div>
            <div style={{fontSize:11,color:"#64748b",marginBottom:8}}>Tap to edit any event</div>
            {events.length===0&&<div style={{color:"#475569",fontSize:13,textAlign:"center",marginTop:30}}>No events yet</div>}
            {events.slice().reverse().map(ev=>(
              <div key={ev.id} onClick={()=>openEditEv(ev)} style={{background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:8,padding:"10px 12px",marginBottom:5,display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                <span style={{fontSize:10,fontWeight:800,color:ev.type==="goal_for"?"#60a5fa":ev.type==="goal_against"?"#f87171":"#f59e0b",minWidth:28}}>{ev.type==="goal_for"?"FOR":ev.type==="goal_against"?"VS":"SUB"}</span>
                <span style={{fontSize:11,color:"#94a3b8",fontWeight:700,minWidth:24}}>{ev.minute}'</span>
                <span style={{fontSize:12,color:"#e2e8f0",flex:1}}>
                  {ev.type==="goal_for"?pName(ev.scorer)+(ev.assist?" / "+pName(ev.assist):" (no ast)"):ev.type==="goal_against"?"Goal conceded":pName(ev.playerOff)+" off / "+pName(ev.playerOn)+" on"}
                </span>
                {ev.score&&<span style={{fontSize:11,color:"#64748b",fontWeight:700}}>{ev.score}</span>}
              </div>
            ))}
          </div>
        )}
        {activeTab==="bench"&&(
          <div>
            {benchPlayers.length===0&&<div style={{color:"#475569",fontSize:13,textAlign:"center",marginTop:30}}>No players available</div>}
            {benchPlayers.map(p=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:"#0f172a",border:"1px solid #1e3a5f",borderRadius:12,padding:"12px 14px",marginBottom:6}}>
                <span style={{width:28,height:28,borderRadius:"50%",background:"#1e3a5f",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,color:"#93c5fd",flexShrink:0}}>{p.num}</span>
                <span style={{flex:1,fontWeight:600,fontSize:14,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span>
                <span style={{fontSize:11,color:POS_COLOR[p.pos]||"#64748b",fontWeight:600}}>{p.pos}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div style={{position:"fixed",bottom:0,left:0,right:0,background:"#0a1628",borderTop:"2px solid #1e3a5f",padding:"10px 10px"}}>
        <div style={{display:"flex",gap:5,maxWidth:480,margin:"0 auto"}}>
          <button onClick={()=>openGoal("goal_for")}     style={{flex:1,background:"#1d4ed8",border:"none",borderRadius:10,padding:"14px 2px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:800}}>GOAL FOR</button>
          <button onClick={()=>openGoal("goal_against")} style={{flex:1,background:"#dc2626",border:"none",borderRadius:10,padding:"14px 2px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:800}}>GOAL VS</button>
          <button onClick={()=>openGoal("sub")}          style={{flex:1,background:"#059669",border:"none",borderRadius:10,padding:"14px 2px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:800}}>SUB</button>
          {half===1
            ?<button onClick={endHalf}              style={{flex:1,background:"#7c3aed",border:"none",borderRadius:10,padding:"14px 2px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:800}}>END HALF</button>
            :<button onClick={()=>setShowEnd(true)} style={{flex:1,background:"#7c3aed",border:"none",borderRadius:10,padding:"14px 2px",color:"#fff",cursor:"pointer",fontSize:10,fontWeight:800}}>FULL TIME</button>
          }
        </div>
      </div>

      {/* Modals */}
      {showBack&&(
        <Modal title="Leave game?" onClose={()=>setShowBack(false)}>
          <p style={{color:"#94a3b8",fontSize:14}}>Clock stops. Come back any time -- the game is still here.</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowBack(false)} style={{...S.btn("#1e3a5f"),flex:1}}>Stay</button>
            <button onClick={onBack}                  style={{...S.btn("#dc2626"),flex:1}}>Leave</button>
          </div>
        </Modal>
      )}

      {showEnd&&(
        <Modal title="Full Time?" onClose={()=>setShowEnd(false)}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:48,fontWeight:900,color:"#fff"}}><span style={{color:"#60a5fa"}}>{gf}</span> - <span style={{color:"#f87171"}}>{ga}</span></div>
            <div style={{fontSize:13,color:"#64748b"}}>vs {gameInfo.opponent?.split(" ").slice(0,3).join(" ")}</div>
          </div>
          <p style={{color:"#94a3b8",fontSize:13}}>This saves the game permanently. You can still edit it afterwards.</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setShowEnd(false)}          style={{...S.btn("#1e3a5f"),flex:1}}>Keep Playing</button>
            <button onClick={()=>onEnd({...liveGame,status:"completed"})} style={{...S.btn("#2563eb"),flex:2}}>Save Game</button>
          </div>
        </Modal>
      )}

      {modal==="goal_for"&&(
        <Modal title="Goal For!" onClose={()=>setModal(null)}>
          <Lbl>Minute</Lbl>
          <input value={goalMin} onChange={e=>setGoalMin(e.target.value)} type="number" style={{...S.input,fontSize:22,fontWeight:700,marginBottom:12}} />
          <button onClick={()=>setOwnGoal(o=>!o)} style={{padding:"8px 14px",borderRadius:8,background:ownGoal?"#f59e0b":"#1e3a5f",border:"none",color:ownGoal?"#000":"#94a3b8",fontWeight:700,fontSize:12,cursor:"pointer",marginBottom:12}}>Own Goal by opponent</button>
          {!ownGoal&&(<>
            <Lbl>Scorer</Lbl>
            {onFieldPlayers.map(p=><button key={p.id} onClick={()=>setScorer(String(p.id))} style={{width:"100%",padding:"11px 14px",borderRadius:10,marginBottom:5,background:scorer===String(p.id)?"#1d4ed8":"#1e3a5f",border:scorer===String(p.id)?"2px solid #60a5fa":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</button>)}
            <Lbl mt={8}>Assist</Lbl>
            <button onClick={()=>setAssist(null)} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:assist===null?"#475569":"#1e3a5f",border:"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>No Assist / Unknown</button>
            {onFieldPlayers.filter(p=>String(p.id)!==scorer).map(p=><button key={p.id} onClick={()=>setAssist(assist===String(p.id)?null:String(p.id))} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:assist===String(p.id)?"#065f46":"#1e3a5f",border:assist===String(p.id)?"2px solid #10b981":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}</button>)}
          </>)}
          <button onClick={logGoalFor} disabled={!ownGoal&&!scorer} style={{...S.btn(!ownGoal&&!scorer?"#1e3a5f":"#1d4ed8",!ownGoal&&!scorer?"#475569":"#fff"),width:"100%",padding:16,fontSize:15,marginTop:8,cursor:!ownGoal&&!scorer?"not-allowed":"pointer"}}>Log Goal</button>
        </Modal>
      )}

      {modal==="goal_against"&&(
        <Modal title="Goal Against" onClose={()=>setModal(null)}>
          <Lbl>Minute</Lbl>
          <input value={goalMin} onChange={e=>setGoalMin(e.target.value)} type="number" style={{...S.input,fontSize:22,fontWeight:700,marginBottom:16}} />
          <button onClick={logGoalAgainst} style={{...S.btn("#dc2626"),width:"100%",padding:16,fontSize:15}}>Log Goal Against</button>
        </Modal>
      )}

      {modal==="sub"&&(
        <Modal title="Substitution" onClose={()=>setModal(null)}>
          <Lbl>Minute</Lbl>
          <input value={subMin} onChange={e=>setSubMin(e.target.value)} type="number" style={{...S.input,fontSize:22,fontWeight:700,marginBottom:12}} />
          <Lbl>Player Off</Lbl>
          {onFieldPlayers.map(p=><button key={p.id} onClick={()=>setSubOff(String(p.id))} style={{width:"100%",padding:"11px 14px",borderRadius:10,marginBottom:5,background:subOff===String(p.id)?"#dc2626":"#1e3a5f",border:subOff===String(p.id)?"2px solid #f87171":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name} <span style={{color:POS_COLOR[positions[p.id]],fontSize:11}}>? {positions[p.id]}</span></button>)}
          <Lbl mt={8}>Player On</Lbl>
          {benchPlayers.length===0&&<div style={{color:"#475569",fontSize:13,marginBottom:8}}>No players on bench</div>}
          {benchPlayers.map(p=><button key={p.id} onClick={()=>setSubOn(String(p.id))} style={{width:"100%",padding:"11px 14px",borderRadius:10,marginBottom:5,background:subOn===String(p.id)?"#059669":"#1e3a5f",border:subOn===String(p.id)?"2px solid #10b981":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</button>)}
          {subOn&&(<><Lbl mt={8}>Position</Lbl><div style={{display:"flex",gap:8}}>{POSITIONS.map(pos=><button key={pos} onClick={()=>setSubPos(pos)} style={{flex:1,padding:"14px 4px",borderRadius:10,border:"none",fontWeight:800,fontSize:14,cursor:"pointer",background:subPos===pos?POS_COLOR[pos]:"#1e3a5f",color:subPos===pos?"#fff":"#64748b"}}>{pos}</button>)}</div></>)}
          <button onClick={logSub} disabled={!subOff||!subOn||!subPos} style={{...S.btn(!subOff||!subOn||!subPos?"#1e3a5f":"#059669",!subOff||!subOn||!subPos?"#475569":"#fff"),width:"100%",padding:16,fontSize:15,marginTop:12,cursor:!subOff||!subOn||!subPos?"not-allowed":"pointer"}}>Log Sub</button>
        </Modal>
      )}

      {modal==="edit"&&editEv&&(
        <Modal title="Edit Event" onClose={()=>setModal(null)}>
          <Lbl>Minute</Lbl>
          <input value={goalMin} onChange={e=>setGoalMin(e.target.value)} type="number" style={{...S.input,fontSize:22,fontWeight:700,marginBottom:12}} />
          {editEv.type==="goal_for"&&(<>
            <Lbl>Scorer</Lbl>
            {allP.map(p=><button key={p.id} onClick={()=>setScorer(String(p.id))} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:scorer===String(p.id)?"#1d4ed8":"#1e3a5f",border:scorer===String(p.id)?"2px solid #60a5fa":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}</button>)}
            <Lbl mt={8}>Assist</Lbl>
            <button onClick={()=>setAssist(null)} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:assist===null?"#475569":"#1e3a5f",border:"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>No Assist</button>
            {allP.filter(p=>String(p.id)!==scorer).map(p=><button key={p.id} onClick={()=>setAssist(assist===String(p.id)?null:String(p.id))} style={{width:"100%",padding:"10px 14px",borderRadius:10,marginBottom:5,background:assist===String(p.id)?"#065f46":"#1e3a5f",border:assist===String(p.id)?"2px solid #10b981":"1px solid #334155",color:"#e2e8f0",fontWeight:600,fontSize:13,cursor:"pointer",textAlign:"left"}}>#{p.num} {p.name}</button>)}
          </>)}
          <div style={{display:"flex",gap:8,marginTop:12}}>
            <button onClick={delEditEv}  style={{...S.btn("#7f1d1d","#fca5a5"),flex:1}}>Delete</button>
            <button onClick={saveEditEv} style={{...S.btn("#2563eb"),flex:2}}>Save</button>
          </div>
        </Modal>
      )}

      {modal==="halftime"&&(
        <Modal title="Half Time" onClose={()=>setModal(null)}>
          <div style={{textAlign:"center",marginBottom:16}}>
            <div style={{fontSize:52,fontWeight:900,color:"#fff",lineHeight:1}}><span style={{color:"#60a5fa"}}>{gf}</span><span style={{color:"#334155",margin:"0 12px"}}>-</span><span style={{color:"#f87171"}}>{ga}</span></div>
            <div style={{fontSize:12,color:"#10b981",fontWeight:700,marginTop:6}}>End of First Half</div>
          </div>
          <Lbl>2nd Half Starting Lineup</Lbl>
          <p style={{color:"#94a3b8",fontSize:12,marginTop:0,marginBottom:10}}>Make subs below to change who starts.</p>
          {onFieldPlayers.map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:8,background:"#0d2137",border:"1px solid #2563eb",borderRadius:10,padding:"10px 12px",marginBottom:5}}>
              <span style={{width:26,height:26,borderRadius:"50%",background:POS_COLOR[positions[p.id]]||"#64748b",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:10,color:"#fff",flexShrink:0}}>{p.num}</span>
              <span style={{flex:1,fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span>
              <span style={{fontSize:11,color:POS_COLOR[positions[p.id]],fontWeight:700}}>{positions[p.id]}</span>
            </div>
          ))}
          <div style={{display:"flex",gap:8,marginTop:14}}>
            <button onClick={()=>setModal("sub")} style={{...S.btn("#059669"),flex:1}}>Make Sub</button>
            <button onClick={start2H}              style={{...S.btn("#2563eb"),flex:2,fontSize:15,fontWeight:800}}>Start 2nd Half</button>
          </div>
        </Modal>
      )}
    </div>
  );
}


function StatsScreen({ games, onBack, onViewGame }) {
  const [view,       setView]       = useState("overview");
  const [sortBy,     setSortBy]     = useState("net80");
  const [sortDir,    setSortDir]    = useState(-1);
  const [scoutOpp,   setScoutOpp]   = useState(null);
  const [showAll,    setShowAll]    = useState({g:false,a:false,m:false});

  if (!games||games.length===0) return (
    <div style={{...S.screen,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,padding:32}}>
      <div style={{fontSize:20,fontWeight:700,color:"#60a5fa"}}>No Games Yet</div>
      <button onClick={onBack} style={{...S.btn("#2563eb"),padding:"14px 28px"}}>Back to Home</button>
    </div>
  );

  const allGuests = games.flatMap(g=>g.guests||[]).filter((g,i,a)=>a.findIndex(x=>String(x.id)===String(g.id))===i);
  const allP = [...ROSTER,...allGuests];
  const allStats = calcPlayerStats(games);
  const allGF = games.flatMap(g=>(g.events||[]).filter(e=>e.type==="goal_for"));
  const allGA = games.flatMap(g=>(g.events||[]).filter(e=>e.type==="goal_against"));
  const opponents = [...new Set(games.map(g=>g.opponent))];

  const sortKeys = {net80:"net80",goals:"goalsScored",assists:"assistsGiven",onFieldGF:"onFieldGF",onFieldGA:"onFieldGA"};
  const playerList = allP.map(p=>({...p,...(allStats[String(p.id)]||{})})).filter(p=>p.gamesPlayed>0).sort((a,b)=>{
    const k=sortKeys[sortBy];
    const av=k==="net80"?(a.net80||0):(a[k]||0);
    const bv=k==="net80"?(b.net80||0):(b[k]||0);
    return sortDir*(bv-av);
  });
  const toggleSort = k=>{ if(sortBy===k) setSortDir(d=>d*-1); else {setSortBy(k);setSortDir(-1);}};
  const sBtn = (k,lbl) => <button onClick={()=>toggleSort(k)} style={{flex:1,padding:"8px 2px",borderRadius:8,border:"none",fontWeight:700,fontSize:10,cursor:"pointer",background:sortBy===k?"#2563eb":"#1e3a5f",color:sortBy===k?"#fff":"#64748b"}}>{lbl}{sortBy===k?(sortDir===-1?" v":" ^"):""}</button>;

  const topScorers = allP.map(p=>({...p,...(allStats[String(p.id)]||{})})).filter(p=>p.goalsScored>0).sort((a,b)=>b.goalsScored-a.goalsScored);
  const topAssists = allP.map(p=>({...p,...(allStats[String(p.id)]||{})})).filter(p=>p.assistsGiven>0).sort((a,b)=>b.assistsGiven-a.assistsGiven);
  const allMins    = allP.map(p=>({...p,...(allStats[String(p.id)]||{})})).filter(p=>p.gamesPlayed>0).sort((a,b)=>b.totalMins-a.totalMins);
  const timeBuckets = [{l:"0-10",min:0,max:10},{l:"11-20",min:11,max:20},{l:"21-30",min:21,max:30},{l:"31-40",min:31,max:40},{l:"41-50",min:41,max:50},{l:"51-60",min:51,max:60},{l:"61-70",min:61,max:70},{l:"71-80",min:71,max:80}];

  return (
    <div style={S.screen}>
      <div style={{...S.header,display:"flex",alignItems:"center",gap:12}}>
        <button onClick={onBack} style={{background:"none",border:"none",color:"#60a5fa",fontSize:20,cursor:"pointer",padding:0,fontWeight:800}}>{"<"}</button>
        <div>
          <div style={{fontSize:18,fontWeight:800,color:"#60a5fa"}}>Season Stats</div>
          <div style={{fontSize:11,color:"#64748b"}}>{games.length} games played</div>
        </div>
      </div>
      <div style={{display:"flex",borderBottom:"1px solid #1e3a5f",background:"#0a1628"}}>
        {[["overview","Overview"],["players","Players"],["optimum","Optimum"],["scouting","Scouting"]].map(([t,lbl])=>(
          <button key={t} onClick={()=>setView(t)} style={{flex:1,padding:"13px 2px",background:"none",border:"none",borderBottom:view===t?"3px solid #2563eb":"3px solid transparent",color:view===t?"#60a5fa":"#64748b",fontWeight:700,fontSize:11,cursor:"pointer"}}>{lbl}</button>
        ))}
      </div>

      <div style={{padding:14,maxWidth:480,margin:"0 auto"}}>
        {view==="overview"&&(<>
          {/* Record */}
          <div style={S.card}>
            <Lbl>Season Record</Lbl>
            <div style={{display:"flex",justifyContent:"space-around",textAlign:"center"}}>
              {["W","D","L"].map(r=>{const c=games.filter(g=>r==="W"?g.scoreFor>g.scoreAgainst:r==="D"?g.scoreFor===g.scoreAgainst:g.scoreFor<g.scoreAgainst).length;return <div key={r}><div style={{fontSize:36,fontWeight:900,color:r==="W"?"#10b981":r==="D"?"#f59e0b":"#ef4444"}}>{c}</div><div style={{fontSize:11,color:"#64748b"}}>{r==="W"?"Wins":r==="D"?"Draws":"Losses"}</div></div>;})}
              <div><div style={{fontSize:36,fontWeight:900,color:"#60a5fa"}}>{games.reduce((a,g)=>a+g.scoreFor,0)}-{games.reduce((a,g)=>a+g.scoreAgainst,0)}</div><div style={{fontSize:11,color:"#64748b"}}>Goals</div></div>
            </div>
          </div>
          {/* Top Scorers */}
          <div style={S.card}>
            <Lbl>Top Scorers</Lbl>
            {topScorers.length===0&&<div style={{color:"#475569",fontSize:13}}>No goals logged yet</div>}
            {(showAll.g?topScorers:topScorers.slice(0,5)).map((p,i)=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<(showAll.g?topScorers.length-1:Math.min(4,topScorers.length-1))?"1px solid #1e3a5f":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,color:"#475569",fontWeight:800,width:18}}>{i+1}</span><span style={{fontWeight:700,fontSize:14,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span></div>
                <span style={{fontSize:22,fontWeight:900,color:"#60a5fa"}}>{p.goalsScored}</span>
              </div>
            ))}
            {topScorers.length>5&&<button onClick={()=>setShowAll(s=>({...s,g:!s.g}))} style={{width:"100%",marginTop:8,padding:8,borderRadius:8,background:"#1e3a5f",border:"none",color:"#64748b",fontWeight:700,fontSize:12,cursor:"pointer"}}>{showAll.g?"Show Less":"Show All "+topScorers.length}</button>}
          </div>
          {/* Top Assists */}
          <div style={S.card}>
            <Lbl>Top Assists</Lbl>
            {topAssists.length===0&&<div style={{color:"#475569",fontSize:13}}>No assists logged yet</div>}
            {(showAll.a?topAssists:topAssists.slice(0,5)).map((p,i)=>(
              <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"8px 0",borderBottom:i<(showAll.a?topAssists.length-1:Math.min(4,topAssists.length-1))?"1px solid #1e3a5f":"none"}}>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:13,color:"#475569",fontWeight:800,width:18}}>{i+1}</span><span style={{fontWeight:700,fontSize:14,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span></div>
                <span style={{fontSize:22,fontWeight:900,color:"#10b981"}}>{p.assistsGiven}</span>
              </div>
            ))}
            {topAssists.length>5&&<button onClick={()=>setShowAll(s=>({...s,a:!s.a}))} style={{width:"100%",marginTop:8,padding:8,borderRadius:8,background:"#1e3a5f",border:"none",color:"#64748b",fontWeight:700,fontSize:12,cursor:"pointer"}}>{showAll.a?"Show Less":"Show All "+topAssists.length}</button>}
          </div>
          {/* Goal Timing */}
          <div style={S.card}>
            <Lbl>Goal Timing (10-min intervals)</Lbl>
            {timeBuckets.map(b=>{
              const gfC=allGF.filter(g=>g.minute>=b.min&&g.minute<=b.max).length;
              const gaC=allGA.filter(g=>g.minute>=b.min&&g.minute<=b.max).length;
              const mx=Math.max(gfC,gaC,1);
              return (
                <div key={b.l} style={{marginBottom:10}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:"#94a3b8"}}>{b.l}</span><span style={{fontSize:11}}><span style={{color:"#60a5fa",fontWeight:700}}>For: {gfC}</span>  <span style={{color:"#f87171",fontWeight:700}}>vs: {gaC}</span></span></div>
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:2}}><span style={{fontSize:9,color:"#60a5fa",width:16}}>F</span><div style={{flex:1,background:"#1e293b",borderRadius:3,height:6}}><div style={{width:(gfC/mx*100)+"%",background:"#2563eb",borderRadius:3,height:"100%"}} /></div></div>
                  <div style={{display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:9,color:"#f87171",width:16}}>V</span><div style={{flex:1,background:"#1e293b",borderRadius:3,height:6}}><div style={{width:(gaC/mx*100)+"%",background:"#dc2626",borderRadius:3,height:"100%"}} /></div></div>
                </div>
              );
            })}
          </div>
          {/* Results */}
          <Lbl>All Results</Lbl>
          {games.slice().reverse().map((g,i)=>(
            <button key={i} onClick={()=>onViewGame(g)} style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <div><div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>vs {g.opponent.split(" ").slice(0,3).join(" ")}</div><div style={{fontSize:11,color:"#64748b"}}>{g.date} ? {g.venue}</div></div>
                <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:22,fontWeight:900,color:"#fff"}}>{g.scoreFor}-{g.scoreAgainst}</span><Badge gf={g.scoreFor} ga={g.scoreAgainst} /></div>
              </div>
            </button>
          ))}
        </>)}

        {view==="players"&&(<>
          <div style={{display:"flex",gap:5,marginBottom:12}}>
            {sBtn("goals","Goals")}{sBtn("assists","Assists")}{sBtn("onFieldGF","GF")}{sBtn("onFieldGA","GA")}{sBtn("net80","Net/80")}
          </div>
          <p style={{color:"#64748b",fontSize:11,marginTop:0,marginBottom:12}}>Net/80: goals scored minus conceded per 80 mins on field. * = Maariyah</p>
          {playerList.map(p=>{
            const s=allStats[String(p.id)]||{};
            return (
              <div key={p.id} style={{...S.card,border:String(p.id)===String(FEATURED_ID)?"2px solid #60a5fa":"1px solid #1e3a5f"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                  <div>
                    <div style={{fontWeight:800,fontSize:15,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</div>
                    <div style={{fontSize:11,color:"#64748b",marginTop:2}}>{s.gamesPlayed} games ? {s.totalMins} mins ? avg {s.avgMins}'/game</div>
                  </div>
                  <div style={{background:parseFloat(s.net80)>0?"#064e3b":parseFloat(s.net80)<0?"#450a0a":"#1e3a5f",borderRadius:8,padding:"6px 10px",textAlign:"center",minWidth:54}}>
                    <div style={{fontSize:16,fontWeight:900,color:parseFloat(s.net80)>0?"#10b981":parseFloat(s.net80)<0?"#f87171":"#94a3b8"}}>{s.net80Str||"-"}</div>
                    <div style={{fontSize:9,color:"#64748b"}}>NET/80</div>
                  </div>
                </div>
                <div style={{display:"flex",gap:5}}>
                  {[["G",s.goalsScored,"#60a5fa"],["A",s.assistsGiven,"#10b981"],["GF",s.onFieldGF,"#3b82f6"],["GA",s.onFieldGA,"#f87171"]].map(([lbl,val,col])=>(
                    <div key={lbl} style={{flex:1,background:"#1e3a5f",borderRadius:8,padding:"7px 4px",textAlign:"center"}}>
                      <div style={{fontSize:18,fontWeight:800,color:col}}>{val||0}</div>
                      <div style={{fontSize:8,color:"#64748b"}}>{lbl}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </>)}

        {view==="optimum"&&(<>
          <div style={{...S.card,border:"2px solid #f59e0b",marginBottom:14}}>
            <div style={{fontSize:13,fontWeight:800,color:"#f59e0b",marginBottom:4}}>Season Optimum XI</div>
            <div style={{fontSize:11,color:"#64748b"}}>Best 11 players by Net/80 across all games</div>
          </div>
          {(()=>{
            const eligible=allP.map(p=>({...p,...(allStats[String(p.id)]||{})})).filter(p=>p.gamesPlayed>0&&p.net80!==null);
            const sorted=[...eligible].sort((a,b)=>(b.net80||0)-(a.net80||0));
            const top11=sorted.slice(0,11); const rest=sorted.slice(11);
            const byPos={GK:[],DEF:[],MID:[],FWD:[]};
            top11.forEach(p=>{ if(byPos[p.pos]) byPos[p.pos].push(p); });
            return (<>
              {["GK","DEF","MID","FWD"].map(pos=>byPos[pos].length>0&&(
                <div key={pos} style={{marginBottom:12}}>
                  <div style={{fontSize:10,fontWeight:800,color:POS_COLOR[pos],letterSpacing:1,marginBottom:6}}>{pos}</div>
                  {byPos[pos].map(p=>(
                    <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,...S.card,marginBottom:5}}>
                      <span style={{width:28,height:28,borderRadius:"50%",background:POS_COLOR[pos],display:"flex",alignItems:"center",justifyContent:"center",fontWeight:800,fontSize:11,color:"#fff",flexShrink:0}}>{p.num}</span>
                      <div style={{flex:1}}><div style={{fontWeight:700,fontSize:14,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</div><div style={{fontSize:10,color:"#64748b"}}>{p.gamesPlayed} games ? {p.totalMins} mins</div></div>
                      <div style={{textAlign:"right"}}><div style={{fontSize:16,fontWeight:900,color:parseFloat(p.net80)>=0?"#10b981":"#f87171"}}>{p.net80Str}</div><div style={{fontSize:9,color:"#64748b"}}>NET/80</div></div>
                    </div>
                  ))}
                </div>
              ))}
              {rest.length>0&&<><Lbl>Others</Lbl>{rest.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:10,background:"#0a1222",border:"1px solid #1e293b",borderRadius:10,padding:"9px 14px",marginBottom:4,opacity:0.75}}><span style={{fontSize:12,color:"#475569",width:20}}>{i+12}.</span><span style={{flex:1,fontSize:13,color:"#94a3b8"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span><span style={{fontSize:13,fontWeight:700,color:parseFloat(p.net80)>=0?"#10b981":"#f87171"}}>{p.net80Str}</span><span style={{fontSize:10,color:"#475569"}}>{p.totalMins}m</span></div>)}</>}
            </>);
          })()}
        </>)}

        {view==="scouting"&&(<>
          {!scoutOpp?(<>
            <p style={{color:"#64748b",fontSize:12,marginTop:0}}>Tap opponent for scouting report</p>
            {opponents.map(opp=>{
              const og=games.filter(g=>g.opponent===opp);
              const w=og.filter(g=>g.scoreFor>g.scoreAgainst).length;
              const l=og.filter(g=>g.scoreFor<g.scoreAgainst).length;
              const d=og.filter(g=>g.scoreFor===g.scoreAgainst).length;
              const tf=og.reduce((a,g)=>a+g.scoreFor,0); const ta=og.reduce((a,g)=>a+g.scoreAgainst,0);
              return (
                <button key={opp} onClick={()=>setScoutOpp(opp)} style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                  <div><div style={{fontSize:13,fontWeight:700,color:"#e2e8f0"}}>{opp.split(" ").slice(0,4).join(" ")}</div><div style={{fontSize:11,color:"#64748b",marginTop:2}}>GF: {tf} GA: {ta}</div></div>
                  <div style={{display:"flex",gap:4}}>
                    {w>0&&<span style={{background:"#059669",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700}}>{w}W</span>}
                    {d>0&&<span style={{background:"#d97706",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700}}>{d}D</span>}
                    {l>0&&<span style={{background:"#dc2626",color:"#fff",borderRadius:6,padding:"3px 8px",fontSize:12,fontWeight:700}}>{l}L</span>}
                  </div>
                </button>
              );
            })}
          </>):(()=>{
            const og=games.filter(g=>g.opponent===scoutOpp);
            const ss=calcPlayerStats(og);
            const tf=og.reduce((a,g)=>a+g.scoreFor,0); const ta=og.reduce((a,g)=>a+g.scoreAgainst,0);
            const sScorers=allP.map(p=>({...p,...(ss[String(p.id)]||{})})).filter(p=>p.goalsScored>0).sort((a,b)=>b.goalsScored-a.goalsScored);
            const sMins=allP.map(p=>({...p,...(ss[String(p.id)]||{})})).filter(p=>p.gamesPlayed>0).sort((a,b)=>b.totalMins-a.totalMins);
            const opt=allP.map(p=>({...p,...(ss[String(p.id)]||{})})).filter(p=>p.gamesPlayed>0&&p.net80!==null).sort((a,b)=>(b.net80||0)-(a.net80||0)).slice(0,11);
            return (<>
              <button onClick={()=>setScoutOpp(null)} style={{background:"none",border:"none",color:"#60a5fa",fontSize:14,fontWeight:700,cursor:"pointer",padding:0,marginBottom:12}}>{"< All Opponents"}</button>
              <div style={{fontSize:16,fontWeight:800,color:"#60a5fa",marginBottom:10}}>{scoutOpp.split(" ").slice(0,4).join(" ")}</div>
              <div style={{...S.card,marginBottom:12}}>
                <div style={{display:"flex",justifyContent:"space-around",textAlign:"center"}}>
                  {[["Played",og.length,"#94a3b8"],["GF",tf,"#60a5fa"],["GA",ta,"#f87171"],["GD",tf-ta>=0?"+"+(tf-ta):(tf-ta),"#10b981"]].map(([lbl,val,col])=><div key={lbl}><div style={{fontSize:28,fontWeight:900,color:col}}>{val}</div><div style={{fontSize:10,color:"#64748b"}}>{lbl}</div></div>)}
                </div>
              </div>
              {sScorers.length>0&&<div style={S.card}><Lbl>Scorers</Lbl>{sScorers.map((p,i)=><div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<sScorers.length-1?"1px solid #1e3a5f":"none"}}><span style={{fontSize:13,fontWeight:600,color:"#e2e8f0"}}>{p.name}</span><span style={{fontSize:18,fontWeight:800,color:"#60a5fa"}}>{p.goalsScored}</span></div>)}</div>}
              <div style={S.card}><Lbl>Minutes Played</Lbl>{sMins.map((p,i)=><div key={p.id} style={{display:"flex",justifyContent:"space-between",padding:"7px 0",borderBottom:i<sMins.length-1?"1px solid #1e3a5f":"none"}}><span style={{fontSize:13,fontWeight:600,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span><span style={{fontSize:13,color:"#f59e0b",fontWeight:700}}>{p.totalMins}' <span style={{fontSize:10,color:"#64748b"}}>avg {p.avgMins}'</span></span></div>)}</div>
              {opt.length>=11&&<div style={S.card}><Lbl>Optimum vs This Opponent</Lbl>{opt.map((p,i)=><div key={p.id} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 0",borderBottom:i<10?"1px solid #1e3a5f":"none"}}><span style={{width:20,fontSize:12,color:"#475569"}}>{i+1}.</span><span style={{flex:1,fontSize:13,fontWeight:700,color:String(p.id)===String(FEATURED_ID)?"#93c5fd":"#e2e8f0"}}>{p.name}{String(p.id)===String(FEATURED_ID)?" *":""}</span><span style={{fontSize:11,color:"#94a3b8"}}>{p.net80Str}</span></div>)}</div>}
              {og.map((g,i)=><button key={i} onClick={()=>onViewGame(g)} style={{...S.card,width:"100%",textAlign:"left",cursor:"pointer",marginBottom:8}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"#64748b"}}>{g.date} ? {g.venue}</span><div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18,fontWeight:900,color:"#fff"}}>{g.scoreFor}-{g.scoreAgainst}</span><Badge gf={g.scoreFor} ga={g.scoreAgainst}/></div></div></button>)}
            </>);
          })()}
        </>)}
      </div>
    </div>
  );
}


export default function App() {
  const [screen,      setScreen]      = useState("home");
  const [gameInfo,    setGameInfo]    = useState(null);
  const [games,       setGames]       = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [viewingGame, setViewingGame] = useState(null);
  const seeded = useRef(false);

  useEffect(()=>{
    // Listen to Firebase in real time
    const unsub = listenToGames(async (fbGames) => {
      if (fbGames.length===0 && !seeded.current) {
        seeded.current = true;
        await saveGame(makeLVURushGame());
        await saveGame(makeCoppermineGame());
      } else {
        setGames(fbGames);
        setLoading(false);
      }
    });
    return ()=>unsub();
  },[]);

  const handleGameEnd = async (game) => {
    await saveGame(game);
    setScreen("stats");
  };

  const updateGame = (updated) => {
    setViewingGame(updated);
    setGames(prev=>prev.map(g=>g.id===updated.id?updated:g));
  };

  if (loading) return <Loading />;
  if (viewingGame) return <GameDetail game={viewingGame} onClose={()=>setViewingGame(null)} onUpdate={updateGame} />;

  return (
    <>
      {screen==="home"   && <HomeScreen   games={games} onStart={info=>{setGameInfo(info);setScreen("lineup");}} onStats={()=>setScreen("stats")} onViewGame={setViewingGame} />}
      {screen==="lineup" && gameInfo && <LineupScreen gameInfo={gameInfo} onKickoff={info=>{setGameInfo(info);setScreen("game");}} onBack={()=>setScreen("home")} />}
      {screen==="game"   && gameInfo && <GameScreen   gameInfo={gameInfo} onEnd={handleGameEnd} onBack={()=>setScreen("home")} />}
      {screen==="stats"  && <StatsScreen  games={games} onBack={()=>setScreen("home")} onViewGame={setViewingGame} />}
    </>
  );
}
