const GOAL=100;
const CHART_PREF_KEY='gym-log.e1rm-series';
const DEFAULT_CHART_EXERCISES=['Bench Press','Deadlift','Back Squat','Standing OHP','Barbell Row','Lever Row'];
const SERIES_COLORS=['#7dd3fc','#86efac','#fbbf24','#c4b5fd','#fb7185','#67e8f9','#fdba74','#a7f3d0'];
const $=s=>document.querySelector(s);
const fmt=n=>Number.isInteger(n)?n:n.toFixed(1);

function e1rm(w,r){return r<=1?w:w*(1+r/30)}
function setWeightKg(s){return s.weightKg??(s.weightKgPerHand?2*s.weightKgPerHand:null)}
function setReps(s){return s.reps??s.repsMin??null}
function setText(s){
  const w=s.weightKgPerHand?`${fmt(s.weightKgPerHand)} kg/hand`:`${fmt(s.weightKg)} kg`;
  const r=s.reps??`${s.repsMin}–${s.repsMax}`;
  return `${r}×${w}`
}
function parseJsonl(t){return t.trim().split(/\n+/).filter(Boolean).map(JSON.parse)}

function loadChartSelection(exerciseNames){
  try{
    const saved=JSON.parse(localStorage.getItem(CHART_PREF_KEY));
    if(Array.isArray(saved)) return saved.filter(name=>exerciseNames.includes(name));
  }catch{}
  return DEFAULT_CHART_EXERCISES.filter(name=>exerciseNames.includes(name));
}

function saveChartSelection(selected){
  localStorage.setItem(CHART_PREF_KEY,JSON.stringify(selected));
}

async function load(){
  const all=parseJsonl(await(await fetch('data/workouts.jsonl?v='+Date.now(),{cache:'no-store'})).text());
  all.sort((a,b)=>(a.order??9999)-(b.order??9999));
  render(all)
}

function render(data){
  const exNames=[...new Set(data.flatMap(x=>x.exercises.map(e=>e.name)))].sort();
  $('#filter').innerHTML='<option value="all">All exercises</option>'+exNames.map(x=>`<option>${x}</option>`).join('');

  const bench=seriesForExercise(data,'Bench Press');
  const bestSingle=Math.max(0,...data.flatMap(s=>s.exercises.filter(e=>e.name==='Bench Press').flatMap(e=>e.sets.filter(x=>(x.reps??0)===1).map(x=>x.weightKg))));
  const latest=bench.at(-1)?.value||0;
  const volume=data.at(-1)?.exercises.reduce((a,e)=>a+e.sets.reduce((x,s)=>x+((s.weightKg??(s.weightKgPerHand?2*s.weightKgPerHand:0))*(s.reps??s.repsMin??0)),0),0)||0;

  $('#stats').innerHTML=`<div class="card"><div class="muted">Bench goal</div><div class="kpi">${fmt(bestSingle)} / ${GOAL} kg</div><div class="progress"><span style="width:${Math.min(100,bestSingle/GOAL*100)}%"></span></div></div><div class="card"><div class="muted">Latest bench e1RM</div><div class="kpi">${fmt(latest)} kg</div></div><div class="card"><div class="muted">Logged sessions</div><div class="kpi">${data.length}</div></div><div class="card"><div class="muted">Latest session volume</div><div class="kpi">${Math.round(volume).toLocaleString('pl-PL')} kg</div></div>`;

  renderRecords(data);
  renderChartControls(data,exNames);

  function sessions(filter='all'){
    $('#sessions').innerHTML=[...data].reverse().map(s=>{
      const es=s.exercises.filter(e=>filter==='all'||e.name===filter);
      if(!es.length)return'';
      return `<div class="session"><b>${s.date||s.dateLabel||'Historical session'}</b> <span class="muted">${s.session||''}</span>${es.map(e=>`<div style="margin-top:8px"><b>${e.name}</b><div class="sets">${e.sets.map(setText).join(' • ')}</div>${e.notes?`<div class="note">${e.notes}</div>`:''}</div>`).join('')}</div>`
    }).join('')||'<p>No matching sessions.</p>'
  }
  sessions();
  $('#filter').onchange=e=>sessions(e.target.value)
}

function seriesForExercise(data,name){
  return data.map((s,i)=>{
    const e=s.exercises.find(x=>x.name===name);
    if(!e)return null;
    const values=e.sets.map(set=>{
      const weight=setWeightKg(set),reps=setReps(set);
      return weight&&reps?e1rm(weight,reps):null;
    }).filter(Number.isFinite);
    if(!values.length)return null;
    return{
      sessionIndex:i,
      label:s.date||s.dateLabel||`Session ${i+1}`,
      value:+Math.max(...values).toFixed(1)
    }
  }).filter(Boolean)
}

function renderChartControls(data,exerciseNames){
  const available=exerciseNames.filter(name=>seriesForExercise(data,name).length);
  let selected=loadChartSelection(available);
  const controls=$('#chart-controls');

  const render=()=>{
    controls.innerHTML=available.map((name,i)=>`<label class="series-option"><input type="checkbox" value="${name}" ${selected.includes(name)?'checked':''}><span class="series-swatch" style="background:${SERIES_COLORS[i%SERIES_COLORS.length]}"></span>${name}</label>`).join('');
    controls.querySelectorAll('input').forEach(input=>{
      input.onchange=()=>{
        selected=[...controls.querySelectorAll('input:checked')].map(x=>x.value);
        saveChartSelection(selected);
        drawSeriesChart(data,selected,available)
      }
    });
    drawSeriesChart(data,selected,available)
  };
  render()
}

function renderRecords(data){
  const wanted=['Bench Press','Deadlift','Standing OHP','Back Squat','Barbell Row','Lever Row','Barbell Curl','Seated Leg Curl'];
  const rows=[];
  for(const name of wanted){
    const sets=data.flatMap(s=>s.exercises.filter(e=>e.name===name).flatMap(e=>e.sets.map(x=>({...x,date:s.date||s.dateLabel||'historical'})))).filter(x=>x.weightKg);
    if(!sets.length)continue;
    const maxWeight=sets.reduce((a,b)=>b.weightKg>a.weightKg||(b.weightKg===a.weightKg&&(b.reps??b.repsMin??0)>(a.reps??a.repsMin??0))?b:a);
    const best=sets.reduce((a,b)=>e1rm(b.weightKg,b.reps??b.repsMin)>e1rm(a.weightKg,a.reps??a.repsMin)?b:a);
    rows.push({name,maxWeight,best,bestE:+e1rm(best.weightKg,best.reps??best.repsMin).toFixed(1)})
  }
  let sec=document.getElementById('records-section');
  if(!sec){
    sec=document.createElement('section');
    sec.id='records-section';
    sec.className='card';
    sec.innerHTML='<h2>Rekordy z treningów</h2><div id="records" class="grid"></div>';
    document.querySelector('#stats').after(sec)
  }
  document.querySelector('#records').innerHTML=rows.map(r=>`<div class="card" style="margin:0"><div class="muted">${r.name}</div><div class="kpi">${fmt(r.maxWeight.weightKg)} kg × ${r.maxWeight.reps??r.maxWeight.repsMin}</div><div class="note">Najlepsze e1RM: ${fmt(r.bestE)} kg (${r.best.reps??r.best.repsMin}×${fmt(r.best.weightKg)} kg)</div></div>`).join('')
}

function drawSeriesChart(data,selected,available){
  const el=$('#chart'),w=900,h=300,p=42;
  if(!selected.length){
    el.innerHTML='<p class="muted">Select at least one exercise to show its e1RM trend.</p>';
    return
  }

  const series=selected.map(name=>({
    name,
    color:SERIES_COLORS[available.indexOf(name)%SERIES_COLORS.length],
    points:seriesForExercise(data,name)
  })).filter(s=>s.points.length);

  if(!series.length){
    el.innerHTML='<p class="muted">No e1RM data for the selected exercises.</p>';
    return
  }

  const vals=series.flatMap(s=>s.points.map(p=>p.value));
  let min=Math.floor(Math.min(...vals)-3),max=Math.ceil(Math.max(...vals)+3);
  if(min===max){min-=1;max+=1}
  const maxSessionIndex=Math.max(1,data.length-1);
  const x=i=>p+i*(w-2*p)/maxSessionIndex;
  const y=v=>h-p-(v-min)*(h-2*p)/(max-min);

  const gridLines=[0,.25,.5,.75,1].map(t=>{
    const value=max-(max-min)*t;
    const yy=p+t*(h-2*p);
    return `<line class="grid-line" x1="${p}" y1="${yy}" x2="${w-p}" y2="${yy}"/><text x="4" y="${yy+4}">${fmt(+value.toFixed(1))} kg</text>`
  }).join('');

  const plots=series.map(s=>{
    const path=s.points.map((q,i)=>`${i?'L':'M'}${x(q.sessionIndex)},${y(q.value)}`).join(' ');
    return `<path class="plot" style="stroke:${s.color}" d="${path}"/>${s.points.map(q=>`<circle class="dot" style="fill:${s.color}" cx="${x(q.sessionIndex)}" cy="${y(q.value)}" r="4.5"><title>${s.name} — ${q.label}: ${q.value} kg</title></circle>`).join('')}`
  }).join('');

  el.innerHTML=`<svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">${gridLines}<line class="axis" x1="${p}" y1="${h-p}" x2="${w-p}" y2="${h-p}"/><line class="axis" x1="${p}" y1="${p}" x2="${p}" y2="${h-p}"/>${plots}</svg>`
}

load();
