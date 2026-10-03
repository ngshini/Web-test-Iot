const directions=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
const windHeadings=['Bắc','Bắc Đông Bắc','Đông Bắc','Đông Đông Bắc','Đông','Đông Đông Nam','Đông Nam','Nam Đông Nam','Nam','Nam Tây Nam','Tây Nam','Tây Tây Nam','Tây','Tây Tây Bắc','Tây Bắc','Bắc Tây Bắc'];

export function windDisplay(readings,times,now){
 const fresh=key=>times[key]>0&&now>=times[key]&&now-times[key]<=10000&&Number.isFinite(readings[key]);
 const speed=fresh('windSpeed')&&readings.windSpeed>=0?readings.windSpeed:null;
 const angle=fresh('windDirection')&&readings.windDirection>=0&&readings.windDirection<=360?readings.windDirection:null;
 const complete=speed!==null&&angle!==null;
 return {speed,angle,kmh:speed===null?null:speed*3.6,
  heading:angle===null?'Chờ hướng gió':windHeadings[Math.round(angle/22.5)%16],
  state:complete?'complete':speed!==null||angle!==null?'partial':'empty',
  moving:complete&&speed>0,duration:speed===null||speed===0?6:Math.max(.6,6/(1+Math.min(speed,40)/2))};
}

// Explicit nulls/errors must clear an old reading, not leave it looking live.
export function windUpdates(parsed,timestamp,retained){
 const p=parsed.raw,updates={};
 for(const [key,statusKey,ageKey] of [['windSpeed','speed_status','speed_age_ms'],['windDirection','direction_status','direction_age_ms']]){
  const relevant=Object.hasOwn(p,key)||(key==='windSpeed'&&(Object.hasOwn(p,'speed_mps')||parsed.sensor==='ES-WS-02'))||(key==='windDirection'&&parsed.sensor==='ES-WS-04');
  if(!relevant)continue;
  const value=parsed.values[key]??null;
  const ok=parsed.valid&&(p[statusKey]===undefined||p[statusKey]==='ok')&&value!==null;
  const age=Number.isFinite(p[ageKey])&&p[ageKey]>=0?p[ageKey]:parsed.ageMs;
  updates[key]={value:ok?value:null,time:ok&&!retained?timestamp-age:0};
 }
 return updates;
}
export function normalizeTelemetry(payload,{distanceUnit='m'}={}){
 const p=typeof payload==='string'?JSON.parse(payload):payload;
 if(!p||typeof p!=='object'||Array.isArray(p))throw Error('Payload phải là JSON object');
 const number=(key)=>{if(p[key]===null||p[key]===undefined)return null;if(typeof p[key]!=='number'||!Number.isFinite(p[key]))throw Error(key+' phải là số hoặc null');return p[key];};
 const valid=p.status===undefined||p.status==='ok';
 const values={}; const put=(key,value)=>{if(value!==null&&valid)values[key]=value;};
 const has=k=>Object.hasOwn(p,k);
 if(has('distance')||has('bowDistance')||has('sternDistance')){
  const unit=p.unit||distanceUnit;if(!['m','cm','mm'].includes(unit))throw Error('Đơn vị khoảng cách không hỗ trợ');
  const factor={m:100,cm:1,mm:.1}[unit];
  for(const [key,target] of [['distance','distance1'],['bowDistance','distance1'],['sternDistance','distance2']])if(has(key)){const n=number(key);if(n!==null&&n<0)throw Error('Khoảng cách không được âm');put(target,n===null?null:n*factor);}
 }
 if(has('speed_mps'))put('windSpeed',number('speed_mps'));
 if(has('windSpeed'))put('windSpeed',number('windSpeed'));
 if(p.sensor==='ES-WS-04'&&has('angle'))put('windDirection',number('angle'));
 else if(has('windDirection')){
  if(typeof p.windDirection==='string'){const index=directions.indexOf(p.windDirection.toUpperCase());if(index<0)throw Error('Hướng gió không hợp lệ');put('windDirection',index*22.5);}
  else put('windDirection',number('windDirection'));
 }
 for(const key of ['waterLevel','bowSpeed','sternSpeed','waterFlow','vesselSpeed','vesselHeading'])if(has(key))put(key,number(key));
 if(values.windDirection!==undefined&&(values.windDirection<0||values.windDirection>360))throw Error('Góc hướng gió phải nằm trong 0–360°');
 return {values,sensor:typeof p.sensor==='string'?p.sensor:'BAS',valid,ageMs:typeof p.age_ms==='number'&&Number.isFinite(p.age_ms)&&p.age_ms>=0?p.age_ms:0,raw:p};
}
