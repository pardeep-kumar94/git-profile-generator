const $=s=>document.querySelector(s);
const $$=s=>document.querySelectorAll(s);
const API="https://api.github.com";

/* ---------------- state ---------------- */
const state={
  raw:null, analysis:null,
  form:{}, // editable content
  theme:"editorial", accent:"f0a202", dark:false,
  opt:{header:"text", badge:"for-the-badge", badgeLayout:"horizontal", statcard:"grid", emoji:true},
  order:["intro","skills","badges","stats","activity","showcase","trophies","social","quote","support","extras","mermaid","timeline","faq","footer"],
  sections:{
    intro:true, skills:false, badges:true, stats:true, activity:false, showcase:true,
    trophies:false, social:true, quote:false, support:false, extras:false,
    mermaid:false, timeline:false, faq:false, footer:false
  },
  pickedRepos:[] // array of repo names
};

const THEMES={
  editorial:{nm:"Editorial",ds:"clean + serif",sw:["#1f2328","#f0a202","#fff"],sCard:"default"},
  neon:{nm:"Neon",ds:"dark + glow",sw:["#0d1117","#2dd4bf","#a78bfa"],sCard:"radical"},
  minimal:{nm:"Minimal",ds:"quiet",sw:["#fff","#59636e","#1f2328"],sCard:"transparent"},
  bold:{nm:"Bold",ds:"big + centered",sw:["#0d1117","#f0a202","#fd8c73"],sCard:"tokyonight"},
  ocean:{nm:"Ocean",ds:"cool blues",sw:["#0b1622","#58a6ff","#2dd4bf"],sCard:"github_dark"},
  candy:{nm:"Candy",ds:"warm pop",sw:["#1a1320","#f778ba","#f0a202"],sCard:"synthwave"}
};
const ACCENTS=["f0a202","2dd4bf","fd8c73","a78bfa","58a6ff","f778ba","ffffff","ff6b6b"];
const HEADER_OPTS=[["text","Plain heading"],["typing","Typing SVG"],["banner","Centered banner"],["capsule","Capsule banner"],["wave","Wave"]];
const BADGE_OPTS=[["for-the-badge","Bold"],["flat","Flat"],["flat-square","Square"],["plastic","Plastic"]];
const BADGELAYOUT_OPTS=[["horizontal","Horizontal"],["vertical","Vertical"]];
const STATCARD_OPTS=[["grid","Grid"],["side","Side by side"],["stacked","Stacked"],["statsonly","Stats only"],["langsonly","Langs only"]];

/* ---------------- fetch + analyze ---------------- */
async function gh(p){const r=await fetch(API+p,{headers:{Accept:"application/vnd.github+json"}});if(r.status===404)throw new Error("404");if(r.status===403)throw new Error("rate");if(!r.ok)throw new Error("http");return r.json();}
async function fetchReadme(user){
  try{
    const r=await fetch(`${API}/repos/${user}/${user}/readme`,{headers:{Accept:"application/vnd.github+json"}});
    if(!r.ok)return null;
    const j=await r.json();
    return atob(j.content.replace(/\n/g,""));
  }catch{return null;}
}
function parseReadme(md){
  if(!md)return{};
  const out={};
  // tagline: first ### line
  const tagM=md.match(/^#{1,3}\s+.+\n+(?:#{1,3}\s+(.+))/m);
  if(tagM)out.tagline=tagM[1].trim();
  // working / learning / askme / location from bullet facts
  const wm=md.match(/[🔭].*?Working on \*\*(.+?)\*\*/);if(wm)out.working=wm[1];
  const lm=md.match(/[🌱].*?Learning \*\*(.+?)\*\*/);if(lm)out.learning=lm[1];
  const am=md.match(/[💬].*?Ask me about \*\*(.+?)\*\*/);if(am)out.askme=am[1];
  const locm=md.match(/[📍](.+)/);if(locm)out.location=locm[1].trim();
  // social links
  const wbm=md.match(/\[Website\]\(([^)]+)\)/i)||md.match(/!\[Website\][^(]*\(([^)]+)\)/i);if(wbm)out.website=wbm[1];
  const twm=md.match(/twitter\.com\/([A-Za-z0-9_]+)/i);if(twm)out.twitter=twm[1];
  const lim=md.match(/linkedin\.com\/(in\/[A-Za-z0-9_-]+)/i);if(lim)out.linkedin=lim[1];
  const emm=md.match(/mailto:([^\s)"]+)/i);if(emm)out.email=emm[1];
  const kfm=md.match(/ko-fi\.com\/([A-Za-z0-9_]+)/i);if(kfm)out.kofi=kfm[1];
  // tech stack: collect badge labels from shields.io badges
  const badges=[...md.matchAll(/!\[([^\]]+)\]\(https:\/\/img\.shields\.io\/badge\/[^\)]+\)/g)].map(m=>m[1]).filter(n=>!/profile|views|twitter|linkedin|website|email|ko-fi|sponsor|github/i.test(n));
  if(badges.length)out.stack=badges.join(", ");
  return out;
}
async function load(user){setStatus(true,"Finding the account…");const u=await gh(`/users/${user}`);setStatus(true,"Reading repositories…");const repos=await gh(`/users/${user}/repos?per_page=100&sort=pushed`);setStatus(true,"Loading existing README…");const readme=await fetchReadme(user);return {u,repos,owned:repos.filter(r=>!r.fork),readme};}
function fmt(n){return n>=1000?(n/1000).toFixed(n>=10000?0:1)+"k":""+n;}
function analyze({u,repos,owned}){
  const t={};owned.forEach(r=>{if(r.language)t[r.language]=(t[r.language]||0)+(r.size||1);});
  const langs=Object.entries(t).sort((a,b)=>b[1]-a[1]);
  const totalStars=owned.reduce((a,r)=>a+r.stargazers_count,0);
  const ranked=[...owned].sort((a,b)=>(b.stargazers_count-a.stargazers_count)||(new Date(b.pushed_at)-new Date(a.pushed_at)));
  const now=Date.now();
  const recent=owned.filter(r=>(now-new Date(r.pushed_at))<1.555e10);
  return {u,repos,owned,langs,totalStars,ranked,recent};
}

/* prefill the editable form from GitHub data + existing README */
function prefillForm(a,rd){
  const u=a.u;
  const primary=a.langs[0]?a.langs[0][0]:"software";
  const second=a.langs[1]?a.langs[1][0]:null;
  // base from GitHub API
  state.form={
    name:u.name||u.login,
    tagline: u.bio && u.bio.length<90 ? u.bio : `${primary}${second?` & ${second}`:""} developer`,
    about: composeAbout(a),
    role:"", location:u.location||"",
    working:"", learning:"", askme:"",
    website:u.blog||"", twitter:u.twitter_username||"", linkedin:"", email:u.email||"", kofi:"",
    stack: a.langs.slice(0,8).map(l=>l[0]).join(", "),
    faqs:[
      {q:"What do you work on?", a:composeAbout(a)},
      {q:"What can I ask you about?", a:(a.langs[0]?a.langs[0][0]:"code")+" and building things"}
    ],
    mindRoot: u.name||u.login,
    mindBranches: a.langs.slice(0,5).map(l=>({label:l[0],children:[]}))
  };
  // overlay with README-parsed values (non-empty wins)
  if(rd){
    const keys=["tagline","working","learning","askme","location","website","twitter","linkedin","email","kofi","stack"];
    keys.forEach(k=>{if(rd[k]&&rd[k].trim())state.form[k]=rd[k].trim();});
  }
  state.pickedRepos = a.ranked.slice(0,4).map(r=>r.name);
}
function composeAbout(a){
  const flag=a.ranked[0];
  let s="";
  if(flag&&flag.stargazers_count>5){s+=`Best known for [${flag.name}](${flag.html_url}) (★ ${fmt(flag.stargazers_count)}). `;}
  if(a.recent.length>=3)s+=`Currently active across ${a.recent.length} projects. `;
  if(a.totalStars>20)s+=`${fmt(a.totalStars)}★ earned across open-source work.`;
  return s.trim()||"Passionate about building useful things and learning in the open.";
}

/* ---------------- markdown builder ---------------- */
function emo(e){return state.opt.emoji?e+" ":"";}
function badge(label,color,logo,logoColor){
  const l=encodeURIComponent(label);
  return `![${label}](https://img.shields.io/badge/${l}-${color}?style=${state.opt.badge}&logo=${logo}&logoColor=${logoColor||"white"})`;
}
const LANG_LOGO={JavaScript:["F7DF1E","javascript","black"],TypeScript:["3178C6","typescript"],Python:["3776AB","python"],Java:["ED8B00","openjdk"],"C++":["00599C","cplusplus"],C:["A8B9CC","c","black"],Go:["00ADD8","go"],Rust:["000000","rust"],Ruby:["CC342D","ruby"],PHP:["777BB4","php"],Swift:["F05138","swift"],Kotlin:["7F52FF","kotlin"],Shell:["4EAA25","gnubash"],HTML:["E34F26","html5"],CSS:["1572B6","css3"],Vue:["4FC08D","vuedotjs"],Dart:["0175C2","dart"],"C#":["239120","csharp"],Scala:["DC322F","scala"],Elixir:["4B275F","elixir"],Lua:["2C2D72","lua"],React:["61DAFB","react","black"],"Node.js":["339933","nodedotjs"],Docker:["2496ED","docker"],AWS:["232F3E","amazonaws"],Kubernetes:["326CE5","kubernetes"],PostgreSQL:["4169E1","postgresql"],MongoDB:["47A248","mongodb"],Redis:["DC382D","redis"],GraphQL:["E10098","graphql"],Tailwind:["06B6D4","tailwindcss"],"Next.js":["000000","nextdotjs"],Vite:["646CFF","vite"],Figma:["F24E1E","figma"]};
function techBadge(name){
  const key=Object.keys(LANG_LOGO).find(k=>k.toLowerCase()===name.toLowerCase());
  if(key){const m=LANG_LOGO[key];return badge(key,m[0],m[1],m[2]);}
  return badge(name,"555555",name.toLowerCase().replace(/[^a-z0-9]/g,""));
}

function sectionMD(key){
  const a=state.analysis,u=a.u,f=state.form,T=THEMES[state.theme],acc=state.accent;
  if(key==="intro"){
    const bits=[];
    if(f.about)bits.push(f.about);
    const facts=[];
    if(f.working)facts.push(`${emo("🔭")}Working on **${f.working}**`);
    if(f.learning)facts.push(`${emo("🌱")}Learning **${f.learning}**`);
    if(f.askme)facts.push(`${emo("💬")}Ask me about **${f.askme}**`);
    if(f.location)facts.push(`${emo("📍")}${f.location}`);
    if(facts.length)bits.push(facts.join("  \n"));
    return bits.join("\n\n");
  }
  if(key==="badges"){
    const items=f.stack.split(",").map(s=>s.trim()).filter(Boolean);
    if(!items.length)return"";
    const badges=items.map(techBadge);
    if(state.opt.badgeLayout==="vertical"){
      // each badge on its own line — <br> forces a true vertical stack
      return `## ${emo("🛠️")}Tech stack\n\n${badges.join("<br>\n")}`;
    }
    // horizontal — space-joined flowing row, centered
    return `## ${emo("🛠️")}Tech stack\n\n<div align="center">\n\n${badges.join(" ")}\n\n</div>`;
  }
  if(key==="stats"){
    const stats=`https://github-readme-stats.vercel.app/api?username=${u.login}&show_icons=true&hide_border=true&theme=${T.sCard}&icon_color=${acc}&title_color=${acc}`;
    const langs=`https://github-readme-stats.vercel.app/api/top-langs/?username=${u.login}&layout=compact&hide_border=true&theme=${T.sCard}&title_color=${acc}`;
    const streak=`https://streak-stats.demolab.com?user=${u.login}&hide_border=true&theme=${T.sCard==="default"?"default":"dark"}&ring=${acc}&fire=${acc}&currStreakLabel=${acc}`;
    const lay=state.opt.statcard;
    if(lay==="grid"){
      return `## ${emo("📊")}GitHub stats\n\n<table align="center">\n<tr>\n<td><img src="${stats}" alt="stats" /></td>\n<td><img src="${langs}" alt="top languages" /></td>\n</tr>\n<tr>\n<td colspan="2" align="center"><img src="${streak}" alt="streak" /></td>\n</tr>\n</table>`;
    }
    let body="";
    if(lay==="side")body=`<img height="165" src="${stats}" alt="stats" />\n<img height="165" src="${langs}" alt="top languages" />`;
    else if(lay==="stacked")body=`<img src="${stats}" alt="stats" />\n\n<img src="${langs}" alt="top languages" />`;
    else if(lay==="statsonly")body=`<img src="${stats}" alt="stats" />`;
    else body=`<img src="${langs}" alt="top languages" />`;
    return `## ${emo("📊")}GitHub stats\n\n<div align="center">\n\n${body}\n\n<img src="${streak}" alt="streak" />\n\n</div>`;
  }
  if(key==="showcase"){
    const repos=state.pickedRepos.map(n=>a.owned.find(r=>r.name===n)).filter(Boolean);
    if(!repos.length)return"";
    const rows=repos.map(r=>{const d=r.description?r.description.replace(/\|/g,"\\|"):"—";return `<tr><td><a href="${r.html_url}"><b>${r.name}</b></a></td><td>${d}</td><td>⭐ ${fmt(r.stargazers_count)}</td><td>${r.language||""}</td></tr>`;}).join("\n");
    return `## ${emo("🚀")}Selected work\n\n<table>\n<tr><th>Project</th><th>What it is</th><th>Stars</th><th>Lang</th></tr>\n${rows}\n</table>`;
  }
  if(key==="social"){
    const links=[];
    if(f.website)links.push(`[![Website](https://img.shields.io/badge/Website-0A0A0A?style=${state.opt.badge}&logo=googlechrome&logoColor=white)](${f.website.startsWith("http")?f.website:"https://"+f.website})`);
    if(f.twitter)links.push(`[![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=${state.opt.badge}&logo=x&logoColor=white)](https://twitter.com/${f.twitter.replace(/^@/,"")})`);
    if(f.linkedin)links.push(`[![LinkedIn](https://img.shields.io/badge/LinkedIn-0A66C2?style=${state.opt.badge}&logo=linkedin&logoColor=white)](https://linkedin.com/${f.linkedin.replace(/^\//,"")})`);
    links.push(`[![GitHub](https://img.shields.io/badge/GitHub-181717?style=${state.opt.badge}&logo=github&logoColor=white)](${u.html_url})`);
    if(f.email)links.push(`[![Email](https://img.shields.io/badge/Email-D14836?style=${state.opt.badge}&logo=gmail&logoColor=white)](mailto:${f.email})`);
    return `## ${emo("🤝")}Connect\n\n${links.join("\n")}`;
  }
  if(key==="extras"){
    const ex=[];
    ex.push(`<div align="center">\n\n![Profile views](https://komarev.com/ghpvc/?username=${u.login}&color=${acc}&style=${state.opt.badge})\n\n</div>`);
    ex.push(`<div align="center">\n\n<!-- Snake animation — set up the Platane/snake GitHub Action to generate this -->\n![Snake](https://raw.githubusercontent.com/${u.login}/${u.login}/output/github-contribution-grid-snake-dark.svg)\n\n</div>`);
    return ex.join("\n\n");
  }
  if(key==="skills"){
    // skill icons via skillicons.dev — clean branded logo row
    const items=f.stack.split(",").map(s=>s.trim()).filter(Boolean);
    if(!items.length)return"";
    const ICON_MAP={JavaScript:"js",TypeScript:"ts",Python:"py","Node.js":"nodejs",React:"react","Next.js":"nextjs",Vue:"vue",Go:"go",Rust:"rust",Java:"java","C++":"cpp",C:"c","C#":"cs",Ruby:"ruby",PHP:"php",Swift:"swift",Kotlin:"kotlin",HTML:"html",CSS:"css",Tailwind:"tailwind",Docker:"docker",Kubernetes:"kubernetes",AWS:"aws",PostgreSQL:"postgres",MongoDB:"mongodb",Redis:"redis",GraphQL:"graphql",Vite:"vite",Figma:"figma",Shell:"bash",Dart:"dart",Scala:"scala",Elixir:"elixir",Lua:"lua"};
    const icons=items.map(i=>{const k=Object.keys(ICON_MAP).find(x=>x.toLowerCase()===i.toLowerCase());return k?ICON_MAP[k]:null;}).filter(Boolean).slice(0,15);
    if(!icons.length)return"";
    return `## ${emo("⚡")}Skills\n\n<div align="center">\n\n![Skills](https://skillicons.dev/icons?i=${icons.join(",")}&theme=${state.dark?"dark":"light"})\n\n</div>`;
  }
  if(key==="activity"){
    const graph=`https://github-readme-activity-graph.vercel.app/graph?username=${u.login}&bg_color=00000000&color=${acc}&line=${acc}&point=${acc}&hide_border=true&area=true`;
    return `## ${emo("📈")}Contribution graph\n\n<div align="center">\n\n![Activity graph](${graph})\n\n</div>`;
  }
  if(key==="trophies"){
    const t=`https://github-profile-trophy.vercel.app/?username=${u.login}&theme=${T.sCard==="default"?"flat":"darkhub"}&no-frame=true&no-bg=true&column=7&margin-w=4`;
    return `## ${emo("🏆")}Trophies\n\n<div align="center">\n\n![Trophies](${t})\n\n</div>`;
  }
  if(key==="quote"){
    // GitHub readme quotes service — dynamic, or fall back to a static one
    return `## ${emo("💭")}Dev quote\n\n<div align="center">\n\n![Quote](https://quotes-github-readme.vercel.app/api?type=horizontal&theme=${state.dark?"dark":"light"})\n\n</div>`;
  }
  if(key==="support"){
    const handle=f.kofi||u.login;
    return `## ${emo("☕")}Support\n\n[![Ko-fi](https://img.shields.io/badge/Ko--fi-Buy%20me%20a%20coffee-FF5E5B?style=${state.opt.badge}&logo=ko-fi&logoColor=white)](https://ko-fi.com/${handle}) [![Sponsor](https://img.shields.io/badge/Sponsor-GitHub-EA4AAA?style=${state.opt.badge}&logo=githubsponsors&logoColor=white)](https://github.com/sponsors/${u.login})`;
  }
  if(key==="mermaid"){
    // editable nested mindmap — native Mermaid, renders live on GitHub
    const clean=s=>(s||"").replace(/[^a-zA-Z0-9 .+#/-]/g,"").trim();
    const root=clean(f.mindRoot)||clean(f.name)||u.login;
    const branches=(f.mindBranches||[]).filter(b=>clean(b.label));
    if(!branches.length)return"";
    const lines=[];
    branches.forEach(b=>{
      lines.push(`    ${clean(b.label)}`);
      (b.children||[]).map(clean).filter(Boolean).forEach(c=>lines.push(`      ${c}`));
    });
    return `## ${emo("🧠")}Tech mindmap\n\n\`\`\`mermaid\nmindmap\n  root((${root}))\n${lines.join("\n")}\n\`\`\``;
  }
  if(key==="timeline"){
    // collapsible journey / coding facts using <details>
    const yr=new Date(u.created_at).getFullYear();
    return `## ${emo("📅")}My journey\n\n<details>\n<summary>Click to expand</summary>\n\n- ${emo("🐙")}Joined GitHub in **${yr}**\n- ${emo("📦")}Published **${a.owned.length}** original repositories\n- ${emo("⭐")}Earned **${fmt(a.totalStars)}** stars across projects\n- ${emo("🔥")}Most active in **${a.langs[0]?a.langs[0][0]:"code"}**\n\n</details>`;
  }
  if(key==="faq"){
    const faqs=(f.faqs||[]).filter(x=>x.q&&x.q.trim());
    if(!faqs.length)return"";
    const blocks=faqs.map(x=>`<details>\n<summary><b>${x.q.trim()}</b></summary>\n\n${(x.a||"").trim()}\n\n</details>`).join("\n\n");
    return `## ${emo("❓")}FAQ\n\n${blocks}`;
  }
  if(key==="footer"){
    if(state.opt.header==="capsule"||state.opt.header==="wave"){
      return `<div align="center">\n\n![footer](https://capsule-render.vercel.app/api?type=waving&color=${acc}&height=120&section=footer)\n\n</div>`;
    }
    return `<div align="center">\n\n${emo("⭐")}From [${u.login}](${u.html_url}) — thanks for stopping by!\n\n</div>`;
  }
  return"";
}

function header(){
  const a=state.analysis,f=state.form,acc=state.accent;
  const sub=f.tagline||"";
  if(state.opt.header==="typing"){
    const lines=encodeURIComponent(`${f.name};${sub}`);
    return `<div align="center">\n\n![Typing](https://readme-typing-svg.demolab.com?font=Fira+Code&size=28&duration=3000&pause=800&color=${acc.toUpperCase()}&center=true&vCenter=true&width=600&lines=${lines})\n\n</div>`;
  }
  if(state.opt.header==="banner")return `<div align="center">\n\n# ${f.name}\n\n### ${sub}\n\n</div>`;
  if(state.opt.header==="capsule")return `<div align="center">\n\n![header](https://capsule-render.vercel.app/api?type=waving&color=${acc}&height=180&section=header&text=${encodeURIComponent(f.name)}&fontColor=ffffff&fontSize=44&desc=${encodeURIComponent(sub)}&descAlignY=62)\n\n</div>`;
  if(state.opt.header==="wave")return `<div align="center">\n\n![header](https://capsule-render.vercel.app/api?type=wave&color=gradient&customColorList=${acc}&height=140&text=${encodeURIComponent(f.name)}&fontColor=ffffff)\n\n### ${sub}\n\n</div>`;
  return `# ${emo("👋")}Hi, I'm ${f.name}${sub?`\n\n### ${sub}`:""}`;
}

function buildMarkdown(){
  const L=[header()];
  state.order.forEach(k=>{if(state.sections[k]){const md=sectionMD(k);if(md)L.push(md);}});
  return L.join("\n\n---\n\n");
}
function randomQuote(){const q=["Talk is cheap. Show me the code. — Linus Torvalds","First, solve the problem. Then, write the code. — John Johnson","Simplicity is the soul of efficiency. — Austin Freeman","Programs must be written for people to read. — Harold Abelson"];return q[Math.floor(Math.random()*q.length)];}

/* ---------------- preview renderer ---------------- */
function mdToHtml(md){
  // pull out fenced code blocks first so their contents aren't block-split
  const fences=[];
  md=md.replace(/```(\w*)\n([\s\S]*?)```/g,(m,lang,code)=>{
    const i=fences.length;
    if(lang==="mermaid") fences.push(`<div class="mermaid-box"><div class="mermaid-label">⬡ Mermaid diagram · renders live on GitHub</div><pre class="mermaid-src">${code.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</pre></div>`);
    else fences.push(`<pre class="codeblock"><code>${code.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]))}</code></pre>`);
    return `\u0000FENCE${i}\u0000`;
  });
  const ALERT={NOTE:["#0969da","ℹ️"],TIP:["#1a7f37","💡"],IMPORTANT:["#8250df","❗"],WARNING:["#9a6700","⚠️"],CAUTION:["#cf222e","🛑"]};
  const blocks=md.split(/\n\n+/);let html="";
  for(let raw of blocks){
    let b=raw.trim();
    if(!b)continue;
    if(b.indexOf("\u0000FENCE")===0){html+=b.replace(/\u0000FENCE(\d+)\u0000/g,(m,i)=>fences[+i]);continue;}
    if(b==="---"){html+="<hr>";continue;}
    // details/summary passthrough (render summary + body)
    if(b.startsWith("<details")){
      const sum=(b.match(/<summary>([\s\S]*?)<\/summary>/)||[])[1]||"Details";
      let inner=b.replace(/<\/?details>/g,"").replace(/<summary>[\s\S]*?<\/summary>/,"").trim();
      html+=`<details class="ghdetails"><summary>${inline(sum)}</summary><div class="dbody">${mdToHtml(inner)}</div></details>`;
      continue;
    }
    const dm=b.match(/^<div align="center">\s*([\s\S]*?)\s*<\/div>$/);
    let center=false;if(dm){center=true;b=dm[1].trim();}
    b=b.replace(/<!--[\s\S]*?-->/g,"").trim();if(!b)continue;
    if(b.startsWith("<table")){html+=`<div class="${center?'center':''}">${renderCells(b)}</div>`;continue;}
    if(/^### /.test(b)){html+=`<h3 class="${center?'center':''}">${inline(b.slice(4))}</h3>`;continue;}
    if(/^## /.test(b)){html+=`<h2>${inline(b.slice(3))}</h2>`;continue;}
    if(/^# /.test(b)){html+=`<h1 class="${center?'center':''}">${inline(b.slice(2))}</h1>`;continue;}
    // GitHub alert
    const al=b.match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*([\s\S]*)$/);
    if(al){const [c,ic]=ALERT[al[1]];const txt=al[2].replace(/^>\s?/gm,"").trim();html+=`<div class="ghalert" style="border-left:3px solid ${c}"><div class="alert-ttl" style="color:${c}">${ic} ${al[1][0]+al[1].slice(1).toLowerCase()}</div>${inline(txt)}</div>`;continue;}
    // task list
    if(/^- \[[ x]\]/m.test(b)){
      const items=b.split("\n").map(l=>{const m=l.match(/^- \[([ x])\]\s*(.*)$/);if(!m)return"";return `<li class="task"><span class="cb ${m[1]==="x"?"done":""}">${m[1]==="x"?"✓":""}</span>${inline(m[2])}</li>`;}).join("");
      html+=`<ul class="tasklist">${items}</ul>`;continue;
    }
    // bullet list
    if(/^- /m.test(b)){
      const items=b.split("\n").filter(l=>/^- /.test(l)).map(l=>`<li>${inline(l.slice(2))}</li>`).join("");
      html+=`<ul>${items}</ul>`;continue;
    }
    if(/^> /.test(b)){html+=`<blockquote>${inline(b.replace(/^> /gm,""))}</blockquote>`;continue;}
    html+=`<p class="${center?'center':''}">${inline(b)}</p>`;
  }
  return html;
}
function renderCells(b){
  return b
    .replace(/<th[^>]*>([\s\S]*?)<\/th>/g,(m,c)=>`<th style="text-align:left;padding:6px 13px;border:1px solid var(--gh-line)">${inline(c)}</th>`)
    .replace(/<td[^>]*>([\s\S]*?)<\/td>/g,(m,c)=>{
      const isImg=/!\[|<img/.test(c);
      const style=isImg?"padding:5px;text-align:center":"padding:6px 13px;border:1px solid var(--gh-line)";
      return `<td style="${style}">${inline(c)}</td>`;
    });
}
function imgTag(alt,src){
  if(/img\.shields\.io/.test(src))return `<img class="badge" src="${src}" alt="${alt}" onerror="this.outerHTML='<span class=&quot;imgskel&quot;>🏷️ '+this.alt+'</span>'">`;
  if(/readme-stats|streak|typing|ghpvc|snake|contribution|capsule-render|komarev|skillicons|activity-graph|profile-trophy|quotes-github-readme/.test(src))return `<span class="imgskel">🖼️ ${alt||"widget"} · renders on GitHub</span>`;
  return `<img src="${src}" alt="${alt}">`;
}
function inline(t){
  // raw <img ...> tags (used in grid/side/table cells) -> route through imgTag for placeholders
  t=t.replace(/<img\b[^>]*?>/g,(m)=>{
    const src=(m.match(/src="([^"]+)"/)||[])[1]||"";
    const alt=(m.match(/alt="([^"]*)"/)||[])[1]||"";
    return src?imgTag(alt,src):m;
  });
  t=t.replace(/\[!\[([^\]]*)\]\(([^)]+)\)\]\(([^)]+)\)/g,(m,alt,src,url)=>`<a href="${url}" target="_blank" rel="noopener">${imgTag(alt,src)}</a>`);
  t=t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,(m,alt,src)=>imgTag(alt,src));
  t=t.replace(/\[([^\]]+)\]\(([^)]+)\)/g,(m,txt,url)=>`<a href="${url}" target="_blank" rel="noopener">${txt}</a>`);
  t=t.replace(/\*\*([^*]+)\*\*/g,"<b>$1</b>");
  t=t.replace(/`([^`]+)`/g,"<code>$1</code>");
  t=t.replace(/  \n/g,"<br>").replace(/\n/g,"<br>");
  return t;
}

/* ---------------- render controls ---------------- */
function renderStyle(){
  $("#themes").innerHTML=Object.entries(THEMES).map(([k,t])=>`<button class="theme ${state.theme===k?'on':''}" data-theme="${k}"><div class="sw">${t.sw.map(c=>`<i style="background:${c}"></i>`).join("")}</div><div class="nm">${t.nm}</div><div class="ds">${t.ds}</div></button>`).join("");
  $("#accents").innerHTML=ACCENTS.map(c=>`<span class="ac ${state.accent===c?'on':''}" data-acc="${c}" style="background:#${c}"></span>`).join("")+`<label class="ac custom" title="Custom color">+<input type="color" id="custom-acc"></label>`;
  const segs={ "opt-header":[HEADER_OPTS,"header"], "opt-badge":[BADGE_OPTS,"badge"], "opt-badgeLayout":[BADGELAYOUT_OPTS,"badgeLayout"], "opt-statcard":[STATCARD_OPTS,"statcard"] };
  for(const [id,[opts,key]] of Object.entries(segs)){
    $("#"+id).innerHTML=opts.map(([v,lbl])=>`<button data-opt="${key}" data-val="${v}" class="${state.opt[key]===v?'on':''}">${lbl}</button>`).join("");
  }
  $("#opt-emoji").innerHTML=[["true","On"],["false","Off"]].map(([v,lbl])=>`<button data-emoji="${v}" class="${String(state.opt.emoji)===v?'on':''}">${lbl}</button>`).join("");
}
function renderSections(){
  const labels={
    intro:["About / intro","narrative + facts"],
    skills:["Skill icons","branded logo row"],
    badges:["Tech-stack badges","from your stack list"],
    stats:["Stats cards","stats · langs · streak"],
    activity:["Activity graph","contribution line chart"],
    showcase:["Project showcase","picked repos"],
    trophies:["Trophy wall","github-profile-trophy"],
    social:["Social & links","website, X, email…"],
    quote:["Dev quote","random programming quote"],
    support:["Support / sponsor","Ko-fi + GitHub Sponsors"],
    extras:["Profile views + snake","counter & snake graph"],
    mermaid:["Tech mindmap","native Mermaid diagram"],
    timeline:["My journey","collapsible facts"],
    faq:["FAQ","collapsible Q&A"],
    footer:["Footer","sign-off / wave"]
  };
  $("#toggles").innerHTML=state.order.map(k=>`<div class="tog ${state.sections[k]?'on':''}" data-sec="${k}" draggable="true"><span class="drag">⠿</span><span class="box"></span><span class="lb">${labels[k][0]}<small>${labels[k][1]}</small></span></div>`).join("");
  wireDrag();
  const repos=state.analysis.ranked.slice(0,30);
  $("#repopick").innerHTML=repos.map(r=>`<div class="repo ${state.pickedRepos.includes(r.name)?'on':''}" data-repo="${r.name}"><span class="chk">${state.pickedRepos.includes(r.name)?'✓':''}</span><span class="ri"><span class="rn">${r.name}</span><span class="rd">${r.description||'—'}</span></span><span class="rs">★${fmt(r.stargazers_count)}</span></div>`).join("");
}
function refresh(){const md=buildMarkdown();$("#md").textContent=md;$("#ghbody").innerHTML=mdToHtml(md);$("#rd-name").textContent=`${state.analysis.u.login}/${state.analysis.u.login}`;}
function applyDark(){$("#ghview").classList.toggle("dark",state.dark);$("#dark-state").textContent=state.dark?"◑ Dark":"◐ Light";}

/* ---------------- form wiring ---------------- */
function fillFormInputs(){
  const f=state.form;
  $("#f-name").value=f.name;$("#f-tagline").value=f.tagline;$("#f-about").value=f.about;
  $("#f-role").value=f.role;$("#f-location").value=f.location;$("#f-working").value=f.working;
  $("#f-learning").value=f.learning;$("#f-askme").value=f.askme;
  $("#f-website").value=f.website;$("#f-twitter").value=f.twitter;$("#f-linkedin").value=f.linkedin;$("#f-email").value=f.email;$("#f-kofi").value=f.kofi;
  $("#f-stack").value=f.stack;
  const u=state.analysis.u;
  $("#gh-blog").textContent=u.blog?"· from GitHub":"";
  $("#gh-tw").textContent=u.twitter_username?"· from GitHub":"";
  $("#gh-em").textContent=u.email?"· from GitHub":"";
  renderFaqEditor();
  $("#f-mindRoot").value=f.mindRoot||"";
  renderMindEditor();
}

/* ---------------- FAQ editor ---------------- */
function renderFaqEditor(){
  const list=$("#faqlist");
  const faqs=state.form.faqs||[];
  list.innerHTML=faqs.map((x,i)=>`
    <div class="faqrow" data-i="${i}">
      <button class="rm" data-rm="${i}" title="Remove">✕</button>
      <input class="faq-q" data-fi="${i}" data-fk="q" value="${(x.q||"").replace(/"/g,"&quot;")}" placeholder="Question">
      <textarea data-fi="${i}" data-fk="a" placeholder="Answer">${(x.a||"").replace(/</g,"&lt;")}</textarea>
    </div>`).join("");
}
function wireFaqEditor(){
  $("#faq-add").addEventListener("click",()=>{
    if(!state.form.faqs)state.form.faqs=[];
    state.form.faqs.push({q:"",a:""});
    renderFaqEditor();refresh();
  });
  // edit in place — no re-render, so focus is preserved
  $("#faqlist").addEventListener("input",e=>{
    const el=e.target;const i=el.dataset.fi,k=el.dataset.fk;
    if(i==null)return;
    state.form.faqs[+i][k]=el.value;refresh();
  });
  // remove
  $("#faqlist").addEventListener("click",e=>{
    const b=e.target.closest("[data-rm]");if(!b)return;
    state.form.faqs.splice(+b.dataset.rm,1);
    renderFaqEditor();refresh();
  });
}

/* ---------------- mindmap branch editor (with sub-branches) ---------------- */
function renderMindEditor(){
  const list=$("#mindlist");
  const br=state.form.mindBranches||[];
  list.innerHTML=br.map((b,i)=>`
    <div class="faqrow" data-mi="${i}" style="padding:9px">
      <button class="rm" data-mrm="${i}" title="Remove branch">✕</button>
      <input data-mbi="${i}" value="${(b.label||"").replace(/"/g,"&quot;")}" placeholder="Branch label" style="margin-bottom:8px;padding-right:30px;font-weight:600">
      <div class="subwrap">
        ${(b.children||[]).map((c,j)=>`
          <div class="subrow">
            <span class="subtick">└</span>
            <input data-mci="${i}" data-mcj="${j}" value="${(c||"").replace(/"/g,"&quot;")}" placeholder="Sub-branch">
            <button class="rm sub" data-mcrm="${i}" data-mcj="${j}" title="Remove sub-branch">✕</button>
          </div>`).join("")}
      </div>
      <button class="addsub" data-maddsub="${i}">+ Add sub-branch</button>
    </div>`).join("");
}
function wireMindEditor(){
  $("#mind-add").addEventListener("click",()=>{
    if(!state.form.mindBranches)state.form.mindBranches=[];
    state.form.mindBranches.push({label:"",children:[]});
    renderMindEditor();refresh();
  });
  // edit in place (no re-render -> keeps focus)
  $("#mindlist").addEventListener("input",e=>{
    const el=e.target;
    if(el.dataset.mbi!=null){ state.form.mindBranches[+el.dataset.mbi].label=el.value; refresh(); }
    else if(el.dataset.mci!=null){ state.form.mindBranches[+el.dataset.mci].children[+el.dataset.mcj]=el.value; refresh(); }
  });
  // add sub-branch / remove branch / remove sub-branch
  $("#mindlist").addEventListener("click",e=>{
    const addSub=e.target.closest("[data-maddsub]");
    const rmBranch=e.target.closest("[data-mrm]");
    const rmSub=e.target.closest("[data-mcrm]");
    if(addSub){const b=state.form.mindBranches[+addSub.dataset.maddsub];if(!b.children)b.children=[];b.children.push("");renderMindEditor();refresh();}
    else if(rmSub){state.form.mindBranches[+rmSub.dataset.mcrm].children.splice(+rmSub.dataset.mcj,1);renderMindEditor();refresh();}
    else if(rmBranch){state.form.mindBranches.splice(+rmBranch.dataset.mrm,1);renderMindEditor();refresh();}
  });
}
const FORM_MAP={ "f-name":"name","f-tagline":"tagline","f-about":"about","f-role":"role","f-location":"location","f-working":"working","f-learning":"learning","f-askme":"askme","f-website":"website","f-twitter":"twitter","f-linkedin":"linkedin","f-email":"email","f-kofi":"kofi","f-stack":"stack","f-mindRoot":"mindRoot" };
function wireForm(){
  Object.entries(FORM_MAP).forEach(([id,key])=>{
    $("#"+id).addEventListener("input",e=>{state.form[key]=e.target.value;refresh();});
  });
}

/* ---------------- drag reorder ---------------- */
let dragSrc=null;
function wireDrag(){
  $$("#toggles .tog").forEach(el=>{
    el.addEventListener("dragstart",e=>{dragSrc=el;el.classList.add("dragging");});
    el.addEventListener("dragend",()=>{el.classList.remove("dragging");$$("#toggles .tog").forEach(t=>t.classList.remove("dragover"));});
    el.addEventListener("dragover",e=>{e.preventDefault();el.classList.add("dragover");});
    el.addEventListener("dragleave",()=>el.classList.remove("dragover"));
    el.addEventListener("drop",e=>{
      e.preventDefault();
      if(!dragSrc||dragSrc===el)return;
      const from=dragSrc.dataset.sec,to=el.dataset.sec;
      const oi=state.order.indexOf(from),ni=state.order.indexOf(to);
      state.order.splice(oi,1);state.order.splice(ni,0,from);
      renderSections();refresh();
    });
  });
}

/* ---------------- events ---------------- */
function wire(){
  $$(".panel-tabs button").forEach(b=>b.addEventListener("click",()=>{
    $$(".panel-tabs button").forEach(x=>x.classList.remove("on"));b.classList.add("on");
    $$(".pane").forEach(p=>p.classList.remove("on"));$("#pane-"+b.dataset.pane).classList.add("on");
  }));
  $("#themes").addEventListener("click",e=>{const b=e.target.closest("[data-theme]");if(!b)return;state.theme=b.dataset.theme;renderStyle();refresh();});
  $("#accents").addEventListener("click",e=>{const b=e.target.closest("[data-acc]");if(!b)return;state.accent=b.dataset.acc;renderStyle();refresh();});
  document.addEventListener("input",e=>{if(e.target.id==="custom-acc"){state.accent=e.target.value.replace("#","");renderStyle();refresh();}});
  ["opt-header","opt-badge","opt-badgeLayout","opt-statcard"].forEach(id=>$("#"+id).addEventListener("click",e=>{const b=e.target.closest("[data-opt]");if(!b)return;state.opt[b.dataset.opt]=b.dataset.val;renderStyle();refresh();}));
  $("#opt-emoji").addEventListener("click",e=>{const b=e.target.closest("[data-emoji]");if(!b)return;state.opt.emoji=b.dataset.emoji==="true";renderStyle();refresh();});
  $("#toggles").addEventListener("click",e=>{const b=e.target.closest("[data-sec]");if(!b||e.target.classList.contains("drag"))return;state.sections[b.dataset.sec]=!state.sections[b.dataset.sec];renderSections();refresh();});
  $("#repopick").addEventListener("click",e=>{
    const r=e.target.closest("[data-repo]");if(!r)return;
    const n=r.dataset.repo,i=state.pickedRepos.indexOf(n);
    if(i>=0)state.pickedRepos.splice(i,1);
    else{if(state.pickedRepos.length>=6){return;}state.pickedRepos.push(n);}
    renderSections();refresh();
  });
  $("#tab-preview").addEventListener("click",()=>{$("#tab-preview").classList.add("on");$("#tab-code").classList.remove("on");$("#ghview").style.display="block";$("#codeview").classList.remove("show");$("#hint").style.display="flex";});
  $("#tab-code").addEventListener("click",()=>{$("#tab-code").classList.add("on");$("#tab-preview").classList.remove("on");$("#ghview").style.display="none";$("#codeview").classList.add("show");$("#hint").style.display="none";});
  $("#dark-toggle").addEventListener("click",()=>{state.dark=!state.dark;applyDark();});
  $("#copy").addEventListener("click",()=>{navigator.clipboard.writeText($("#md").textContent).then(()=>{const b=$("#copy"),t=b.textContent;b.textContent="Copied ✓";setTimeout(()=>b.textContent=t,1600);});});
  $("#download").addEventListener("click",()=>{const blob=new Blob([$("#md").textContent],{type:"text/markdown"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="README.md";a.click();});
}

function setStatus(s,t){$("#status").classList.toggle("show",s);if(t)$("#statustext").textContent=t;}
function showErr(m){const e=$("#err");e.textContent=m;e.classList.add("show");}
function clearErr(){$("#err").classList.remove("show");}

async function run(){
  const user=$("#handle").value.trim().replace(/^@/,"");
  if(!user){showErr("Type a GitHub username first.");return;}
  clearErr();$("#studio").classList.remove("show");$("#go").disabled=true;
  try{
    const data=await load(user);
    if(!data.repos.length){setStatus(false);showErr(`@${user} has no public repositories yet — nothing public to build from.`);return;}
    setStatus(true,"Composing your profile…");
    state.raw=data;state.analysis=analyze(data);prefillForm(state.analysis,parseReadme(data.readme));
    setTimeout(()=>{
      setStatus(false);
      renderStyle();renderSections();fillFormInputs();refresh();applyDark();
      $("#studio").classList.add("show");
      $("#studio").scrollIntoView({behavior:"smooth",block:"start"});
    },350);
  }catch(err){
    setStatus(false);
    if(err.message==="404")showErr(`No GitHub user called “${user}”. Check the spelling.`);
    else if(err.message==="rate")showErr("GitHub's anonymous API limit is hit (60/hour). Wait a few minutes, or add a token in production.");
    else showErr("Couldn't reach GitHub just now. Try again in a moment.");
  }finally{$("#go").disabled=false;}
}

$("#go").addEventListener("click",run);
$("#handle").addEventListener("keydown",e=>{if(e.key==="Enter")run();});
$$(".samples a").forEach(a=>a.addEventListener("click",()=>{$("#handle").value=a.dataset.u;run();}));
wire();wireForm();wireFaqEditor();wireMindEditor();
