(() => {
  'use strict';

  const STORAGE = 'memo-clock-v1';
  const MIX_ENDPOINT = document.querySelector('meta[name="memo-clock-api"]')?.content || '/api/mix';
  const TZ = 'Asia/Seoul';
  const $ = (selector) => document.querySelector(selector);
  const pad = (number) => String(number).padStart(2, '0');
  const seedRows = [
    ['2026-10-16','07:02:14','설거지해놓기'],['2026-10-16','07:48:23','꽃병'],['2026-10-16','11:30:47','자간을 숨처럼'],['2026-10-16','13:02:09','점심 뭐먹지'],['2026-10-16','14:22:23','모서리가 닳은 책'],['2026-10-16','16:40:31','인쇄소 전화하기 3시 전에'],['2026-10-16','19:07:55','노을이 형광펜 같았다'],['2026-10-16','23:59:59','하루 끝'],
    ['2026-10-17','07:15:40','알람 세 번 끔'],['2026-10-17','08:02:23','우유 사기'],['2026-10-17','10:33:14','망점'],['2026-10-17','12:48:09','그리드를 깨는 건 그리드를 알아야 가능'],['2026-10-17','14:02:47','창문에 붙은 낙엽'],['2026-10-17','15:23:23','답장하기'],['2026-10-17','17:56:02','손톱 깎기'],['2026-10-17','20:11:31','유리컵에 비친 형광등'],['2026-10-17','21:42:14','엄마한테 전화'],
    ['2026-10-18','07:02:47','빨래 개기'],['2026-10-18','09:40:23','먼지'],['2026-10-18','10:11:02','포스터 여백 더 크게'],['2026-10-18','11:48:31','오래된 영수증'],['2026-10-18','13:30:14','비 냄새'],['2026-10-18','14:52:09','등고선처럼 퍼지는 글자'],['2026-10-18','16:02:55','택배 반품'],['2026-10-18','18:23:40','누군가 버린 의자'],['2026-10-18','20:07:23','고양이가 나를 오래 봤다'],['2026-10-18','23:15:02','잊고 싶은 건 자꾸 메모하게 된다'],
    ['2026-10-19','07:30:31','물 두 잔'],['2026-10-19','08:48:14','지각'],['2026-10-19','10:02:23','흰 종이에 검정 잉크 하나면 충분'],['2026-10-19','12:15:47','편의점 삼각김밥'],['2026-10-19','15:33:09','폰트 라이선스 확인'],['2026-10-19','17:02:14','계단에서 넘어질 뻔'],['2026-10-19','19:44:55','창밖 크레인'],['2026-10-19','22:48:23','메모 시계 기획서 쓰기']
  ];
  const demoMemos = seedRows.map(([date,time,text],i) => {
    const [h,m,s] = time.split(':').map(Number);
    return {id:`demo_${i+1}`,text,createdAt:`${date}T${time}+09:00`,h,m,s,deleted:false};
  });
  const fmt = new Intl.DateTimeFormat('en-GB',{timeZone:TZ,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  function nowParts(date = new Date()) {
    const p = Object.fromEntries(fmt.formatToParts(date).filter(x => x.type !== 'literal').map(x => [x.type,x.value]));
    return {year:p.year,month:p.month,day:p.day,h:+p.hour,m:+p.minute,s:+p.second,date:`${p.year}-${p.month}-${p.day}`,time:`${p.hour}:${p.minute}:${p.second}`,iso:`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}+09:00`};
  }
  function safeData(raw) {
    if (!raw || !Array.isArray(raw.memos) || !Array.isArray(raw.sentences)) return null;
    return {
      memos:raw.memos.filter(x => x && typeof x.id === 'string' && typeof x.text === 'string' && typeof x.createdAt === 'string' && Number.isInteger(x.h) && x.h>=0 && x.h<24 && Number.isInteger(x.m) && x.m>=0 && x.m<60 && Number.isInteger(x.s) && x.s>=0 && x.s<60).map(x => ({id:x.id,text:x.text,createdAt:x.createdAt,h:x.h,m:x.m,s:x.s,deleted:!!x.deleted})),
      sentences:raw.sentences.filter(x => x && typeof x.id === 'string' && typeof x.createdAt === 'string' && Array.isArray(x.segments) && x.sources && typeof x.sources === 'object' && x.pickTime && Number.isInteger(x.pickTime.h) && Number.isInteger(x.pickTime.m) && Number.isInteger(x.pickTime.s))
    };
  }
  function loadData() {
    try { const stored = localStorage.getItem(STORAGE); if (stored) return safeData(JSON.parse(stored)) || {memos:[...demoMemos],sentences:[]}; }
    catch (_) { /* local storage can be disabled; the page still runs in memory */ }
    return {memos:[...demoMemos],sentences:[]};
  }
  let data = loadData();
  function persist() { try { localStorage.setItem(STORAGE,JSON.stringify(data)); } catch (_) { showStatus('Session only'); } }
  try {if (!localStorage.getItem(STORAGE)) persist();} catch (_) { /* storage is optional */ }

  const clockButton = $('#clock-toggle');
  const board = $('#memo-board');
  board.inert=true;
  const boardScroll = $('#board-scroll');
  const boardList = $('#board-list');
  const input = $('#memo-input');
  const status = $('#status');
  const paper = $('#paper');
  const particleCanvas = $('#particles');
  const pctx = particleCanvas.getContext('2d');
  let displayedTime = '';
  let mixing = false;
  let animationFrame = 0;
  let selectedDate=null, selectedMemoId=null;
  let suppressClickUntil=0;
  let remixOrigin=null;

  const inkClock=new InkClock(['hour-digits','minute-digits','second-digits'].map(id=>document.getElementById(id)));
  function renderClock(value,animate=true) {
    if(value===displayedTime)return;
    inkClock.setTime(value,animate);displayedTime=value;
    $('#time-readout').textContent=`${value.slice(0,2)}:${value.slice(2,4)}:${value.slice(4)}`;
  }
  function formatDate(date) {
    const [y,m,d] = date.slice(0,10).split('-');
    const months=['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    return `${d}-${months[Number(m)-1] || '???'}-${y}`;
  }
  function tick() {
    const p=nowParts();
    if (!selectedDate) renderClock(`${pad(p.h)}${pad(p.m)}${pad(p.s)}`);
    $('#today-date').textContent=formatDate(selectedDate||p.date);
    $('#composer-time').textContent=p.time;
    clockButton.setAttribute('aria-label',`${$('#time-readout').textContent}. ${selectedDate?formatDate(selectedDate):'Live'}. Open archive`);
  }
  tick();
  setInterval(tick,125);

  function showStatus(message) { status.textContent=message; }
  function countText() {
    $('#memo-count').textContent=String(data.memos.filter(x => !x.deleted && (!selectedDate||x.createdAt.startsWith(selectedDate))).length).padStart(3,'0');
    $('#figure-count').textContent=String(data.sentences.length).padStart(3,'0');
    $('#sentence-count-top').textContent=String(data.sentences.length).padStart(3,'0');
    $('#board-count').textContent=`${String(data.memos.filter(x => !x.deleted).length + data.sentences.length).padStart(3,'0')} entries`;
  }
  function sourceMemo(sentence,key) { return data.memos.find(m => m.id === sentence.sources[key]); }
  function appendSegments(container,sentence) {
    for (const segment of sentence.segments) {
      if (!segment || typeof segment.text !== 'string') continue;
      const span=document.createElement('span');
      span.textContent=segment.text;
      if (segment.type === 'memo') {
        const memo=sourceMemo(sentence,segment.source);
        span.className=`memo-part${!memo || memo.deleted ? ' deleted' : ''}`;
        span.tabIndex=0;
        span.setAttribute('role','link');
        span.title=memo && !memo.deleted ? `${memo.text}\n${memo.createdAt.slice(0,10)} ${memo.createdAt.slice(11,19)}` : 'Deleted note';
        const jump=() => {
          if (!memo || memo.deleted) { showStatus('Note deleted'); return; }
          openBoard(memo.id);
        };
        span.addEventListener('click',jump);
        span.addEventListener('keydown',e => { if (e.key==='Enter' || e.key===' ') {e.preventDefault();jump();} });
      } else span.className='glue-part';
      container.append(span);
    }
  }
  function renderSentence() {
    const display=$('#sentence-display');
    display.replaceChildren();
    const sentence=data.sentences.at(-1);
    if (!sentence) {
      display.classList.add('empty');
      display.textContent='—';
      $('#sentence-caption').textContent='';
      return;
    }
    display.classList.remove('empty');
    appendSegments(display,sentence);
    const t=sentence.pickTime;
    $('#sentence-caption').textContent=`${pad(t.h)}:${pad(t.m)}:${pad(t.s)}`;
  }
  function sentenceText(sentence) { return sentence.segments.map(s => s.text).join(''); }
  function renderBoard() {
    boardList.replaceChildren();
    const today=nowParts().date;
    const items=[...data.memos.filter(x => !x.deleted).map(x => ({type:'memo',value:x})),...data.sentences.map(x => ({type:'sentence',value:x}))].sort((a,b) => a.value.createdAt.localeCompare(b.value.createdAt));
    let lastDate='';
    items.forEach((item,index) => {
      const date=item.value.createdAt.slice(0,10);
      if (date !== lastDate) { const divider=document.createElement('div');divider.className='date-divider';divider.textContent=formatDate(date);boardList.append(divider);lastDate=date; }
      const row=document.createElement('div');
      row.className=`board-row ${item.type === 'sentence' ? 'sentence-row' : ''} ${date < today ? 'old-row' : ''}`;
      row.style.setProperty('--row',index%16);
      row.dataset.id=item.value.id;
      const time=document.createElement('span');time.className='row-time';time.textContent=item.value.createdAt.slice(11,19);
      const text=document.createElement('span');text.className='row-text';
      if (item.type === 'memo') {
        text.textContent=item.value.text;
        text.title=item.value.text.length > 32 ? 'Expand' : '';
        text.addEventListener('click',() => row.classList.toggle('expanded'));
      } else {
        const mark=document.createElement('span');mark.textContent='※ ';
        text.append(mark);
        appendSegments(text,item.value);
        text.title=sentenceText(item.value);
        text.addEventListener('click',e => { if (!e.target.classList.contains('memo-part')) row.classList.toggle('expanded'); });
      }
      const actions=document.createElement('span');actions.className='row-actions';
      if (item.type === 'memo') {
        const del=document.createElement('button');del.className='row-delete';del.type='button';del.textContent='Delete';del.setAttribute('aria-label',`Delete note: ${item.value.text}`);del.addEventListener('click',() => row.classList.add('confirming'));
        const yes=document.createElement('button');yes.className='row-confirm';yes.type='button';yes.textContent='Delete';yes.addEventListener('click',() => {item.value.deleted=true;persist();renderAll();showStatus('Deleted');});
        const no=document.createElement('button');no.className='row-cancel';no.type='button';no.textContent='Keep';no.addEventListener('click',() => row.classList.remove('confirming'));
        actions.append(del,yes,no);
      }
      row.append(time,text,actions);boardList.append(row);
    });
  }
  function renderAll() {countText();renderSentence();renderBoard();renderDay();}
  renderAll();
  function setBoardFocus(open) {
    for(const selector of ['.masthead','.stage','.composer']) $(selector).inert=open;
    if(open){setTools(false);$('#close-board').focus();}else clockButton.focus();
  }
  function openBoard(id) {
    board.classList.add('open');board.inert=false;board.setAttribute('aria-hidden','false');clockButton.setAttribute('aria-expanded','true');$('#clock-hint').textContent='Close ×';setBoardFocus(true);
    closeRemix();
    setTimeout(() => {
      if (id) {
        const target=[...boardList.querySelectorAll('.board-row')].find(row => row.dataset.id === id);
        if (target) {target.scrollIntoView({block:'center',behavior:'smooth'});target.classList.add('highlight');setTimeout(() => target.classList.remove('highlight'),2600);}
      } else if(selectedDate){const target=[...boardList.querySelectorAll('.date-divider')].find(el=>el.textContent===formatDate(selectedDate));if(target)target.scrollIntoView({block:'start'});}
      else boardScroll.scrollTop=boardScroll.scrollHeight;
    },140);
  }
  function closeBoard() {board.classList.remove('open');board.inert=true;board.setAttribute('aria-hidden','true');clockButton.setAttribute('aria-expanded','false');$('#clock-hint').textContent='Archive ↗';setBoardFocus(false);}
  clockButton.addEventListener('click',() => {if(performance.now()<suppressClickUntil)return;board.classList.contains('open') ? closeBoard() : openBoard();});
  $('#close-board').addEventListener('click',closeBoard);
  $('#clock-hint').addEventListener('click',() => board.classList.contains('open') ? closeBoard() : openBoard());
  document.addEventListener('keydown',e => {
    if(e.key==='Escape'){if(board.classList.contains('open'))closeBoard();setTools(false);}
    if(e.key==='Tab' && board.classList.contains('open')) {
      const controls=[...board.querySelectorAll('button,[tabindex="0"]')].filter(el=>el.offsetParent!==null && getComputedStyle(el).visibility!=='hidden');
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
      else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
    }
  });
  inkClock.warm();

  function dateShift(date,days){const d=new Date(`${date}T12:00:00+09:00`);d.setUTCDate(d.getUTCDate()+days);return nowParts(d).date;}
  function dayMemos(){return data.memos.filter(m=>!m.deleted&&m.createdAt.startsWith(selectedDate||nowParts().date)).sort((a,b)=>a.createdAt.localeCompare(b.createdAt));}
  function earliestDate(){return data.memos.filter(m=>!m.deleted).reduce((date,m)=>m.createdAt.slice(0,10)<date?m.createdAt.slice(0,10):date,nowParts().date);}
  function selectMemo(memo){
    selectedMemoId=memo.id;renderClock(`${pad(memo.h)}${pad(memo.m)}${pad(memo.s)}`);
    for(const row of $('#day-list').children)row.setAttribute('aria-pressed',String(row.dataset.id===memo.id));
  }
  function renderDay(){
    const past=Boolean(selectedDate),today=nowParts().date;
    document.body.classList.toggle('past-day',past);
    $('#today-button').hidden=!past;$('#day-records').hidden=!past;$('.sentence-section').hidden=past;
    $('#next-day').disabled=!past;$('#previous-day').disabled=(selectedDate||today)<=earliestDate();
    $('#day-state').textContent=past?'Recorded':'Live';
    $('#day-list').replaceChildren();
    if(past){
      const notes=dayMemos();$('#day-note-count').textContent=`${notes.length} notes`;
      if(!notes.length){const empty=document.createElement('p');empty.className='day-empty';empty.textContent='No notes';$('#day-list').append(empty);renderClock('000000');}
      for(const memo of notes){
        const row=document.createElement('button');row.type='button';row.className='day-note';row.dataset.id=memo.id;
        const time=document.createElement('span');time.textContent=memo.createdAt.slice(11,19);
        const text=document.createElement('span');text.textContent=memo.text;row.append(time,text);
        row.addEventListener('click',()=>selectMemo(memo));$('#day-list').append(row);
      }
      const chosen=notes.find(m=>m.id===selectedMemoId)||notes.at(-1);
      if(chosen){selectMemo(chosen);requestAnimationFrame(()=>{const list=$('#day-list'),row=list.querySelector('[aria-pressed="true"]');if(row)list.scrollTop=Math.max(0,row.offsetTop-list.clientHeight+row.offsetHeight);});}
    }else tick();
    $('#today-date').textContent=formatDate(selectedDate||today);countText();
  }
  function changeDay(direction){
    const today=nowParts().date,current=selectedDate||today;
    const target=dateShift(current,direction);
    if(target>today||target<earliestDate()){inkClock.ripple();return;}
    selectedDate=target===today?null:target;selectedMemoId=null;
    renderDay();showStatus(selectedDate?formatDate(selectedDate):'Live');
  }
  $('#previous-day').addEventListener('click',()=>changeDay(-1));
  $('#next-day').addEventListener('click',()=>changeDay(1));
  $('#today-button').addEventListener('click',()=>{selectedDate=null;selectedMemoId=null;renderDay();showStatus('Live');});
  clockButton.addEventListener('keydown',e=>{if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();changeDay(e.key==='ArrowUp'?-1:1);}});
  const clockSurface=$('.clock-section');
  const gestures=new ClockGestures(clockSurface,{
    onDay:direction=>{closeRemix();changeDay(direction);},
    onMix:origin=>mix({random:true,origin,gesture:true}),
    onRipple:()=>inkClock.ripple(),
    onSuppressClick:()=>{suppressClickUntil=performance.now()+600;},
    onHint:text=>{$('#gesture-hint').textContent=text;},
    onPreview:({scale,dy,active})=>{
      clockSurface.classList.toggle('manipulating',active);
      if(active){clockSurface.style.setProperty('--pinch',scale);clockSurface.style.setProperty('--drag-y',`${dy}px`);}
      else{clockSurface.style.removeProperty('--pinch');clockSurface.style.removeProperty('--drag-y');}
    }
  });
  // Wheel events over the surrounding stage navigate days; lists keep scrolling.
  $('.stage').addEventListener('wheel',e=>{if(!clockSurface.contains(e.target)&&!e.ctrlKey)gestures.wheel(e);},{passive:false});

  function resizeCanvas(canvas) {
    const ratio=Math.min(devicePixelRatio || 1,2);
    canvas.width=Math.round(innerWidth*ratio);canvas.height=Math.round(innerHeight*ratio);
    canvas.style.width=`${innerWidth}px`;canvas.style.height=`${innerHeight}px`;
    const ctx=canvas.getContext('2d');ctx.setTransform(ratio,0,0,ratio,0,0);return ctx;
  }
  function drawPaper() {
    const ctx=resizeCanvas(paper);
    ctx.clearRect(0,0,innerWidth,innerHeight);
  }
  resizeCanvas(particleCanvas);drawPaper();
  addEventListener('resize',() => {resizeCanvas(particleCanvas);drawPaper();});
  function particleText(text,origin,targets,duration=1280,pulseOnEnd=true) {
    if(matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    cancelAnimationFrame(animationFrame);
    const canvas=document.createElement('canvas');canvas.width=420;canvas.height=90;
    const c=canvas.getContext('2d');c.fillStyle='#000';c.font='bold 42px Arial';c.fillText(text.replace(/\s+/g,' ').slice(0,22),5,57,410);
    const pixels=c.getImageData(0,0,420,90).data;
    const points=[];
    for(let y=2;y<87;y+=3) for(let x=2;x<418;x+=3) if(pixels[(y*420+x)*4+3]>120 && Math.random()<.42) points.push({x,y});
    while(points.length<85) points.push({x:Math.random()*420,y:Math.random()*90});
    const origins=Array.isArray(origin)?origin:[origin];
    const particles=points.slice(0,260).map((point,i) => {
      const start=origins[i%origins.length];
      return {
        x:start.x+(point.x/420-.5)*Math.min(320,start.width||100),
        y:start.y+(point.y/90-.5)*50,
        target:targets[i%targets.length],
        size:Math.random()<.83?1.1:2.3,
        delay:Math.random()*.25,
        phase:Math.random()*Math.PI*2,
        curve:(Math.random()-.5)*110
      };
    });
    const started=performance.now();
    function frame(now) {
      const t=(now-started)/duration;
      pctx.clearRect(0,0,innerWidth,innerHeight);
      pctx.fillStyle='#000';
      for(const particle of particles) {
        const q=Math.max(0,Math.min(1,(t-particle.delay)/(1-particle.delay)));
        if(q===0 || q>=1) continue;
        const ease=q*q*(3-2*q);
        const x=particle.x+(particle.target.x-particle.x)*ease+Math.sin(q*16+particle.phase)*particle.curve*(1-q)*q;
        const y=particle.y+(particle.target.y-particle.y)*ease+Math.sin(q*Math.PI)*particle.curve*.22;
        const r=particle.size*(q>.88?1.6:1);
        pctx.beginPath();pctx.arc(x,y,r,0,Math.PI*2);pctx.fill();
      }
      if(t<1) animationFrame=requestAnimationFrame(frame);else {
        pctx.clearRect(0,0,innerWidth,innerHeight);
        if(pulseOnEnd)inkClock.ripple();
      }
    }
    animationFrame=requestAnimationFrame(frame);
  }
  function groupCenters() {return [...document.querySelectorAll('.clock-group')].map(el => {const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};});}
  function saveMemo() {
    const text=input.value.trim();if(!text) {input.focus();return;}
    const p=nowParts();
    data.memos.push({id:`m_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,text,createdAt:p.iso,h:p.h,m:p.m,s:p.s,deleted:false});
    const r=input.getBoundingClientRect();
    input.value='';input.style.height='';selectedDate=null;selectedMemoId=null;persist();renderAll();
    showStatus(`Saved · ${p.time}`);
    particleText(text,{x:r.left+r.width/2,y:r.top+r.height/2,width:r.width},groupCenters());
    input.focus();
    if(board.classList.contains('open')) boardScroll.scrollTop=boardScroll.scrollHeight;
  }
  $('#memo-form').addEventListener('submit',e => {e.preventDefault();saveMemo();});
  input.addEventListener('keydown',e => {if(e.key==='Enter' && !e.shiftKey && !e.isComposing){e.preventDefault();saveMemo();}});
  input.addEventListener('input',() => {input.style.height='auto';input.style.height=`${Math.min(input.scrollHeight,120)}px`;});

  const distance=(a,b,mod) => Math.min(Math.abs(a-b),mod-Math.abs(a-b));
  function weightedRandom(candidates) {
    const now=Date.now();
    const weights=candidates.map(m => 1/Math.pow(1+Math.max(0,(now-Date.parse(m.createdAt))/86400000),1.3));
    let pick=Math.random()*weights.reduce((a,b)=>a+b,0);
    for(let i=0;i<candidates.length;i++) {pick-=weights[i];if(pick<=0)return candidates[i];}
    return candidates.at(-1);
  }
  function chooseMemos(time) {
    const available=data.memos.filter(m => !m.deleted);
    const used=new Set();const result={};
    for(const [key,mod] of [['h',24],['m',60],['s',60]]) {
      const remaining=available.filter(m => !used.has(m.id));if(!remaining.length)break;
      const closest=Math.min(...remaining.map(m => distance(m[key],time[key],mod)));
      const choices=remaining.filter(m => distance(m[key],time[key],mod)===closest);
      const selected=weightedRandom(choices);result[key]=selected;used.add(selected.id);
    }
    return result;
  }
  function fallbackSegments(picks) {
    const segments=[];
    for(const key of ['h','m','s']) if(picks[key]) {
      if(segments.length) segments.push({type:'glue',text:', '});
      segments.push({type:'memo',source:key,text:picks[key].text});
    }
    if(segments.length) segments.push({type:'glue',text:'.'});
    return segments;
  }
  function validSegments(segments,picks) {
    if(!Array.isArray(segments) || !segments.length || segments.length>24)return false;
    const used=new Set();
    for(const segment of segments) {
      if(!segment || typeof segment.text!=='string' || !segment.text.length || segment.text.length>100) return false;
      if(segment.type==='memo') {if(!picks[segment.source] || !picks[segment.source].text.includes(segment.text))return false;used.add(segment.source);}
      else if(segment.type!=='glue')return false;
    }
    return Object.keys(picks).every(key => used.has(key));
  }
  async function requestSentence(picks,retry=false) {
    const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),13000);
    try {
      const response=await fetch(MIX_ENDPOINT,{
        method:'POST',signal:controller.signal,credentials:'omit',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({picks:Object.fromEntries(Object.entries(picks).map(([key,memo])=>[key,memo.text])),retry})
      });
      if(response.status===503)return null;
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const json=await response.json();
      return json.segments;
    } finally {clearTimeout(timer);}
  }
  function emitSentenceParticles() {
    const display=$('#sentence-display').getBoundingClientRect();
    const centers=groupCenters();
    particleText('HH MM SS',centers.map(center => ({...center,width:90})),[{x:display.left+Math.min(display.width/2,300),y:display.top+display.height/2}],800,false);
  }
  function randomPicks(){
    const available=data.memos.filter(m=>!m.deleted);
    // Shuffle distinct notes so repeated pinches produce different combinations.
    for(let i=available.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[available[i],available[j]]=[available[j],available[i]];}
    return Object.fromEntries(['h','m','s'].slice(0,available.length).map((key,i)=>[key,available[i]]));
  }
  function previewSentence(picks,p){return {pickTime:{h:p.h,m:p.m,s:p.s},sources:Object.fromEntries(Object.entries(picks).map(([key,m])=>[key,m.id])),segments:fallbackSegments(picks)};}
  function positionRemix(){
    const pop=$('#remix-popover');if(pop.hidden||!remixOrigin)return;
    const vv=window.visualViewport,w=vv?.width||innerWidth,h=vv?.height||innerHeight;
    const ox=vv?.offsetLeft||0,oy=vv?.offsetTop||0,r=pop.getBoundingClientRect(),pad=20;
    const x=Number.isFinite(remixOrigin.x)?remixOrigin.x:ox+w/2,y=Number.isFinite(remixOrigin.y)?remixOrigin.y:oy+h/2;
    pop.style.left=`${Math.max(ox+pad,Math.min(ox+w-r.width-pad,x-r.width/2))}px`;
    pop.style.top=`${Math.max(oy+pad,Math.min(oy+h-r.height-pad,y-r.height/2))}px`;
  }
  function showRemix(sentence,origin,pending=false){
    const pop=$('#remix-popover');pop.hidden=false;pop.setAttribute('aria-busy',String(pending));
    clockSurface.classList.add('remix-open');
    const copy=$('#remix-copy');copy.replaceChildren();appendSegments(copy,sentence);
    $('#remix-state').textContent=pending?'Mixing':'Mix';
    if(origin)remixOrigin=origin;
    positionRemix();
    if(origin){pop.classList.remove('emerging');void pop.offsetWidth;pop.classList.add('emerging');}
  }
  function closeRemix(){const pop=$('#remix-popover');if(!pop)return;pop.hidden=true;$('.clock-section')?.classList.remove('remix-open');}
  $('#remix-close').addEventListener('click',()=>{closeRemix();clockButton.focus();});
  document.addEventListener('keydown',e=>{if(e.key==='Escape')closeRemix();});
  addEventListener('resize',()=>requestAnimationFrame(positionRemix));
  window.visualViewport?.addEventListener('resize',positionRemix);
  window.visualViewport?.addEventListener('scroll',positionRemix);
  async function mix(options={}) {
    if(mixing)return;
    const p=nowParts(),picks=options.random?randomPicks():chooseMemos(p);
    if(!Object.keys(picks).length){showStatus('Write first');return;}
    if(!options.gesture){selectedDate=null;selectedMemoId=null;renderDay();}
    mixing=true;$('#mix-button').disabled=true;showStatus('Mixing…');
    if(options.gesture)showRemix(previewSentence(picks,p),options.origin,true);
    inkClock.ripple();
    let segments=null,problem='';
    try{
      segments=await requestSentence(picks);
      if(segments&&!validSegments(segments,picks))segments=await requestSentence(picks,true);
      if(!segments||!validSegments(segments,picks)){segments=null;problem='Original mix';}
    }catch(_){problem='Offline mix';}
    mixing=false;$('#mix-button').disabled=false;
    if(!selectedDate){const current=nowParts();renderClock(`${pad(current.h)}${pad(current.m)}${pad(current.s)}`);}
    if(!segments)segments=fallbackSegments(picks);
    const sentence={id:`s_${Date.now()}_${Math.random().toString(36).slice(2,6)}`,createdAt:p.iso,pickTime:{h:p.h,m:p.m,s:p.s},sources:Object.fromEntries(Object.entries(picks).map(([key,m])=>[key,m.id])),segments};
    data.sentences.push(sentence);persist();renderAll();
    if(options.gesture){if(!$('#remix-popover').hidden)showRemix(sentence,null);}
    else emitSentenceParticles();
    showStatus(problem||'Mixed');
  }
  $('#mix-button').addEventListener('click',()=>mix());

  function setTools(open) {$('#tools-panel').hidden=!open;$('#tools-toggle').setAttribute('aria-expanded',String(open));}
  $('#tools-toggle').addEventListener('click',() => setTools($('#tools-panel').hidden));
  $('#tools-close').addEventListener('click',() => setTools(false));
  $('#export-data').addEventListener('click',() => {const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`memo-clock-${nowParts().date}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);showStatus('Exported');});
  $('#import-data').addEventListener('click',() => $('#import-file').click());
  $('#import-file').addEventListener('change',async e => {const file=e.target.files?.[0];if(!file)return;try {const imported=safeData(JSON.parse(await file.text()));if(!imported)throw new Error('Invalid file');const memoIds=new Set(data.memos.map(x=>x.id));const sentenceIds=new Set(data.sentences.map(x=>x.id));data.memos.push(...imported.memos.filter(x=>!memoIds.has(x.id)));data.sentences.push(...imported.sentences.filter(x=>!sentenceIds.has(x.id)));data.memos.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));data.sentences.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));persist();renderAll();showStatus('Imported');}catch(error){showStatus('Import failed');}e.target.value='';});
  $('#restore-demo').addEventListener('click',() => {const known=new Set(data.memos.map(x=>x.id));data.memos.push(...demoMemos.filter(x=>!known.has(x.id)));data.memos.sort((a,b)=>a.createdAt.localeCompare(b.createdAt));persist();renderAll();showStatus('Demo restored');});
})();
