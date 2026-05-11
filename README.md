export const FEATURED_ID = 5;
export const HALF_DURATION = 40;
export const GAME_DURATION = 80;

export const ROSTER = [
  { id:1,  num:"1",  name:"Emily Gandel",        pos:"GK"  },
  { id:2,  num:"2",  name:"Caitlyn Dunkelberger", pos:"DEF" },
  { id:3,  num:"3",  name:"Ashley Ellis",         pos:"DEF" },
  { id:4,  num:"4",  name:"Hailey Ferguson",      pos:"DEF" },
  { id:5,  num:"5",  name:"Maariyah Ali",         pos:"MID" },
  { id:6,  num:"6",  name:"Sadie Feldman",        pos:"MID" },
  { id:7,  num:"7",  name:"Julia Flory",          pos:"MID" },
  { id:8,  num:"8",  name:"Katelyn Hannan",       pos:"MID" },
  { id:11, num:"11", name:"Emma Young",           pos:"GK"  },
  { id:12, num:"12", name:"Sloane Pietryka",      pos:"FWD" },
  { id:13, num:"13", name:"Lilly Nipper",         pos:"DEF" },
  { id:14, num:"14", name:"Brooke Schuyler",      pos:"FWD" },
  { id:15, num:"15", name:"Aurelia Berkowicz",    pos:"DEF" },
  { id:16, num:"16", name:"Avah Scott",           pos:"DEF" },
  { id:17, num:"17", name:"Lily Kaye",            pos:"DEF" },
  { id:18, num:"18", name:"Emerson Yonker",       pos:"MID" },
  { id:19, num:"19", name:"Abigail Yun",          pos:"FWD" },
  { id:22, num:"22", name:"Lainey Pearson-Moore", pos:"DEF" },
];

export const DEFAULT_POS = Object.fromEntries(ROSTER.map(p => [p.id, p.pos]));

export const LEAGUE_TEAMS = [
  "LVU Rush 11G Aspire",
  "Potomac Soccer Association 11G Aspire",
  "Huntingdon Valley AA 11G Aspire",
  "Keystone FC 11G Aspire",
  "The Player Progression Academy 11G Aspire",
  "Baltimore Celtic Soccer Club 11G Aspire",
  "Coppermine Soccer Club 11G Aspire",
];

export const TOURNAMENT_TEAMS = [
  "Ellicott City Soccer Club CiTY 2011 Girls Elite",
  "Olney Strikers Blue 2011",
];

export const POSITIONS = ["GK","DEF","MID","FWD"];
export const POS_COLOR = { GK:"#f59e0b", DEF:"#3b82f6", MID:"#10b981", FWD:"#ef4444" };

export function uid() { return Math.random().toString(36).slice(2,9); }

export function pById(id, players) {
  return (players||ROSTER).find(p => String(p.id) === String(id));
}

// STATS ENGINE
export function calcPlayerStats(games) {
  const stats = {};
  const ensure = (id) => {
    const key = String(id);
    if (!stats[key]) stats[key] = { id:key, goalsScored:0, assistsGiven:0, onFieldGF:0, onFieldGA:0, totalMins:0, gamesPlayed:0 };
    return key;
  };

  games.forEach(g => {
    (g.allPlayers||ROSTER).forEach(p => ensure(p.id));
    const playerOn = {}, playerMins = {};
    (g.starting||[]).forEach(id => { const k=ensure(id); playerOn[k]=0; });
    const sorted = [...(g.events||[])].sort((a,b)=>a.minute-b.minute);
    let htDone = false;

    sorted.forEach(ev => {
      if (!htDone && ev.half===2 && g.secondHalfStarting) {
        htDone = true;
        Object.keys(playerOn).forEach(id => { playerMins[id]=(playerMins[id]||0)+(HALF_DURATION-playerOn[id]); });
        Object.keys(playerOn).forEach(k=>delete playerOn[k]);
        g.secondHalfStarting.forEach(id => { const k=ensure(id); playerOn[k]=HALF_DURATION; });
      }
      if (ev.type==="sub") {
        const off=String(ev.playerOff), on=String(ev.playerOn);
        if (playerOn[off]!==undefined) { playerMins[off]=(playerMins[off]||0)+(ev.minute-playerOn[off]); delete playerOn[off]; }
        ensure(on); playerOn[on]=ev.minute;
      }
      if (ev.type==="goal_for") {
        if (ev.scorer) { const k=ensure(ev.scorer); stats[k].goalsScored++; }
        if (ev.assist) { const k=ensure(ev.assist); stats[k].assistsGiven++; }
        Object.keys(playerOn).forEach(id => { ensure(id); stats[id].onFieldGF++; });
      }
      if (ev.type==="goal_against") {
        Object.keys(playerOn).forEach(id => { ensure(id); stats[id].onFieldGA++; });
      }
    });

    Object.keys(playerOn).forEach(id => { playerMins[id]=(playerMins[id]||0)+(GAME_DURATION-playerOn[id]); });
    Object.keys(playerMins).forEach(id => {
      if (playerMins[id]>0) { ensure(id); stats[id].totalMins+=Math.min(playerMins[id],GAME_DURATION); stats[id].gamesPlayed++; }
    });
  });

  Object.values(stats).forEach(s => {
    s.avgMins = s.gamesPlayed>0 ? Math.round(s.totalMins/s.gamesPlayed) : 0;
    s.net80 = s.totalMins>0 ? ((s.onFieldGF-s.onFieldGA)/s.totalMins*80) : null;
    s.net80Str = s.net80!==null ? (s.net80>=0?"+":"")+s.net80.toFixed(2) : "-";
  });
  return stats;
}

// SEED GAMES - loaded into Firebase on first run
export function makeLVURushGame() {
  const avail = Object.fromEntries(ROSTER.map(p=>[p.id,"available"]));
  return {
    id:"5-9-2026-lvu-rush-11g",
    opponent:"LVU Rush 11G Aspire", venue:"Away", type:"regular",
    date:"5/9/2026", status:"completed",
    starting:[1,16,2,8,17,3,5,22,12,19,13],
    secondHalfStarting:[11,5,3,7,8,12,13,16,17,19,22],
    positions:{1:"GK",16:"DEF",2:"DEF",8:"MID",17:"DEF",3:"DEF",5:"MID",22:"DEF",12:"FWD",19:"FWD",13:"DEF"},
    avail, guests:[], allPlayers:ROSTER, scoreFor:3, scoreAgainst:2,
    events:[
      {type:"sub",         minute:15, playerOff:13, playerOn:7,  subType:"tactical", pos:"MID", half:1, id:uid()},
      {type:"sub",         minute:22, playerOff:5,  playerOn:14, subType:"tactical", pos:"FWD", half:1, id:uid()},
      {type:"goal_for",    minute:25, scorer:12, assist:8,    ownGoal:false, score:"1-0", half:1, id:uid()},
      {type:"goal_against",minute:49, ownGoal:false, score:"1-1", half:2, id:uid()},
      {type:"goal_for",    minute:57, scorer:12, assist:null, ownGoal:false, score:"2-1", half:2, id:uid()},
      {type:"goal_for",    minute:62, scorer:12, assist:2,    ownGoal:false, score:"3-1", half:2, id:uid()},
      {type:"sub",         minute:60, playerOff:13, playerOn:2,  subType:"tactical", pos:"DEF", half:2, id:uid()},
      {type:"sub",         minute:65, playerOff:5,  playerOn:14, subType:"tactical", pos:"FWD", half:2, id:uid()},
      {type:"sub",         minute:74, playerOff:14, playerOn:5,  subType:"tactical", pos:"MID", half:2, id:uid()},
      {type:"goal_against",minute:76, ownGoal:false, score:"3-2", half:2, id:uid()},
    ],
  };
}

export function makeCoppermineGame() {
  const avail = Object.fromEntries(ROSTER.map(p=>[p.id,"available"]));
  const michaela = { id:"M1", num:"G", name:"Michaela", pos:"MID", isGuest:true };
  return {
    id:"5-10-2026-coppermine-11g",
    opponent:"Coppermine Soccer Club 11G Aspire", venue:"Away", type:"regular",
    date:"5/10/2026", status:"completed",
    starting:[1,17,16,7,22,5,13,2,3,12,19],
    secondHalfStarting:[1,17,16,7,22,14,13,2,3,12,19],
    positions:{1:"GK",17:"DEF",16:"DEF",7:"MID",22:"DEF",5:"MID",13:"DEF",2:"DEF",3:"DEF",12:"FWD",19:"FWD"},
    avail, guests:[michaela], allPlayers:[...ROSTER,michaela], scoreFor:6, scoreAgainst:0,
    events:[
      {type:"sub",      minute:21, playerOff:5,  playerOn:14,   subType:"tactical", pos:"MID", half:1, id:uid()},
      {type:"sub",      minute:21, playerOff:19, playerOn:"M1", subType:"tactical", pos:"MID", half:1, id:uid()},
      {type:"goal_for", minute:11, scorer:2,  assist:null, ownGoal:false, score:"1-0", half:1, id:uid()},
      {type:"goal_for", minute:24, scorer:13, assist:12,   ownGoal:false, score:"2-0", half:1, id:uid()},
      {type:"goal_for", minute:34, scorer:2,  assist:12,   ownGoal:false, score:"3-0", half:1, id:uid()},
      {type:"sub",      minute:51, playerOff:13, playerOn:"M1", subType:"tactical", pos:"MID", half:2, id:uid()},
      {type:"goal_for", minute:56, scorer:19, assist:12,   ownGoal:false, score:"4-0", half:2, id:uid()},
      {type:"sub",      minute:60, playerOff:14, playerOn:5,  subType:"tactical", pos:"MID", half:2, id:uid()},
      {type:"sub",      minute:61, playerOff:12, playerOn:13, subType:"tactical", pos:"FWD", half:2, id:uid()},
      {type:"goal_for", minute:69, scorer:19, assist:5,    ownGoal:false, score:"5-0", half:2, id:uid()},
      {type:"sub",      minute:67, playerOff:7,  playerOn:12, subType:"tactical", pos:"FWD", half:2, id:uid()},
      {type:"goal_for", minute:75, scorer:2,  assist:3,    ownGoal:false, score:"6-0", half:2, id:uid()},
    ],
  };
}
