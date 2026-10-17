(() => {
  'use strict';
  const KEY = 'nextstep.pwa.v0.2';
  const URGENCY = { whenever:'不着急', soon:'最近处理', remember:'必须记得', deadline:'有截止日期' };
  const REPEAT = { daily:'每天', weekly:'每周', monthly:'每月', after3:'完成后隔 3 天' };
  const ENERGY = { low:0, medium:1, high:2 };
  const $ = id => document.getElementById(id);
  const today = () => { const d=new Date(); return new Date(d.getFullYear(),d.getMonth(),d.getDate()); };
  const addDays = (date,n) => { const d=new Date(date); d.setDate(d.getDate()+n); return d; };
  const dayDiff = (a,b) => Math.floor((todayFrom(b)-todayFrom(a))/86400000);
  const todayFrom = d => { const x=new Date(d); return new Date(x.getFullYear(),x.getMonth(),x.getDate()).getTime(); };
  const parseDate = value => value ? new Date(`${value}T12:00:00`) : null;
  const formatDate = d => { const x=new Date(d); return `${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`; };
  const esc = str => String(str).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const uid = () => globalThis.crypto?.randomUUID?.() || `task-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const defaults = () => ({tasks:[],energy:'medium',duration:30,currentId:null,resting:false,focusing:false});
  function load() { try { const raw=JSON.parse(localStorage.getItem(KEY)); return raw && Array.isArray(raw.tasks) ? {...defaults(),...raw} : defaults(); } catch { return defaults(); } }
  let state=load(); let editId=null; let toastTimeout;
  function save() { try { localStorage.setItem(KEY,JSON.stringify(state)); } catch { toast('保存失败：本地存储空间可能已满'); } }
  function toast(msg){ const el=$('toast'); el.textContent=msg; el.classList.add('show'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>el.classList.remove('show'),2600); }
  function eligible(t){ return !t.nextEligible || new Date(t.nextEligible)<=new Date(); }
  function score(t){
    const urgency={whenever:0,soon:4,remember:9,deadline:12}[t.urgency]??4;
    const aging=Math.min(8,Math.max(0,Math.floor(dayDiff(t.waitingSince||new Date(),new Date())/3)));
    const until=t.deadline?dayDiff(new Date(),parseDate(t.deadline)):Infinity;
    const deadlineBonus=until<=0?24:until<=2?15:until<=7?7:0;
    const gap=(ENERGY[t.energy]??1)-(ENERGY[state.energy]??1);
    const energyFit=gap===0?4:gap<0?2:-5*gap;
    const durationFit=Number(t.duration)<=Number(state.duration)?4:-6;
    return urgency+aging+deadlineBonus+energyFit+durationFit-Math.min(3,t.skipCount||0)*2;
  }
  function pick(exclude){ const available=state.tasks.filter(eligible); const pool=available.filter(t=>t.id!==exclude); const candidates=pool.length?pool:available; candidates.sort((a,b)=>score(b)-score(a)||(new Date(a.createdAt)-new Date(b.createdAt))); state.currentId=candidates[0]?.id??null; state.resting=false; state.focusing=false; save(); }
  function current(){ return state.tasks.find(t=>t.id===state.currentId&&eligible(t))||null; }
  function ensureCurrent(){ if(state.currentId&&!current()){state.currentId=null;state.focusing=false;} if(!state.currentId&&!state.resting)pick(); }
  function nextOccurrence(t){
    const d=t.nextEligible&&new Date(t.nextEligible)>today()?new Date(t.nextEligible):today();
    let next;
    if(t.repeat==='daily')next=addDays(d,1);
    else if(t.repeat==='weekly')next=addDays(d,7);
    else if(t.repeat==='monthly'){ const x=new Date(d); const targetMonth=x.getMonth()+1; next=new Date(x.getFullYear(),targetMonth,Math.min(x.getDate(),new Date(x.getFullYear(),targetMonth+1,0).getDate())); }
    else next=addDays(today(),3);
    // Recurring tasks do not accumulate missed instances.
    if(t.repeat!=='after3' && next<=today()){
      while(next<=today()){
        if(t.repeat==='daily')next=addDays(next,1);
        else if(t.repeat==='weekly')next=addDays(next,7);
        else {const m=next.getMonth()+1;next=new Date(next.getFullYear(),m,Math.min(next.getDate(),new Date(next.getFullYear(),m+1,0).getDate()));}
      }
    }
    return next.toISOString();
  }
  function finish(id){ const t=state.tasks.find(x=>x.id===id); if(!t)return; if(t.repeat){ t.nextEligible=nextOccurrence(t);t.waitingSince=t.nextEligible;t.skipCount=0; } else state.tasks=state.tasks.filter(x=>x.id!==id); state.currentId=null;state.focusing=false;state.resting=true;save();render();toast(t.repeat?'完成了，下次到时间再出现':'完成了，已经从任务池移除'); }
  function meta(t){let parts=[URGENCY[t.urgency]||'最近处理',`${t.duration} 分钟`];if(t.repeat)parts.push(REPEAT[t.repeat]);if(t.deadline)parts.push(`截止 ${t.deadline}`);return parts.join(' · ');}
  function renderHome(){ensureCurrent();const t=current();const target=$('homeContent');
    if(state.resting){target.innerHTML='<div class="rest"><div class="kicker">可以先休息</div><h2>已经够了。</h2><p>剩下的事会留在这里，不用现在处理。</p><button class="primary full" id="continueBtn">想继续时，再选一件</button></div>';$('continueBtn').onclick=()=>{pick();render();};return;}
    if(!t){const future=state.tasks.length>0;target.innerHTML=`<div class="empty"><h2>${future?'今天先到这里':'先把事情放进来'}</h2><p>${future?'循环任务还没到下一次出现的时间。':'记下一件想做的事，我们只挑一件开始。'}</p><button class="primary full" id="emptyAdd">${future?'再记下一件事':'＋ 添加第一件事'}</button></div>`;$('emptyAdd').onclick=()=>openTask();return;}
    target.innerHTML=`<div class="recommend"><div class="kicker">${state.focusing?'正在做这一件':'现在，试试这件事'}</div><h2 class="task-name">${esc(t.title)}</h2><div class="task-meta">${esc(meta(t))}</div><button class="primary full" id="mainAction">${state.focusing?'完成这件事':'开始'}</button><div class="secondary-actions"><button id="swapTask">换一件</button><button id="restTask">暂时不做</button></div></div>`;
    $('mainAction').onclick=()=>{if(state.focusing)finish(t.id);else{t.skipCount=0;state.focusing=true;save();renderHome();}};
    $('swapTask').onclick=()=>{t.skipCount=Math.min(3,(t.skipCount||0)+1);pick(t.id);renderHome();};
    $('restTask').onclick=()=>{state.resting=true;state.focusing=false;state.currentId=null;save();renderHome();};
  }
  function renderList(){const el=$('taskList');const active=state.tasks.filter(eligible);const future=state.tasks.filter(t=>!eligible(t));let html='';
    if(!state.tasks.length)html='<div class="empty"><h2>这里还没有任务</h2><p>可以先记下一件。</p></div>';
    for(const [label,items] of [['待处理',active],['稍后再出现',future]]){if(!items.length)continue;html+=`<h2 class="group-title">${label}</h2>`;for(const t of items){html+=`<article class="list-card"><div class="list-card-top"><div><h3>${esc(t.title)}</h3><div class="tags">${esc(meta(t))}${!eligible(t)?` · 下次 ${esc(formatDate(t.nextEligible))}`:''}</div></div></div><div class="list-card-actions"><button data-edit="${esc(t.id)}">编辑</button>${eligible(t)?`<button data-done="${esc(t.id)}">完成</button>`:''}<button class="danger" data-delete="${esc(t.id)}">删除</button></div></article>`;}}
    el.innerHTML=html;
    el.querySelectorAll('[data-edit]').forEach(b=>b.onclick=()=>openTask(b.dataset.edit));
    el.querySelectorAll('[data-done]').forEach(b=>b.onclick=()=>finish(b.dataset.done));
    el.querySelectorAll('[data-delete]').forEach(b=>b.onclick=()=>{const t=state.tasks.find(x=>x.id===b.dataset.delete);if(t&&confirm(`删除「${t.title}」？`)){state.tasks=state.tasks.filter(x=>x.id!==t.id);if(state.currentId===t.id)state.currentId=null;save();render();}});
  }
  function render(){renderHome();renderList();}
  function showList(on){$('homeView').classList.toggle('hidden',on);$('listView').classList.toggle('hidden',!on);window.scrollTo(0,0);if(on)renderList();}
  function openTask(id){editId=id||null;const t=state.tasks.find(x=>x.id===id);$('taskForm').reset();$('taskDialogTitle').textContent=t?'编辑任务':'记下一件事';$('taskTitle').value=t?.title||'';
    const urgency=t?.urgency||'soon';document.querySelector(`input[name=urgency][value=${urgency}]`).checked=true;
    const type=t?.repeat?'repeat':'once';document.querySelector(`input[name=taskType][value=${type}]`).checked=true;
    $('taskRepeat').value=t?.repeat||'daily';$('taskDeadline').value=t?.deadline||'';$('taskEnergy').value=t?.energy||'medium';$('taskDuration').value=t?.duration||'30';updateTaskFields();$('taskDialog').showModal();setTimeout(()=>$('taskTitle').focus(),80);}
  function updateTaskFields(){$('deadlineField').classList.toggle('hidden',document.querySelector('input[name=urgency]:checked').value!=='deadline');$('repeatField').classList.toggle('hidden',document.querySelector('input[name=taskType]:checked').value!=='repeat');}
  $('taskForm').onsubmit=e=>{e.preventDefault();const title=$('taskTitle').value.trim();if(!title){toast('先写下任务名称');$('taskTitle').focus();return;}
    const urgency=document.querySelector('input[name=urgency]:checked').value;const repeat=document.querySelector('input[name=taskType]:checked').value==='repeat'?$('taskRepeat').value:null;const deadline=urgency==='deadline'?$('taskDeadline').value:null;
    if(urgency==='deadline'&&!deadline){toast('请选择截止日期');return;}
    const t=state.tasks.find(x=>x.id===editId);
    if(t){Object.assign(t,{title,urgency,repeat,deadline,energy:$('taskEnergy').value,duration:Number($('taskDuration').value)});if(!repeat)t.nextEligible=null;}
    else state.tasks.push({id:uid(),title,urgency,repeat,deadline,energy:$('taskEnergy').value,duration:Number($('taskDuration').value),createdAt:new Date().toISOString(),waitingSince:new Date().toISOString(),nextEligible:null,skipCount:0});
    if(!state.currentId&&!state.resting)pick();save();$('taskDialog').close();render();toast(t?'任务已更新':'已记下，不用一直想着');};
  document.querySelectorAll('input[name=urgency],input[name=taskType]').forEach(el=>el.onchange=updateTaskFields);
  document.querySelectorAll('[data-close]').forEach(el=>el.onclick=() => $(el.dataset.close).close());
  $('openTasks').onclick=()=>showList(true);$('backHome').onclick=()=>showList(false);$('openAdd').onclick=()=>openTask();$('addFromList').onclick=()=>openTask();
  $('openCheckin').onclick=()=>{document.querySelector(`input[name=currentEnergy][value=${state.energy}]`).checked=true;document.querySelector(`input[name=currentDuration][value="${state.duration}"]`).checked=true;$('checkinDialog').showModal();};
  $('applyCheckin').onclick=()=>{state.energy=document.querySelector('input[name=currentEnergy]:checked').value;state.duration=Number(document.querySelector('input[name=currentDuration]:checked').value);pick();$('checkinDialog').close();render();};
  $('exportData').onclick=()=>{const blob=new Blob([JSON.stringify({app:'NextStep PWA',version:2,exportedAt:new Date().toISOString(),tasks:state.tasks},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`NextStep-backup-${formatDate(new Date())}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('备份文件已生成');};
  $('importData').onclick=()=>$('importFile').click();
  $('importFile').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{const obj=JSON.parse(await file.text());if(obj.app!=='NextStep PWA'||!Array.isArray(obj.tasks)||obj.tasks.length>10000||obj.tasks.some(t=>!t||typeof t.title!=='string'||typeof t.id!=='string'))throw Error('invalid');if(!confirm('恢复备份会替换当前所有任务，继续吗？'))return;state={...defaults(),tasks:obj.tasks};pick();save();render();toast('任务已恢复');}catch{toast('无法读取备份文件');}finally{e.target.value='';}};
  document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close();}));
  render();
  if('serviceWorker' in navigator && location.protocol==='https:')window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));
})();
