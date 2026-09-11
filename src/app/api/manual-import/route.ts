import { NextResponse } from 'next/server'
import { GET as collectGET } from '@/app/api/import/collect/route'
import { GET as importOneGET } from '@/app/api/debug/import-one/route'

export const maxDuration = 120

const KEY = 'pv-cron-8x2m1q'
const BASE = 'https://promptsfa.ir'

const mkReq = (path: string) =>
  new Request(BASE + path, { headers: { authorization: 'Bearer ' + KEY } })

async function readJson(res: Response) {
  const t = await res.text()
  try { return JSON.parse(t) }
  catch { return { ok: false, error: 'invalid json (' + res.status + ')', raw: t.slice(0, 150) } }
}

export async function GET(req: Request) {
  const url = new URL(req.url)

  // صفحه کنسول گرافیکی
  if (url.searchParams.get('ui') === '1') {
    return new Response(PAGE, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
  }

  if (url.searchParams.get('key') !== KEY) {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  try {
    // فقط یک آیتم جمع کن
    const cRes = await collectGET(mkReq('/api/import/collect?count=1'))
    const c = await readJson(cRes)
    if (!c.ok) return NextResponse.json({ ok: false, stage: 'collect', detail: c })
    if (!c.collected) return NextResponse.json({ ok: true, done: true, message: 'صف خالی است' })

    // فقط یک آیتم ایمپورت کن
    const iRes = await importOneGET(mkReq('/api/debug/import-one'))
    const im = await readJson(iRes)
    return NextResponse.json({ ok: im.ok === true, done: false, slug: im.slug, detail: im })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500 })
  }
}

const PAGE = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>کنسول ایمپورت تلگرام</title>
<style>
body{font-family:Tahoma,Vazirmatn;background:#111;color:#eee;padding:24px}
button{padding:10px 24px;font-size:16px;border:0;border-radius:8px;background:#f59e0b;color:#111;cursor:pointer;margin-left:8px;font-weight:bold}
button:disabled{opacity:.35;cursor:not-allowed}
#log{margin-top:16px;background:#000;border:1px solid #333;border-radius:8px;padding:12px;height:65vh;overflow:auto;font-family:Consolas,monospace;font-size:13px;white-space:pre-wrap;direction:ltr;text-align:left}
.ok{color:#4ade80}.err{color:#f87171}.info{color:#93c5fd}
</style>
</head>
<body>
<h2>📥 کنسول ایمپورت خودکار تلگرام</h2>
<button id="start">▶ شروع ایمپورت</button>
<button id="stop" disabled>⏹ توقف</button>
<span id="count"></span>
<div id="log"></div>
<script>
var KEY='pv-cron-8x2m1q';
var running=false;
var done=0;
function log(msg,cls){cls=cls||'info';var el=document.getElementById('log');var d=document.createElement('div');d.className=cls;d.textContent='['+new Date().toLocaleTimeString()+'] '+msg;el.appendChild(d);el.scrollTop=el.scrollHeight;}
function stop(){running=false;document.getElementById('start').disabled=false;document.getElementById('stop').disabled=true;}
function step(){return fetch('/api/manual-import?key='+KEY).then(function(r){return r.json().catch(function(){return {ok:false,error:'empty response '+r.status}});});}
function loop(){
  if(!running)return;
  step().then(function(j){
    if(j.done){log('✅ صف تلگرام خالی شد — مجموع ایمپورت: '+done,'ok');stop();return;}
    if(!j.ok){log('❌ خطا: '+(j.error||JSON.stringify(j)),'err');stop();return;}
    done++;document.getElementById('count').textContent='ایمپورت شده: '+done;
    log('✅ ایمپورت شد: '+(j.slug||'-'),'ok');
    setTimeout(loop,3000);
  }).catch(function(e){log('❌ '+e.message,'err');stop();});
}
document.getElementById('start').onclick=function(){running=true;done=0;this.disabled=true;document.getElementById('stop').disabled=false;log('شروع فرآیند ایمپورت...');loop();};
document.getElementById('stop').onclick=function(){log('درخواست توقف...');running=false;};
</script>
</body>
</html>`
