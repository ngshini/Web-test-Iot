// Read-only local browser test. Mock MQTT transport; never publish to a broker.
import assert from 'node:assert/strict';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_BROWSER_PATH?{executablePath:process.env.PLAYWRIGHT_BROWSER_PATH}:{channel:'chrome'})});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
const errors=[];
page.on('pageerror',error=>errors.push(error.message));
await page.addInitScript(()=>{
 window.WebSocket=class {
  constructor(){this.readyState=1;window.__mqtt=this;queueMicrotask(()=>this.onopen?.());}
  send(packet){if(packet[0]===16)queueMicrotask(()=>this.onmessage({data:new Uint8Array([32,2,0,0]).buffer}));if(packet[0]===130)queueMicrotask(()=>this.onmessage({data:new Uint8Array([144,3,0,1,0]).buffer}));}
  close(){this.readyState=3;}
 };
 window.__publish=payload=>{
  const encoder=new TextEncoder(),topic=encoder.encode('bas/BAS_TEST_001/telemetry'),json=encoder.encode(JSON.stringify(payload));
  const body=[topic.length>>8,topic.length&255,...topic,...json],length=[];
  let remaining=body.length;do{let digit=remaining%128;remaining=Math.floor(remaining/128);if(remaining)digit|=128;length.push(digit);}while(remaining);
  window.__mqtt.onmessage({data:new Uint8Array([48,...length,...body]).buffer});
 };
});
const base=process.env.WIND_TEST_URL||'http://127.0.0.1:8097/';
const send=payload=>page.evaluate(p=>window.__publish(p),{sensor:'wind-pair',status:'ok',...payload});
try{
 await page.clock.install();
 await page.goto(base+'#test/wind-direction');
 await page.locator('#wind-speed').waitFor();
 assert.equal(await page.locator('[data-sensor="wind"]').getAttribute('aria-selected'),'true');
 assert.equal(await page.locator('#wind-speed').textContent(),'—');
 await page.getByRole('button',{name:'Nhận MQTT',exact:true}).click();
 await send({windSpeed:3.2,windDirection:359});
 assert.equal(await page.locator('#wind-speed').textContent(),'3,2');
 assert.equal(await page.locator('#wind-status').textContent(),'Đủ hai số đo');
 await send({windSpeed:3.2,windDirection:1});
 assert.equal(await page.locator('#wind-needle').evaluate(e=>e.style.transform),'rotate(361deg)');
 assert.equal(await page.locator('.wind-visual').evaluate(e=>e.classList.contains('is-moving')),true);
 await page.getByRole('button',{name:'Tắt hiệu ứng'}).click();
 assert.equal(await page.locator('.wind-visual').evaluate(e=>e.classList.contains('is-moving')),false);
 await page.getByRole('button',{name:'Bật hiệu ứng'}).click();
 await send({windSpeed:3.2,windDirection:336.7});
 await page.waitForFunction(()=>{const m=new DOMMatrix(getComputedStyle(document.querySelector('#wind-needle')).transform);return Math.abs((Math.atan2(m.b,m.a)*180/Math.PI+360)%360-336.7)<.1;},null,{polling:50,timeout:3000});
 const angle=await page.locator('#wind-needle').evaluate(e=>{const m=new DOMMatrix(getComputedStyle(e).transform);return (Math.atan2(m.b,m.a)*180/Math.PI+360)%360;});
 assert.ok(Math.abs(angle-336.7)<.1,'settled needle matches the measured angle');
 await page.screenshot({path:'/tmp/iot-wind-desktop.png',fullPage:true});
 await page.setViewportSize({width:375,height:812});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'/tmp/iot-wind-mobile.png',fullPage:true});
 await page.setViewportSize({width:812,height:375});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.emulateMedia({reducedMotion:'reduce'});
 assert.equal(await page.locator('.wind-stream').first().evaluate(e=>getComputedStyle(e).display),'none');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await send({windSpeed:0,windDirection:90});
 assert.equal(await page.locator('#wind-speed').textContent(),'0,0');
 assert.equal(await page.locator('.wind-visual').evaluate(e=>e.classList.contains('is-moving')),false);
 assert.equal(await page.locator('.wind-stream').first().evaluate(e=>getComputedStyle(e).visibility),'hidden');
 await send({windSpeed:null,windDirection:90,speed_status:'timeout'});
 assert.equal(await page.locator('#wind-speed').textContent(),'—');
 assert.equal(await page.locator('#wind-status').textContent(),'Thiếu một số đo');
 await page.clock.fastForward(11001);
 assert.equal(await page.locator('#wind-angle').textContent(),'—');
 await page.getByRole('tab',{name:'Mực nước'}).click();
 await page.getByRole('tab',{name:'Gió · Tốc độ & hướng'}).click();
 assert.equal(await page.locator('#wind-speed').textContent(),'—');
 assert.deepEqual(errors,[]);
 console.log('PASS: mock MQTT pair, legacy link, shortest turn, pause, zero, partial, stale, mobile/landscape, reduced motion, navigation; no browser errors.');
}finally{await browser.close();}
