import {normalizeTelemetry,windDisplay,windUpdates} from './telemetry.mjs';
import {MqttReceiver} from '../receiver.mjs';
import {flattenTelemetry} from '../mqtt_core.mjs';
import {berthingAngle,unwrapAngle} from './geometry.js';
let windRotation=null,windMotion=true;
let selected=null,range=30,activeSensor='distance',displayMode='combined';
const liveMode=true;
let liveSource='MQTT';
const liveReadings={}, liveTimes={}, liveDistanceTimes=[0,0], liveHistory=[];
const liveKit={id:'MQTT-LIVE',name:'Bộ khoảng cách MQTT',status:'empty',values:[null,null],fresh:[false,false],minutes:[0,0]};
const kits=[liveKit];selected=liveKit;
function historyFor(kit,r){return liveHistory.filter(row=>Date.now()-row.time.getTime()<=r*60000);}
function environmentValues(){const out={};for(const key of ['windSpeed','windDirection','waterLevel','vesselSpeed','vesselHeading'])out[key]=Date.now()-(liveTimes[key]||0)<=180000?liveReadings[key]??null:null;return out;}
const $=s=>document.querySelector(s);
const labels={online:'Đang nhận dữ liệu',partial:'Cập nhật một phần',offline:'Mất cập nhật',empty:'Chưa có dữ liệu'};
const time=d=>d.toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:'Asia/Ho_Chi_Minh'});
const escapeText=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=v=>v==null?'—':v.toLocaleString('vi-VN',{minimumFractionDigits:1,maximumFractionDigits:1});
function renderList(){const picker=$('#kit-select');picker.replaceChildren();(liveMode?[liveKit]:kits).forEach(k=>picker.add(new Option(k.name+' · '+k.id+' · '+labels[k.status],k.id)));picker.value=selected.id;}

function render(){if(liveMode)selected=liveKit;renderEnvironment();renderSensorPage();renderList();renderDevices();renderDistanceVisual();$('#kit-name').textContent=selected.name;$('#kit-id').textContent=selected.id+' / Khoảng cách';$('#kit-status').textContent=labels[selected.status];$('#kit-status').className='badge '+selected.status;$('#stale-note').innerHTML=selected.status==='online'||selected.status==='empty'?'':`<div class="warning">${liveMode?'Thiếu số đo mới ở một hoặc cả hai cảm biến.':selected.status==='partial'?'Cảm biến 2 chưa cập nhật trong 12 phút.':'Cả hai cảm biến chưa cập nhật trong 38 phút.'} Đang hiển thị giá trị cuối.</div>`;$('#metrics').innerHTML=selected.values.map((v,i)=>`<article class="metric"><div class="metric-top"><span>Khoảng cách ${i+1}</span><span class="channel">CH 0${i+1}</span></div><div class="reading">${fmt(v)}<small>cm</small></div><div class="metric-footer"><span class="${selected.fresh[i]?'':'old'}"><i class="dot ${selected.fresh[i]?'':'amber'}"></i>${selected.status==='empty'?'Chưa có dữ liệu':selected.fresh[i]?'Dữ liệu mới':'Dữ liệu cũ'}</span><span>${selected.status==='empty'?'—':time(new Date(liveDistanceTimes[i]))}</span></div></article>`).join('');const rows=historyFor(selected,range);$('#chart-range').textContent=range===30?'30 phút gần nhất':range===60?'1 giờ gần nhất':'24 giờ gần nhất';drawChart(rows);renderHistorySelector();$('#history-count').textContent=Math.min(rows.length,6)+' bản tin';$('#history').innerHTML=rows.slice(-6).reverse().map(r=>`<tr><td>${time(r.time)}</td><td>${fmt(r.values[0])} cm</td><td>${r.values[1]===null?'—':fmt(r.values[1])+' cm'}</td><td><i class="dot ${r.values[1]===null?'amber':''}"></i>${r.values[1]===null?'Thiếu kênh 2':liveSource}</td></tr>`).join('')||'<tr><td colspan="4">Chưa có dữ liệu đo.</td></tr>';}
function renderHistorySelector(){}
function drawChart(rows){if(!rows.length){$('#chart').innerHTML='<p class="empty">Chưa có dữ liệu đo.</p>';return;}const all=rows.flatMap(r=>r.values).filter(v=>v!==null);if(!all.length){$('#chart').innerHTML='<p class="empty">Chưa có dữ liệu.</p>';return;}const low=Math.max(0,Math.floor((Math.min(...all)-4)/5)*5),high=Math.ceil((Math.max(...all)+4)/5)*5;const x=i=>46+i*650/Math.max(1,rows.length-1),y=v=>164-(v-low)/(high-low)*140;let svg='';for(let i=0;i<5;i++){const v=low+(high-low)*i/4;svg+=`<line x1="46" y1="${y(v)}" x2="696" y2="${y(v)}" stroke="#2a394a" stroke-dasharray="3 5"/><text x="34" y="${y(v)+4}" text-anchor="end" font-size="10" fill="#91a3b7">${Math.round(v)}</text>`;}for(let c=0;c<2;c++){let points=rows.map((r,i)=>r.values[c]===null?null:`${x(i)},${y(r.values[c])}`).filter(Boolean);if(points.length)svg+=`<polyline points="${points.join(' ')}" fill="none" stroke="${c===0?'#57ddb6':'#f1b268'}" stroke-width="2.4" ${c===1?'stroke-dasharray="6 5"':''}/>`;}[0,3,6,9,12].filter(i=>i<rows.length).forEach(i=>svg+=`<text x="${x(i)}" y="195" text-anchor="middle" font-size="10" fill="#91a3b7">${time(rows[i].time).slice(0,5)}</text>`);$('#chart').innerHTML=`<svg viewBox="0 0 730 210" role="img" aria-label="Biểu đồ khoảng cách của ${selected.name}. Bảng bên dưới cung cấp số đo.">${svg}</svg>`;}
$('#kit-select').addEventListener('change',()=>{selected=kits.find(k=>k.id===$('#kit-select').value);render();});
document.querySelectorAll('[data-range]').forEach(b=>b.addEventListener('click',()=>{range=Number(b.dataset.range);document.querySelectorAll('[data-range]').forEach(x=>x.classList.toggle('chosen',x===b));render();}));
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-view]').forEach(x=>x.classList.toggle('active',x===b));document.body.classList.remove('overview-view','devices-view','history-view');document.body.classList.add(b.dataset.view+'-view');const title={overview:'Giám sát cập bến',devices:'Thiết bị',history:'Lịch sử đo'}[b.dataset.view];$('#page-title').textContent=title;$('#crumb').textContent=b.textContent.trim();render();}));
$('#export').textContent='↓ Xuất CSV';
$('#export').addEventListener('click',()=>{const csv='\uFEFFBộ,Cảm biến 1 (cm),Cảm biến 2 (cm),Thời điểm\n'+historyFor(selected,range).map(r=>[selected.id,r.values[0],r.values[1]??'',r.time.toISOString()].join(',')).join('\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=selected.id+'-du-lieu.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#toast').textContent='Đã xuất dữ liệu của '+selected.name;$('#toast').style.display='block';setTimeout(()=>$('#toast').style.display='none',3000);});
render();

function renderDistanceVisual(){if(selected.status==='empty'){$('#berth-angle').textContent='—';$('#angle-state').textContent='Chưa có dữ liệu đo.';$('#distance-visual').innerHTML='<p class="empty">Chờ dữ liệu từ thiết bị.</p>';return;}
 const spacing=Number($('#sensor-spacing').value)*100;
 const result=berthingAngle(selected.values[0],selected.values[1],spacing,selected.fresh.every(Boolean));
 const angleText=result===null?'—':Math.abs(result).toLocaleString('vi-VN',{minimumFractionDigits:2,maximumFractionDigits:2})+'°';
 $('#berth-angle').textContent=angleText;
 $('#angle-state').textContent=!Number.isFinite(spacing)||spacing<=0?'Nhập khoảng cách hai IoT để tính góc.':result===null?'Chưa đủ hai số đo mới để tính góc.':result===0?'Thân tàu song song với bến.':selected.values[0]<selected.values[1]?'Phía IoT 1 gần bến hơn.':'Phía IoT 2 gần bến hơn.';
 const tilt=result===null?0:-result;
 // Uniform scale keeps the two parallel measurement rays and hull angle consistent.
 const span=400, dockY=385;
 const scale=Number.isFinite(spacing)&&spacing>0?span/spacing:0;
 const distances=selected.values.map(v=>v*scale);
 const y1=dockY-distances[0], y2=result===null?y1:dockY-distances[1];
 if(liveMode&&(!selected.fresh[0]||!selected.fresh[1])){$('#distance-visual').innerHTML='<p class="empty">Chờ đủ hai số đo mới để hiển thị vị trí tàu và góc lệch.</p>';return;}
 if(!Number.isFinite(y1)||y1<115||y1>385||y2<115||y2>385){$('#distance-visual').innerHTML='<div class="scene-unavailable">Khoảng cách vượt phạm vi cảnh.<br><span>Điều chỉnh khoảng cách hai IoT để xem mô phỏng.</span></div>';return;}
 const colors=['#55b9ff','#47dfb0'];
 const beams=[y1,y2].map((y,i)=>{const x=260+i*400,c=colors[i];return `<path d="M${x} ${y}V${dockY}" stroke="${c}" stroke-width="22" opacity=".08"/><path d="M${x} ${y}V${dockY}" stroke="${c}" stroke-width="2" stroke-dasharray="5 6"/><circle cx="${x}" cy="${y}" r="6" fill="${c}" stroke="#102c39" stroke-width="3"/><path d="M${x-5} ${y+13}l5-8 5 8M${x-5} ${dockY-13}l5 8 5-8" fill="none" stroke="${c}" stroke-width="2"/><g transform="translate(${x+14} ${(y+dockY)/2-18})"><rect width="132" height="43" rx="6" fill="#0b2434" stroke="${c}" stroke-opacity=".45"/><text x="12" y="17" fill="#a4bac8" font-size="10">DISTANCE / 0${i+1}</text><text x="12" y="34" fill="${c}" font-size="17" font-weight="600">${fmt(selected.values[i]/100)} <tspan font-size="11">m</tspan></text></g><g transform="translate(${x} ${dockY})"><circle r="15" fill="#132a35" stroke="${c}" stroke-width="2"/><circle r="5" fill="${c}"/><text y="35" text-anchor="middle" fill="#e4edf4" font-size="13" font-weight="600">IoT ${i+1}</text></g>`;}).join('');
 const r=105, rad=tilt*Math.PI/180;
 const angle=result===null?'':`<path d="M260 ${y1}H${tilt>0?460:490}" stroke="#e6c47c" stroke-dasharray="4 5" opacity=".75"/><path d="M365 ${y1}A105 105 0 0 ${tilt>=0?1:0} ${260+r*Math.cos(rad)} ${y1+r*Math.sin(rad)}" fill="none" stroke="#ffd17f" stroke-width="3"/><g transform="translate(380 ${y1+(tilt>0?-42:12)})"><rect width="94" height="30" rx="5" fill="#302a20" stroke="#d4b575" stroke-opacity=".55"/><text x="47" y="20" text-anchor="middle" font-size="15" fill="#ffd17f">θ ${angleText}</text></g>`;
 const fenders=[175,260,345,430,515,600,685,770].map(x=>`<rect x="${x}" y="373" width="25" height="12" rx="3" fill="#0b1822" stroke="#72818a"/><circle cx="${x+12}" cy="427" r="4" fill="#a1a5a6"/>`).join('');
 const containers=Array.from({length:8},(_,i)=>`<rect x="${310+i*39}" y="${y1-61}" width="32" height="42" rx="2" fill="${i%3===0?'#a66f50':i%3===1?'#567985':'#778776'}" stroke="#d1d7d2" stroke-opacity=".25"/><path d="M${317+i*39} ${y1-57}v34m8-34v34m8-34v34" stroke="#152c36" opacity=".4"/>`).join('');
 $('#distance-visual').innerHTML=`<svg class="harbor-scene" viewBox="0 110 900 370" role="img" aria-label="${escapeText(selected.name)}: góc lệch ${angleText}, IoT 1 ${fmt(selected.values[0]/100)} mét, IoT 2 ${fmt(selected.values[1]/100)} mét"><defs><pattern id="sea-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#7297ac" stroke-opacity=".09"/></pattern><linearGradient id="sea" x2="1" y2="1"><stop stop-color="#163e51"/><stop offset="1" stop-color="#0e293b"/></linearGradient><linearGradient id="hull" x2="0" y2="1"><stop stop-color="#cedad9"/><stop offset="1" stop-color="#819a9f"/></linearGradient><pattern id="quay" width="38" height="24" patternUnits="userSpaceOnUse"><rect width="38" height="24" fill="#647078"/><path d="M38 0H0V24" stroke="#53626d" fill="none"/></pattern></defs><rect width="900" height="480" fill="url(#sea)"/><rect width="900" height="480" fill="url(#sea-grid)"/><path d="M0 85Q95 70 170 85T340 85T510 85T680 85T900 85M0 165Q95 150 170 165T340 165T510 165T680 165T900 165" stroke="#70a7b9" stroke-opacity=".08" fill="none"/><g fill="#91abb9" font-size="10" letter-spacing="2"><text x="24" y="138">BERTH 01 / ${selected.id}</text><text x="24" y="159" fill="#e4eef3" font-size="13" letter-spacing="0">Khu vực cập bến</text></g><g transform="translate(839 143)" stroke="#98b4c4" fill="none"><path d="M0 38V0m-5 9 5-9 5 9"/><text x="0" y="-7" fill="#becfd8" stroke="none" font-size="10" text-anchor="middle">N</text></g><rect y="385" width="900" height="95" fill="url(#quay)"/><path d="M0 386H900" stroke="#dfd8ad" stroke-width="4"/><path d="M0 452H900" stroke="#c3c6bf" stroke-dasharray="24 14" stroke-width="2" opacity=".5"/>${fenders}<text x="26" y="428" fill="#e9edec" font-size="11" letter-spacing="2">CẦU BẾN</text><g transform="rotate(${tilt} 260 ${y1})"><path d="M166 ${y1-75}H725Q785 ${y1-65} 814 ${y1-39}Q785 ${y1-9} 725 ${y1+1}H166Z" fill="#061b28" opacity=".35" transform="translate(5 8)"/><path d="M164 ${y1-80}H724Q779 ${y1-70} 812 ${y1-40}Q780 ${y1-8} 724 ${y1}H164Q151 ${y1-40} 164 ${y1-80}Z" fill="url(#hull)" stroke="#d9e6e6" stroke-width="1.5"/><path d="M179 ${y1-70}H720Q761 ${y1-63} 791 ${y1-40}Q761 ${y1-16} 720 ${y1-10}H179Z" fill="#294854" stroke="#698894"/>${containers}<rect x="205" y="${y1-68}" width="62" height="55" rx="5" fill="#c9d5d6"/><rect x="218" y="${y1-61}" width="35" height="18" rx="3" fill="#4e778e"/><path d="M220 ${y1-52}h31" stroke="#b6dbe3"/><rect x="221" y="${y1-35}" width="29" height="14" rx="2" fill="#839ca5"/><path d="M745 ${y1-40}h27m-12-9 12 9-12 9" stroke="#b4cbd1" fill="none"/><text x="459" y="${y1-92}" text-anchor="middle" fill="#c9e0ec" font-size="11" letter-spacing="3">THÂN TÀU</text></g>${beams}${angle}<g transform="translate(749 445)"><path d="M0 5h100M0 0v10M100 0v10" stroke="#e4e9e9"/><text x="50" y="25" text-anchor="middle" fill="#e4e9e9" font-size="10">${Number.isFinite(spacing)?fmt(spacing/100):'—'} m</text></g></svg>`;

}

$('#sensor-spacing').addEventListener('input',renderDistanceVisual);

function renderDevices(){
 $('#device-total').textContent=kits.length+' bộ';
 $('#device-rows').innerHTML=kits.map(k=>`<tr><td>${escapeText(k.name)}</td><td>${k.id}</td><td><span class="badge ${k.status}">${labels[k.status]}</span></td><td><button class="button" data-open-kit="${k.id}">Xem bộ</button></td></tr>`).join('');
}
$('#device-rows').addEventListener('click',e=>{const b=e.target.closest('[data-open-kit]');if(!b)return;selected=kits.find(k=>k.id===b.dataset.openKit);document.querySelector('[data-view="overview"]').click();});

function renderEnvironment(){
 const d=environmentValues();
 const gauge=(value,max,color,unit)=>{const ratio=value==null?0:Math.min(1,Math.max(0,value/max));const reading=value==null?'—':value.toLocaleString('vi-VN',{minimumFractionDigits:max===1?2:1,maximumFractionDigits:max===1?2:1});return `<svg viewBox="0 0 180 112" role="img" aria-label="${reading} ${unit}"><path d="M25 87A65 65 0 0 1 155 87" fill="none" stroke="#3c444c" stroke-width="9" stroke-linecap="round"/><path d="M25 87A65 65 0 0 1 155 87" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" pathLength="100" stroke-dasharray="${ratio*100} 100"/><text x="90" y="77" text-anchor="middle" fill="#eef2f5" font-size="29" font-weight="600">${reading}</text><text x="90" y="99" text-anchor="middle" fill="#a9b5c1" font-size="11">${unit}</text><text x="19" y="108" fill="#798898" font-size="9">0</text><text x="158" y="108" fill="#798898" font-size="9">${max}</text></svg>`;};
 const compass=`<svg viewBox="0 0 180 112" role="img" aria-label="Hướng gió ${d.windDirection} độ"><circle cx="90" cy="56" r="40" fill="#20272e" stroke="#4a5662"/><circle cx="90" cy="56" r="32" fill="none" stroke="#607180" stroke-dasharray="1 7"/><g fill="#a6b5c2" font-size="10" text-anchor="middle"><text x="90" y="11">B</text><text x="90" y="109">N</text><text x="43" y="60">T</text><text x="137" y="60">Đ</text></g><g transform="rotate(${d.windDirection} 90 56)"><path d="M90 24L99 62 90 57 81 62Z" fill="#55b9ff"/><path d="M90 88L81 62 90 57 99 62Z" fill="#526271"/></g><circle cx="90" cy="56" r="4" fill="#dcecf8"/></svg>`;
 const water=`<svg viewBox="0 0 180 112" role="img" aria-label="Mực nước ${fmt(d.waterLevel)} mét"><defs><clipPath id="water-tank"><rect x="23" y="12" width="52" height="88" rx="6"/></clipPath></defs><rect x="23" y="12" width="52" height="88" rx="6" fill="#192730" stroke="#496276"/><g clip-path="url(#water-tank)"><path d="M23 50q13-8 26 0t26 0v50H23Z" fill="#2587c2" opacity=".65"/><path d="M23 50q13-8 26 0t26 0" fill="none" stroke="#6dceff" stroke-width="2"/></g><path d="M77 22h9M77 42h6M77 62h9M77 82h6" stroke="#8295a4"/><text x="99" y="62" fill="#eaf3f7" font-size="25" font-weight="600">${d.waterLevel==null?'—':d.waterLevel.toLocaleString('vi-VN',{minimumFractionDigits:2})}</text><text x="101" y="84" fill="#a9b5c1" font-size="11">m</text></svg>`;
 $('#environment').innerHTML=`<article class="environment-card"><div class="environment-title">Tốc độ gió<span>WIND</span></div>${gauge(d.windSpeed,20,'#55b9ff','m/s')}<div class="environment-caption">Gió tại bến</div></article><article class="environment-card"><div class="environment-title">Hướng gió<span>${d.windDirection}°</span></div>${compass}<div class="environment-caption">${d.windDirection==null?'—':fmt(d.windDirection)+'°'}</div></article><article class="environment-card"><div class="environment-title">Mực nước<span>LEVEL</span></div>${water}<div class="environment-caption">Trạm đo tại bến</div></article><article class="environment-card"><div class="environment-title">Vận tốc tàu<span>VESSEL</span></div>${gauge(d.vesselSpeed,1,'#47dfb0','m/s')}<div class="environment-caption">${d.vesselHeading==null?'Chưa có hướng tàu':'Hướng tàu '+fmt(d.vesselHeading)+'°'}</div></article><div class="environment-source"><i class="dot"></i>Trạm môi trường · Dữ liệu MQTT</div>`;
}


function renderWindPage(page){
 const view=windDisplay(liveReadings,liveTimes,Date.now());
 // Keep the SVG in the DOM: telemetry updates must not restart its animation.
 if(!page.querySelector('.wind-dashboard')){
  const ticks=Array.from({length:72},(_,i)=>`<line x1="240" y1="${i%6===0?66:72}" x2="240" y2="${i%6===0?80:77}" transform="rotate(${i*5} 240 240)" class="${i%6===0?'major':'minor'}"/>`).join('');
  const streams=Array.from({length:7},(_,i)=>`<path class="wind-stream" style="--delay:${-i*.7}s" d="M70 ${150+i*30}h${105+i%3*40}"/>`).join('');
  page.innerHTML=`<div class="wind-dashboard">
   <header class="wind-header"><div><div class="wind-eyebrow">TRẠM GIÓ / LIVE TELEMETRY</div><h2>Tốc độ & hướng gió</h2><p>Hai cảm biến. Một bộ dữ liệu.</p></div><span class="wind-status" role="status" id="wind-status"></span></header>
   <div class="wind-layout"><div class="wind-readings">
    <article class="wind-metric"><div class="wind-metric-top"><span>Tốc độ gió</span><span class="wind-channel">ES-WS-02</span></div><div class="wind-value"><strong id="wind-speed">—</strong><span>m/s</span></div><p class="wind-secondary" id="wind-kmh">Chờ số đo tốc độ</p><div class="wind-field-status" id="wind-speed-status"></div></article>
    <article class="wind-metric direction"><div class="wind-metric-top"><span>Hướng gió</span><span class="wind-channel">ES-WS-04</span></div><div class="wind-value"><strong id="wind-angle">—</strong><span>°</span></div><p class="wind-secondary" id="wind-heading">Chờ hướng gió</p><div class="wind-field-status" id="wind-direction-status"></div></article>
    <div class="wind-source"><span>Nguồn dữ liệu</span><strong id="wind-source"></strong><p>Số đo quá 10 giây sẽ ngừng hiển thị. Luồng gió là minh hoạ, không phải dự báo.</p></div>
   </div><figure class="wind-visual">
    <div class="wind-visual-top"><span>LA BÀN GIÓ</span><button type="button" id="wind-motion-toggle" aria-pressed="false">Tắt hiệu ứng</button></div>
    <svg class="wind-compass" viewBox="0 0 480 480" role="img" aria-labelledby="wind-svg-title"><title id="wind-svg-title">Chờ dữ liệu gió</title>
     <defs><radialGradient id="wind-sea"><stop stop-color="#173c4c"/><stop offset="1" stop-color="#0c202d"/></radialGradient><clipPath id="wind-flow-clip"><circle cx="240" cy="240" r="151"/></clipPath></defs>
     <circle class="wind-outer-ring" cx="240" cy="240" r="207"/><circle cx="240" cy="240" r="180" fill="url(#wind-sea)"/>
     <g class="wind-grid"><circle cx="240" cy="240" r="120"/><circle cx="240" cy="240" r="60"/><path d="M60 240h360M240 60v360"/></g>
     <g class="wind-ticks">${ticks}</g>
     <g clip-path="url(#wind-flow-clip)"><g id="wind-flow-rotation">${streams}</g></g>
     <g class="wind-cardinals" text-anchor="middle"><text x="240" y="40">B</text><text x="442" y="247">Đ</text><text x="240" y="453">N</text><text x="38" y="247">T</text></g>
     <g class="wind-diagonals" text-anchor="middle"><text x="384" y="103">ĐB</text><text x="384" y="388">ĐN</text><text x="96" y="388">TN</text><text x="96" y="103">TB</text></g>
     <g id="wind-needle"><path d="M240 99L263 243 240 227 217 243Z" class="wind-needle-head"/><path d="M240 351L217 243 240 253 263 243Z" class="wind-needle-tail"/></g>
     <circle cx="240" cy="240" r="14" class="wind-pivot"/><circle cx="240" cy="240" r="5" fill="#0c202d"/>
    </svg><figcaption><strong id="wind-scene-caption">Chờ dữ liệu cảm biến</strong><span>Bắc = 0° · góc tăng theo chiều kim đồng hồ</span></figcaption>
   </figure></div><div class="wind-footnote"><span id="wind-pair-note"></span><span>RS485 · MQTT</span></div>
  </div>`;
  page.querySelector('#wind-motion-toggle').addEventListener('click',()=>{windMotion=!windMotion;renderWindPage(page);});
 }
 const set=(id,text)=>{page.querySelector('#'+id).textContent=text;};
 set('wind-speed',fmt(view.speed));set('wind-angle',fmt(view.angle));set('wind-heading',view.heading);
 set('wind-kmh',view.speed===null?'Chờ số đo tốc độ':`${fmt(view.kmh)} km/h${view.speed===0?' · Lặng gió':''}`);
 set('wind-source',liveSource==='JSON'?'JSON kiểm thử · không phải MQTT':'IoT / MQTT');
 for(const [key,id,value] of [['windSpeed','wind-speed-status',view.speed],['windDirection','wind-direction-status',view.angle]]){
  set(id,value===null?'Chưa có số đo mới':`Cập nhật ${time(new Date(liveTimes[key]))}`);
  page.querySelector('#'+id).classList.toggle('unavailable',value===null);
 }
 set('wind-status',view.state==='complete'?'Đủ hai số đo':view.state==='partial'?'Thiếu một số đo':'Chờ dữ liệu');
 page.querySelector('#wind-status').dataset.state=view.state;
 set('wind-pair-note',view.state==='complete'?'Đang hiển thị đồng thời tốc độ và hướng gió.':'Kiểm tra nguồn cảm biến và topic nếu chưa nhận đủ hai số đo.');
 set('wind-scene-caption',view.angle===null?'Chờ hướng gió':`${view.heading} · ${fmt(view.angle)}°`);
 set('wind-svg-title',`Hướng gió ${view.angle===null?'chưa có dữ liệu':fmt(view.angle)+' độ'}, tốc độ ${view.speed===null?'chưa có dữ liệu':fmt(view.speed)+' mét trên giây'}`);
 const needle=page.querySelector('#wind-needle');
 needle.style.visibility=view.angle===null?'hidden':'visible';
 windRotation=unwrapAngle(windRotation,view.angle);
 needle.style.transform=`rotate(${windRotation??0}deg)`;
 page.querySelector('#wind-flow-rotation').style.transform=`rotate(${(windRotation??0)+90}deg)`;
 const scene=page.querySelector('.wind-visual');
 scene.style.setProperty('--wind-duration',view.duration+'s');
 scene.classList.toggle('is-moving',view.moving&&windMotion);
 set('wind-motion-toggle',windMotion?'Tắt hiệu ứng':'Bật hiệu ứng');
 page.querySelector('#wind-motion-toggle').setAttribute('aria-pressed',String(!windMotion));
}

function renderSensorPage(){
 const sensorNames={'distance':'Khoảng cách',wind:'Gió · Tốc độ & hướng','wind-speed':'Tốc độ gió','wind-direction':'Hướng gió','water':'Mực nước','vessel-speed':'Vận tốc tàu'};
 // Sensor tests are independent of the distance kits.
 const types=['wind-speed','wind-direction','water','vessel-speed'];
 const index=types.indexOf(activeSensor),page=$('#single-sensor');
 document.body.classList.remove('readings-mode');
 page.hidden=activeSensor==='distance';
 if(!document.body.classList.contains('devices-view')&&!document.body.classList.contains('history-view'))$('#page-title').textContent=activeSensor==='distance'?'Giám sát cập bến':'Test '+sensorNames[activeSensor].toLowerCase();
 document.body.classList.toggle('single-sensor-view',activeSensor!=='distance');
 if(activeSensor==='wind'){renderWindPage(page);return;}
 if(index<0)return;
 const card=$('#environment').children[index].cloneNode(true);
 if(liveMode&&environmentValues()[['windSpeed','windDirection','waterLevel','vesselSpeed'][index]]==null)card.innerHTML='<p class="empty">Chưa có số đo mới cho cảm biến này.</p>';
 page.replaceChildren();
 const header=document.createElement('div');header.className='sensor-page-header';
 const name=document.createElement('h2');name.textContent='Test '+sensorNames[activeSensor].toLowerCase();
 const badge=document.createElement('span');badge.className='demo';badge.textContent=liveMode?(liveSource==='JSON'?'TEST JSON':'DỮ LIỆU IoT'):'DỮ LIỆU MẪU';
 header.append(name,badge);page.append(header);
 
 const d=environmentValues();
 const data={
 'wind-speed':{value:d.windSpeed,unit:'m/s',digits:1,label:'Tốc độ gió',extra:'Gió tại bến'},
 'wind-direction':{value:d.windDirection,unit:'°',digits:1,label:'Hướng gió',extra:d.windDirection==null?'Chờ dữ liệu':fmt(d.windDirection)+'°'},
 water:{value:d.waterLevel,unit:'m',digits:2,label:'Mực nước',extra:'Trạm đo tại bến'},
 'vessel-speed':{value:d.vesselSpeed,unit:'m/s',digits:2,label:'Vận tốc tàu',extra:d.vesselHeading==null?'Chưa có hướng tàu':'Hướng tàu: '+fmt(d.vesselHeading)+'°'}
 }[activeSensor];
 const numeric=document.createElement('div');numeric.className='sensor-numeric';
 numeric.innerHTML=`<div class="numeric-label">${data.label}</div><div class="numeric-value">${data.value==null?'—':data.value.toLocaleString('vi-VN',{minimumFractionDigits:data.digits,maximumFractionDigits:data.digits})}<span>${data.unit}</span></div><div class="numeric-detail">${data.extra}</div><dl class="sensor-metadata"><div><dt>Cập nhật lúc</dt><dd>${liveMode?(liveTimes[{'wind-speed':'windSpeed','wind-direction':'windDirection',water:'waterLevel','vessel-speed':'vesselSpeed'}[activeSensor]]?time(new Date(liveTimes[{'wind-speed':'windSpeed','wind-direction':'windDirection',water:'waterLevel','vessel-speed':'vesselSpeed'}[activeSensor]])): '—'):time(referenceTime)}</dd></div><div><dt>Nguồn dữ liệu</dt><dd>${liveMode?(liveSource==='JSON'?'JSON trực tiếp':'IoT / MQTT'):'Mô phỏng'}</dd></div></dl>`;
 const content=document.createElement('div');content.className='sensor-combined';content.append(numeric,card);page.append(content);
}
document.querySelectorAll('[data-sensor]').forEach(button=>button.addEventListener('click',()=>{
 activeSensor=button.dataset.sensor;
 document.querySelectorAll('[data-sensor]').forEach(b=>b.setAttribute('aria-selected',String(b===button)));
 renderSensorPage();
 history.replaceState(null,'','#test/'+activeSensor);
 document.title='Harbor Lab · '+sensorNamesForTitle(activeSensor);
}));
const initialSensor=location.hash.replace('#test/','');
const initialTab=['wind-speed','wind-direction'].includes(initialSensor)?'wind':initialSensor;
if(['wind','water','vessel-speed'].includes(initialTab))document.querySelector('[data-sensor="'+initialTab+'"]').click();

function sensorNamesForTitle(type){return {distance:"Khoảng cách",wind:"Gió · Tốc độ & hướng","wind-speed":"Tốc độ gió","wind-direction":"Hướng gió",water:"Mực nước","vessel-speed":"Vận tốc tàu"}[type];}

document.querySelectorAll('[data-display]').forEach(button=>button.addEventListener('click',()=>{
 displayMode=button.dataset.display;
 document.querySelectorAll('[data-display]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));
 renderSensorPage();
}));

function refreshLive(){
 liveKit.fresh=liveDistanceTimes.map(t=>t>0&&Date.now()-t<=180000);
 liveKit.minutes=liveDistanceTimes.map(t=>t?Math.floor((Date.now()-t)/60000):0);
 liveKit.status=liveKit.fresh.every(Boolean)?'online':liveKit.fresh.some(Boolean)?'partial':liveKit.values.every(v=>v===null)?'empty':'offline';
}
function acceptTelemetry(item){
 recordRaw(item);
 const parsed=normalizeTelemetry(item.payload,{distanceUnit:$('#distance-unit').value});
 const timestamp=item.received_ms||Date.now();
 
 const isSecond=$('#mqtt-topic2').value.trim()&&item.topic===$('#mqtt-topic2').value.trim();
 for(const [key,value] of Object.entries(parsed.values)){
  if(key==='distance1'||key==='distance2'){
   const channel=key==='distance2'||isSecond?1:0;liveKit.values[channel]=value;liveDistanceTimes[channel]=item.retained?0:timestamp-parsed.ageMs;
  }else {liveReadings[key]=value;liveTimes[key]=item.retained?0:timestamp-parsed.ageMs;}
 }
 for(const [key,update] of Object.entries(windUpdates(parsed,timestamp,item.retained))){liveReadings[key]=update.value;liveTimes[key]=update.time;}
 if(parsed.values.bowSpeed!==undefined){liveReadings.vesselSpeed=parsed.values.bowSpeed;liveTimes.vesselSpeed=item.retained?0:timestamp-parsed.ageMs;}
 // An invalid sample invalidates the relevant sensor rather than keeping it green.
 if(!parsed.valid){if(parsed.sensor==='TF03')liveDistanceTimes[isSecond?1:0]=0;if(parsed.sensor==='ES-WS-04')liveTimes.windDirection=0;}
 if('distance1' in parsed.values||'distance2' in parsed.values){liveHistory.push({time:new Date(timestamp),values:[...liveKit.values]});if(liveHistory.length>500)liveHistory.shift();}
 refreshLive();render();
 if(!Object.keys(parsed.values).length)$('#connection-error').textContent='Bản tin đã nhận nhưng chưa có số đo hợp lệ được hỗ trợ.';
}

const rawMessages=[];
function recordRaw(item){
 rawMessages.push(item);if(rawMessages.length>200)rawMessages.shift();
 let data;try{data=JSON.parse(item.payload);}catch{data=item.payload;}
 $('#raw-message').textContent=JSON.stringify({topic:item.topic,receivedAt:new Date(item.received_ms).toISOString(),retained:item.retained||false,payload:data},null,2);
 $('#message-count').textContent=rawMessages.length+' bản tin';
 $('#all-fields').innerHTML='<table><thead><tr><th>Trường</th><th>Giá trị</th></tr></thead><tbody>'+flattenTelemetry(data).map(r=>'<tr><td>'+escapeText(r.path)+'</td><td>'+escapeText(typeof r.value==='object'?JSON.stringify(r.value):r.value)+'</td></tr>').join('')+'</tbody></table>';
 $('#raw-history').innerHTML='<table><thead><tr><th>Giờ</th><th>Topic</th><th>Payload</th></tr></thead><tbody>'+rawMessages.slice().reverse().map(m=>'<tr><td>'+time(new Date(m.received_ms))+'</td><td>'+escapeText(m.topic)+'</td><td>'+escapeText(m.payload)+'</td></tr>').join('')+'</tbody></table>';
}
function resetReadings(){
 windRotation=null;
 for(const key of Object.keys(liveTimes))delete liveTimes[key];
 for(const key of Object.keys(liveReadings))delete liveReadings[key];
 liveDistanceTimes.fill(0);liveKit.values=[null,null];liveHistory.length=0;
 rawMessages.length=0;$('#raw-message').textContent='Chờ bản tin MQTT.';$('#all-fields').replaceChildren();$('#raw-history').replaceChildren();$('#message-count').textContent='0 bản tin';
 refreshLive();render();
}
const receiver=new MqttReceiver({
 onState(status,error=''){
  $('#live-state').textContent={connected:'MQTT đã kết nối · chờ bản tin',connecting:'Đang kết nối MQTT…',disconnected:'Đã dừng / chưa kết nối',error:'Lỗi kết nối'}[status];
  $('#connection-error').textContent=error;
  for(const id of ['broker','mqtt-topic','mqtt-topic2','distance-unit'])$('#'+id).disabled=['connected','connecting'].includes(status);
 },
 onMessage(item){$('#connection-error').textContent='';try{acceptTelemetry(item);$('#live-state').textContent='Đã nhận · '+time(new Date(item.received_ms));}catch(e){$('#connection-error').textContent='Đã nhận bản tin, nhưng không ánh xạ được số đo: '+e.message;}}
});
$('#mqtt-form').addEventListener('submit',e=>{
 e.preventDefault();
 try{receiver.connect($('#broker').value,[$('#mqtt-topic').value.trim(),$('#mqtt-topic2').value.trim()].filter(Boolean));liveSource='MQTT';resetReadings();document.querySelector('.app-header .demo').textContent='DỮ LIỆU IoT';}
 catch(e){$('#connection-error').textContent=e.message;}
});
$('#stop-mqtt').addEventListener('click',()=>receiver.stop());
$('#apply-json').addEventListener('click',()=>{
 receiver.stop();resetReadings();liveSource='JSON';document.querySelector('.app-header .demo').textContent='TEST JSON · KHÔNG PHẢI MQTT';
 try{acceptTelemetry({payload:$('#json-payload').value,topic:$('#mqtt-topic').value,received_ms:Date.now()});$('#live-state').textContent='Test JSON trực tiếp';}
 catch(e){$('#connection-error').textContent=e.message;}
});
const brokerParam=new URLSearchParams(location.search).get('broker');
if(['emqx','mosquitto'].includes(brokerParam))$('#broker').value=brokerParam;
setInterval(()=>{refreshLive();render();},5000);
window.addEventListener('pagehide',()=>receiver.stop());
refreshLive();render();
