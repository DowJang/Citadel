/* 헤드리스 자가 대국 테스트 (개발용) */
const fs = require('fs');
const path = require('path');
const dir = __dirname;

const html = fs.readFileSync(path.join(dir, 'Citadel.html'), 'utf8');
const code = html.match(/<script>([\s\S]*)<\/script>/)[1];

const harness = `
/* ── 테스트 하네스 ── */
function __fakeEl(){
  const n={ style:{}, classList:{add(){},remove(){},contains(){return false}},
    children:[], textContent:'', innerHTML:'',
    appendChild(c){ this.children.push(c); return c; },
    remove(){}, onclick:null, scrollTop:0, scrollHeight:0 };
  return n;
}
function __runGames(n, diffId, opts){
  opts = opts || {};
  const dA = DIFFS.find(d=>d.id===(opts.dA||diffId));
  const dB = DIFFS.find(d=>d.id===(opts.dB||diffId));
  let wins=[0,0,0], scores=[0,0], rounds=0;
  for(let i=0;i<n;i++){
    const chars = opts.randomChars
      ? (()=>{const a=[];for(let r=1;r<=8;r++){const c=CHARS.filter(x=>x.rank===r&&!x.no2p);a.push(c[Math.floor(Math.random()*c.length)].id);}return a;})()
      : DEFAULT_CHARS.slice();
    const uniq = opts.allUniq ? UNIQUE.map(u=>u.id)
      : shuffle(UNIQUE.map(u=>u.id)).slice(0,14);
    startGame(diffId, chars, uniq);
    G.P[0].isAI = true; G.P[0].name='A';
    G.P[0].diff = dA; G.P[1].diff = dB;
    driveDraft();
    let guard=0;
    while(!G.ended && guard++ < 300000){
      if(__q.length){ const f=__q.shift(); f(); continue; }
      // 큐가 비었는데 안 끝났다 → 사람 입력 대기 상태 (버그)
      throw new Error('DEADLOCK phase='+G.phase+' turn='+JSON.stringify(G.turn&&{pi:G.turn.pi,cid:G.turn.cid,g:G.turn.gathered})+' round='+G.round);
    }
    while(__q.length){ const f=__q.shift(); f(); }
    if(!G.ended) throw new Error('NOT ENDED');
    const r=G.result;
    scores[0]+=r.a.total; scores[1]+=r.b.total; rounds+=G.round;
    wins[r.winner===null?2:r.winner]++;
  }
  return {wins, avg:[ (scores[0]/n).toFixed(1), (scores[1]/n).toFixed(1) ], rounds:(rounds/n).toFixed(1)};
}
module.exports = { __runGames, DIFFS, CHARS, UNIQUE, PROTO };
`;

// AI가 사람 자리(pi=0)도 두도록 aiTurn/aiGather 등이 AI=1 상수를 쓰는 부분을 일반화
const patched = code
  .replace(/if\(!G\.turn \|\| G\.turn\.pi!==AI \|\| G\.turn\.ended \|\| G\.ended\) return;\s*\n\s*const pi=AI, p=G\.P\[pi\];/,
           'if(!G.turn || G.turn.ended || G.ended) return;\n  const pi=G.turn.pi, p=G.P[pi];')
  .replace(/^buildStart\(\);\s*$/m, '');

const q = [];
const sandbox = {
  console,
  module: { exports: {} },
  setTimeout: (fn) => { q.push(fn); return 0; },
  __q: q,
  document: null,
  confirm: () => false,
  location: { reload(){} },
};
const vm = require('vm');
const ctx = vm.createContext(sandbox);
vm.runInContext(`
  function __fakeElFactory(){
    return { style:{}, classList:{add(){},remove(){},contains(){return false}},
      children:[], textContent:'', innerHTML:'', dataset:{},
      appendChild(c){ this.children.push(c); return c; },
      remove(){}, onclick:null, scrollTop:0, scrollHeight:0, lastChild:null };
  }
  document = { createElement: __fakeElFactory, querySelector: __fakeElFactory, body: __fakeElFactory() };
`, ctx);
vm.runInContext(patched + harness, ctx);

const { __runGames } = sandbox.module.exports;
const N = parseInt(process.argv[2] || '40', 10);
const pairs = [
  ['rookie','jieun'], ['jieun','jangpro'], ['jangpro','devil'], ['rookie','devil'],
];
for (const [a,b] of pairs) {
  const r = __runGames(N, a, { dA:a, dB:b, randomChars: true, allUniq: true });
  const pct = (r.wins[1]/N*100).toFixed(0);
  console.log(`${a.padEnd(8)} vs ${b.padEnd(8)}  →  ${b} 승률 ${pct}%  (${r.wins[0]}/${r.wins[1]}/${r.wins[2]})  평균점수 ${r.avg[0]}:${r.avg[1]}  ${r.rounds}R`);
}
console.log('OK');
