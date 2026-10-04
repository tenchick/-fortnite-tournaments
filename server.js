const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const cache = new Map();
const CACHE_MS = 5 * 60 * 1000;

const regions = new Set(["EU","NAC","NAW","BR","ME","ASIA","OCE","NAE"]);

function fetchText(url){
  return new Promise((resolve,reject)=>{
    const req=https.get(url,{headers:{
      "User-Agent":"FortniteArena/1.0 (+https://www.fortnite.com/competitive/)",
      "Accept":"text/html,application/xhtml+xml"
    }},res=>{
      let data="";
      res.setEncoding("utf8");
      res.on("data",c=>data+=c);
      res.on("end",()=>res.statusCode>=200&&res.statusCode<400?resolve(data):reject(new Error("Epic HTTP "+res.statusCode)));
    });
    req.on("error",reject);
    req.setTimeout(15000,()=>req.destroy(new Error("Epic timeout")));
  });
}

function clean(s){
  return s.replace(/<[^>]+>/g," ").replace(/&nbsp;/g," ").replace(/&amp;/g,"&")
    .replace(/&#x27;/g,"'").replace(/\s+/g," ").trim();
}

function parseSchedule(html, region){
  // Epic renders the schedule server-side. We extract visible event/date/time strings
  // without depending on a private API.
  const text=clean(html);
  const dateRe=/((?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+[A-Z][a-z]+\s+\d{1,2},\s+2026)/g;
  const dates=[...text.matchAll(dateRe)].map(m=>({at:m.index,date:m[1]}));
  const timeRe=/\b\d{1,2}:\d{2}\s*(?:AM|PM)\b/g;
  const times=[...text.matchAll(timeRe)].map(m=>({at:m.index,time:m[0]}));
  const namesRe=/(FNCS[^<]{0,90}|(?:Solo|Duos|Console|Mobile|Reload|Ranked|Victory|Cash|Icon|Champion|Arenas|Fortnite Global)[^<]{0,90}(?:Cup|Championship|Qualifiers|Heats|Series|Evaluation))/gi;
  const raw=[...text.matchAll(namesRe)].map(m=>({at:m.index,name:m[0].trim()}));
  const out=[]; const seen=new Set();
  for(const n of raw){
    if(!n.name || n.name.length<5) continue;
    let d=dates.filter(x=>x.at<=n.at).pop();
    let t=times.filter(x=>x.at<=n.at && n.at-x.at<1200).pop();
    const key=(d?.date||"")+"|"+(t?.time||"")+"|"+n.name;
    if(seen.has(key)) continue; seen.add(key);
    out.push({
      name:n.name.replace(/\s+/g," ").slice(0,110),
      region,date:d?.date||"",time:t?.time||"",
      status:"upcoming",
      sourceUrl:`https://www.fortnite.com/competitive/schedule?lang=en-US&region=${region}`
    });
    if(out.length>=80) break;
  }
  return out;
}

async function schedule(region){
  region=regions.has(region)?region:"EU";
  const cached=cache.get(region);
  if(cached && Date.now()-cached.time<CACHE_MS) return {...cached.data,cachedAt:cached.time};
  const url=`https://www.fortnite.com/competitive/schedule?lang=en-US&region=${region}`;
  const html=await fetchText(url);
  const events=parseSchedule(html,region);
  const data={region,events,source:url,updatedAt:new Date().toISOString()};
  cache.set(region,{time:Date.now(),data});
  return {...data,cachedAt:Date.now()};
}

function send(res,status,type,body){
  res.writeHead(status,{"Content-Type":type,"Cache-Control":"no-store","Access-Control-Allow-Origin":"*"});
  res.end(body);
}

const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host}`);
    if(u.pathname==="/api/health") return send(res,200,"application/json",JSON.stringify({ok:true,time:new Date().toISOString()}));
    if(u.pathname==="/api/schedule"){
      const data=await schedule((u.searchParams.get("region")||"EU").toUpperCase());
      return send(res,200,"application/json",JSON.stringify(data));
    }
    let file=path.join(PUBLIC,u.pathname==="/"?"index.html":u.pathname);
    if(!file.startsWith(PUBLIC)) return send(res,403,"text/plain","Forbidden");
    if(fs.existsSync(file) && fs.statSync(file).isFile()){
      const ext=path.extname(file); const type=ext===".html"?"text/html":ext===".js"?"text/javascript":"application/octet-stream";
      return send(res,200,type,fs.readFileSync(file));
    }
    send(res,404,"text/plain","Not found");
  }catch(e){
    console.error(e);
    send(res,502,"application/json",JSON.stringify({error:"Не удалось обновить расписание",details:e.message}));
  }
});
server.listen(PORT,()=>console.log(`Fortnite Arena: http://localhost:${PORT}`));
