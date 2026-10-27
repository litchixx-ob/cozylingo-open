/**
 * 星图 · 学习进度可视化 —— WebGL2 实时渲染引擎（无框架纯 JS）
 *
 * 来源与授权：
 *   - 着色器与渲染参数（双高斯光晕、FBM 背景、uScale = dpr*min(w,h)/520、
 *     相机 pitch/dist、错峰入场、detectQuality 降级）源自 designfuchen/word-atlas（MIT）。
 *   - 山形布局、形体/数据解耦、两条聚合轴（话题山脊 / 海拔带）为本项目原创。
 *   - 与 CozyLingo 线上 /orchard 用的是同一份引擎，唯一差异是进度来源：
 *     线上走接口，开源版由调用方注入本机进度（见 initOrchard 的 opts.progress）。
 *
 * 状态口径：0 未学 / 2 学习中 / 3 复习中 / 4 已掌握（与 store.js 一致）
 *
 * 渲染铁律（勿改）：
 *   - 体量层必须是「纯发光点」，不能贴插画精灵
 *   - 相机近水平（pitch≈0.10），俯视会把锥体看成星系盘
 *   - 网格与点阵共用同一个 ridgeAt()，否则星光会陷进山体里
 *   - 视差/位移系数不能乘无界变量（yaw/time），否则拖久了背景会滑出画面
 */

const TOPIC_COLORS = [
  '#f2c46d', '#ef8f6b', '#8fd0c8', '#9fb8ff', '#9be38f', '#ff9fa8', '#f7d9a8', '#c6a7ff',
  '#ffd36b', '#7fc4ff', '#ffb38a', '#86e0b5', '#d8c3a5', '#b5e48c', '#ffe6b0', '#ff8fc3',
  '#a8d8ff', '#ffcf7a', '#e0b0ff', '#8fe0c0', '#ffb0a8', '#a8e0a8', '#d8c8ff', '#a8c8e8', '#96a8b8',
];

const BANDS = [
  ['雪线', '生僻 20000+'],
  ['高山', '少见 8001-2万'],
  ['山腰', '进阶 3001-8千'],
  ['丘陵', '常用 1001-3千'],
  ['山脚', '核心 1-1000'],
];

/* ---------- 着色器（照搬星图，勿重写） ---------- */
const VS = `#version 300 es
in vec3 aPos; in vec3 aColor; in float aSeed; in float aState; in float aAgg;
uniform mat4 uVP; uniform float uTime,uIntro,uScale,uHover,uMotion;
out vec3 vColor; out float vAlpha; out float vGold;
void main(){
  float t=clamp((uIntro-aSeed*0.5)/0.9,0.0,1.0);
  float e=1.0-pow(1.0-t,3.0);
  vec3 p=aPos; p.y*=e;
  p.y+=uMotion*step(0.5,aState)*sin(uTime*0.6+aSeed*30.0)*0.005;
  vec4 clip=uVP*vec4(p,1.0); gl_Position=clip;
  float tw=mix(1.0,0.72+0.28*sin(uTime*(1.0+aSeed*2.5)+aSeed*50.0),uMotion);
  float size=(5.0+aSeed*2.4)*(1.0+aAgg*0.55);
  float alpha=clamp(0.52+aAgg*0.85,0.0,1.0);
  vec3 col=mix(aColor,vec3(0.86,0.92,1.0),0.16)*(1.0+aAgg*0.75);
  if(aState>0.5){size=6.6;alpha=1.0;col=mix(aColor,vec3(1.0,0.86,0.56),0.30);}
  if(aState>1.5){size=7.8;alpha=1.00;col=mix(aColor,vec3(1.0,0.96,0.86),0.52);}
  if(aState>2.5){size=9.4;alpha=1.00;col=vec3(1.0,0.78,0.40);}
  if(abs(float(gl_VertexID)-uHover)<0.5){size*=2.2;alpha=1.0;col=vec3(1.0);}
  gl_PointSize=max(1.2,size*uScale/clip.w)*(aState>0.5?1.0:tw);
  vColor=col; vAlpha=alpha*e*(aState>0.5?mix(1.0,tw,0.3):tw);
  vGold=step(2.5,aState);
  gl_PointSize*=mix(1.0,1.7,vGold);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vColor; in float vAlpha; in float vGold;
out vec4 o;
void main(){
  vec2 c=gl_PointCoord*2.0-1.0; float d=dot(c,c);
  if(d>1.0) discard;
  float core=mix(7.0,34.0,vGold);
  float a=(exp(-d*core)+exp(-d*mix(1.5,2.6,vGold))*mix(0.62,0.85,vGold))*vAlpha;
  o=vec4(vColor*a,a);
}`;

const MTN_VS = `#version 300 es
in vec3 aPos; in vec3 aNrm; in float aH;
uniform mat4 uVP;
out vec3 vNrm; out float vH; out vec3 vPos;
void main(){ vNrm=aNrm; vH=aH; vPos=aPos; gl_Position=uVP*vec4(aPos,1.0); }`;
const MTN_FS = `#version 300 es
precision highp float;
in vec3 vNrm; in float vH; in vec3 vPos;
out vec4 o;
uniform vec3 uLight; uniform float uIntro;
void main(){
  vec3 n=normalize(vNrm);
  float lam=max(0.0,dot(n,normalize(uLight)));
  float rim=pow(1.0-max(0.0,n.z),2.2);
  vec3 low=vec3(0.055,0.085,0.075);
  vec3 mid=vec3(0.115,0.125,0.130);
  vec3 hi =vec3(0.235,0.250,0.265);
  vec3 base=mix(low,mid,smoothstep(0.0,0.55,vH));
  base=mix(base,hi,smoothstep(0.62,1.0,vH));
  vec3 col=base*(0.34+0.86*lam) + base*rim*0.55;
  col+=vec3(0.30,0.42,0.55)*rim*0.20;
  float fog=smoothstep(0.6,2.6,length(vPos));
  col=mix(col,vec3(0.030,0.045,0.070),fog*0.55);
  o=vec4(col*uIntro,1.0);
}`;

const BG_VS = `#version 300 es
const vec2 P[3]=vec2[3](vec2(-1,-1),vec2(3,-1),vec2(-1,3));
out vec2 vUv; void main(){vUv=P[gl_VertexID]*0.5+0.5;gl_Position=vec4(P[gl_VertexID],0,1);}`;
const BG_FS = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uBg;
uniform float uTime,uYaw,uAspect,uIntro,uImgAspect;
void main(){
  vec2 uv=vUv;
  if(uAspect > uImgAspect){ float k=uImgAspect/uAspect; uv.y=(uv.y-0.5)*k+0.5; }
  else                    { float k=uAspect/uImgAspect; uv.x=(uv.x-0.5)*k+0.5; }
  // 视差必须「有界」：uYaw 随拖动无限累加，直接乘系数会让背景滑出画面
  uv.x+=sin(uYaw)*0.042;
  uv.y+=sin(uYaw*0.5+1.3)*0.010;
  uv=clamp(uv,vec2(0.001),vec2(0.999));
  vec3 col=texture(uBg,uv).rgb;
  col*=0.97+0.03*sin(uTime*0.25);
  col*=mix(0.55,1.0,smoothstep(0.0,0.55,vUv.y));
  float vig=smoothstep(1.30,0.30,length((vUv-0.5)*vec2(uAspect,1.0)));
  col*=mix(0.42,1.0,vig);
  col*=0.82;
  o=vec4(col*(0.25+0.75*uIntro),1.0);
}`;

/* ---------- GL / 数学小工具 ---------- */
function sh(g, t, s) {
  const x = g.createShader(t); g.shaderSource(x, s); g.compileShader(x);
  if (!g.getShaderParameter(x, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(x));
  return x;
}
function prog(g, vs, fs) {
  const p = g.createProgram();
  g.attachShader(p, sh(g, g.VERTEX_SHADER, vs));
  g.attachShader(p, sh(g, g.FRAGMENT_SHADER, fs));
  g.linkProgram(p);
  if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error(g.getProgramInfoLog(p));
  return p;
}
function persp(f, a, n, fa) {
  const t = 1 / Math.tan(f / 2), nf = 1 / (n - fa);
  return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) * nf, -1, 0, 0, 2 * fa * n * nf, 0]);
}
function lookAt(ex, ey, ez, cx, cy, cz) {
  let zx = ex - cx, zy = ey - cy, zz = ez - cz;
  let l = Math.hypot(zx, zy, zz) || 1; zx /= l; zy /= l; zz /= l;
  let xx = zz, xy = 0, xz = -zx; l = Math.hypot(xx, xy, xz) || 1; xx /= l; xy /= l; xz /= l;
  const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx;
  return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
    -(xx * ex + xy * ey + xz * ez), -(yx * ex + yy * ey + yz * ez), -(zx * ex + zy * ey + zz * ez), 1]);
}
function mul(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
    let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
    o[c * 4 + r] = s;
  }
  return o;
}
function hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
function rand(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0; let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rgb(h) { return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255); }

/* ---------- 形体几何（网格与点阵共用，保证星光贴在山面上） ---------- */
const HSCALE = 0.90;
const RBASE = 0.86;
const RIDGES = 25, LAYERS = 44, PER_CELL = 5;
const M_SEG = 112, M_RING = 44;

function coneAt(ti, y) {
  return { cone: RBASE * (1.0 - y * 0.92), ang: (ti / RIDGES) * Math.PI * 2 + y * 2.2 };
}
function ridgeAt(ang, y) {
  let r = 1.0 + 0.055 * Math.cos(ang * 25.0 + y * 3.0);
  r += 0.030 * Math.sin(ang * 61.0 + 1.7) + 0.022 * Math.cos(ang * 17.0 - y * 5.0);
  r += 0.014 * Math.sin(ang * 113.0 + y * 9.0);
  return r;
}

const STAGE_LABEL = { 0: '未学', 2: '学习中', 3: '复习中', 4: '已掌握' };

export function initOrchard(host, opts) {
  const wordsUrl = opts.wordsUrl || 'data/orchard.json';
  const bgUrl = opts.bgUrl || 'data/bg_night.webp';
  // 开源版没有后端：进度由调用方直接注入（本机 localStorage 的学习记录）
  const progressFn = typeof opts.progress === 'function' ? opts.progress : () => ({});
  const reduced = typeof window !== 'undefined' && window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false;

  /* ---------- DOM ---------- */
  const root = document.createElement('div');
  root.className = 'oc-root';
  root.innerHTML = `
    <canvas class="oc-cv"></canvas>
    <div class="oc-topics" aria-hidden="true"></div>
    <div class="oc-hud">
      <div>
        <div class="oc-title">灵果山</div>
        <div class="oc-sub" data-role="sub">词频海拔 · 25 条话题山脊</div>
      </div>
      <div class="oc-count">
        <b data-role="lit">0</b><span> / <span data-role="tot">0</span> 已学过</span>
        <div class="oc-countsub" data-role="learned"></div>
      </div>
    </div>
    <div class="oc-panel" data-role="panel"></div>
    <button class="oc-toggle" type="button">进度</button>
    <ul class="oc-legend">
      <li><i style="background:#5a6b7d;color:#5a6b7d"></i>未学</li>
      <li><i style="background:#7fb0a0;color:#7fb0a0"></i>学习中</li>
      <li><i style="background:#c8e0a8;color:#c8e0a8"></i>复习中</li>
      <li><i style="background:#ffd98a;color:#ffd98a"></i>已掌握</li>
    </ul>
    <div class="oc-tip" data-role="tip"></div>
    <div class="oc-hint" data-role="hint">拖动旋转 · 滚轮缩放 · 悬停查看单词</div>
    <div class="oc-warn" data-role="warn"></div>`;
  host.appendChild(root);

  const $ = (r) => root.querySelector(`[data-role="${r}"]`);
  const cv = root.querySelector('.oc-cv');
  const tipEl = $('tip'), warnEl = $('warn'), hintEl = $('hint'), panelEl = $('panel');

  // 触屏没有 hover —— 提示语必须按输入方式切换，否则手机用户会照着一句做不到的话去试。
  // ⚠️ 不要只用 matchMedia('(hover: none)') 判断一次：CDP 触摸模拟的残留、能同时用鼠标和
  // 触摸的平板，都会让它判错（实测桌面被显示成「双指缩放 · 点按查看单词」）。
  // 做法：初始按媒体查询猜一个，之后**按真实 pointerType 自我纠正**。
  let inputMode = (typeof window !== 'undefined' && window.matchMedia
    && window.matchMedia('(hover: none)').matches) ? 'touch' : 'mouse';
  let hintState = 'default';   // default | anon | empty（由进度数据决定，见下方）
  function renderHint() {
    const touch = inputMode === 'touch';
    const act = touch ? '点按查看单词' : '悬停查看单词';
    if (hintState === 'anon') {
      hintEl.innerHTML = `学过的词会在这座山上点亮 · ${act}`;
    } else if (hintState === 'empty') {
      hintEl.innerHTML = `还没有学过的词 —— 去 <b>今日小课</b> 练几个，山上的星光就会亮起来 · ${act}`;
    } else {
      hintEl.textContent = `${touch ? '拖动旋转 · 双指缩放' : '拖动旋转 · 滚轮缩放'} · ${act}`;
    }
  }
  /** 见到真实指针就纠正输入方式（鼠标 / 触摸）*/
  function notePointerType(pt) {
    const next = pt === 'mouse' ? 'mouse' : 'touch';
    if (next !== inputMode) { inputMode = next; renderHint(); }
  }
  renderHint();

  const gl = cv.getContext('webgl2', {
    antialias: false, alpha: false, premultipliedAlpha: true, powerPreference: 'high-performance',
  });
  if (!gl) {
    warnEl.style.display = 'flex';
    warnEl.textContent = '此浏览器不支持 WebGL2，无法显示灵果山。请用新版 Chrome / Edge / Safari 打开。';
    return { destroy() { root.remove(); } };
  }

  const state = {
    yaw: 0.55, pitch: 0.10, dist: 2.08, tx: 0, ty: 0.40, tz: 0,
    goal: null, hoverPt: -1, hoverWord: -1, intro: -1e9, running: false,
    w: 1, h: 1, autoRot: reduced ? 0 : 0.035,
  };
  const M = {
    pos: null, color: null, seed: null, state: null, agg: null, n: 0,
    topics: null, allIdx: null, surfaceN: 0, topicProgress: null, bandProgress: null, topicCounts: null,
  };
  let learnedPt = null;   // 已学词（②层）在绘制点里的下标，用于悬停高亮

  /* ---------- 布局 ---------- */
  function layout(data, stages) {
    const ws = data.words, ARMS = data.topics.length;
    const cnt = new Array(ARMS).fill(0);
    for (const w of ws) cnt[w[1]]++;
    const avg = Math.max(1, ws.length / ARMS);

    // 聚合进度：每话题已学比例 / 每海拔带已学比例（已学 = 阶段 >= 2）
    const tTot = new Array(ARMS).fill(0), tLrn = new Array(ARMS).fill(0);
    const bTot = new Array(5).fill(0), bLrn = new Array(5).fill(0);
    for (const [w, ti, alt] of ws) {
      const st = stages[w] || 0;
      const b = Math.max(0, Math.min(4, (alt | 0) - 1));
      tTot[ti]++; bTot[b]++;
      if (st >= 2) { tLrn[ti]++; bLrn[b]++; }
    }
    const tP = tTot.map((n, i) => (n ? tLrn[i] / n : 0));
    const bP = bTot.map((n, i) => (n ? bLrn[i] / n : 0));
    M.topicProgress = tP; M.bandProgress = bP; M.topicCounts = tTot;

    const aggOf = (ti, alt) => {
      const b = Math.max(0, Math.min(4, (alt | 0) - 1));
      return Math.min(1.0, Math.sqrt(tP[ti]) * 0.95 + Math.sqrt(bP[b]) * 0.55);
    };

    const pos = [], col = [], sd = [], st = [], agg = [];
    const allIdx = [];
    learnedPt = new Map();

    // ① 形体：均匀锥面点阵（密度恒定 → 侧面投影是干净三角）
    for (let ti = 0; ti < ARMS; ti++) {
      const boost = Math.min(1.5, 0.55 + Math.sqrt(cnt[ti] / avg) * 0.75);
      const c = rgb(TOPIC_COLORS[ti % TOPIC_COLORS.length]);
      for (let l = 0; l < LAYERS; l++) {
        const y = l / (LAYERS - 1);
        const { cone, ang } = coneAt(ti, y);
        const altBand = Math.round(y * 4) + 1;
        for (let k = 0; k < PER_CELL; k++) {
          const r = rand(hash('L' + ti + '_' + l + '_' + k));
          const g = () => (r() + r() + r() - 1.5) / 1.5;
          const a2 = ang + g() * 0.10;
          const rr = cone * ridgeAt(a2, y) * 1.006;      // 贴在山面上
          pos.push(Math.cos(a2) * rr, y * HSCALE + g() * 0.006, Math.sin(a2) * rr);
          col.push(c[0] * boost, c[1] * boost, c[2] * boost);
          sd.push(r()); st.push(0); agg.push(aggOf(ti, altBand));
        }
      }
    }
    const SURFACE = st.length;
    M.surfaceN = SURFACE;

    // ② 真实已学词叠上去 → 山上的亮点
    for (let i = 0; i < ws.length; i++) {
      const [w, ti, alt] = ws[i];
      const sta = stages[w] || 0;
      if (sta < 2) continue;
      const r = rand(hash(w));
      const g = () => (r() + r() + r() - 1.5) / 1.5;
      const y = (alt - 1) / 4; const { cone, ang } = coneAt(ti, y);
      const a2 = ang + g() * 0.10;
      const rr = cone * ridgeAt(a2, y) * 1.010;
      pos.push(Math.cos(a2) * rr, y * HSCALE + 0.012, Math.sin(a2) * rr);
      const c = rgb(TOPIC_COLORS[ti % TOPIC_COLORS.length]);
      col.push(c[0], c[1], c[2]); sd.push(r()); st.push(sta); agg.push(1.0);
      learnedPt.set(w, st.length - 1);
    }

    // ③ 全量词索引（悬停查词用真实位置）
    for (let i = 0; i < ws.length; i++) {
      const [w, ti, alt] = ws[i];
      const r = rand(hash(w));
      const g = () => (r() + r() + r() - 1.5) / 1.5;
      const y = (alt - 1) / 4; const { cone, ang } = coneAt(ti, y);
      const a2 = ang + g() * 0.10;
      const rr = cone * ridgeAt(a2, y) * 1.010;
      allIdx.push({
        w, ti, alt, st: stages[w] || 0,
        x: Math.cos(a2) * rr, y: y * HSCALE, z: Math.sin(a2) * rr,
      });
    }

    M.n = st.length;
    M.pos = new Float32Array(pos); M.color = new Float32Array(col);
    M.seed = new Float32Array(sd); M.state = new Float32Array(st); M.agg = new Float32Array(agg);
    M.topics = data.topics; M.allIdx = allIdx;
  }

  /* ---------- 山体网格 ---------- */
  function buildMountain() {
    const V = [], NRM = [], Hh = [], IDX = [];
    const posOf = (si, ri) => {
      const y = ri / (M_RING - 1);
      const ang = (si / M_SEG) * Math.PI * 2;
      const cone = RBASE * (1.0 - y * 0.92);
      const rr = cone * ridgeAt(ang, y);
      return [Math.cos(ang) * rr, y * HSCALE, Math.sin(ang) * rr];
    };
    for (let ri = 0; ri < M_RING; ri++) {
      for (let si = 0; si < M_SEG; si++) {
        const p = posOf(si, ri);
        V.push(p[0], p[1], p[2]); Hh.push(ri / (M_RING - 1));
      }
    }
    for (let ri = 0; ri < M_RING - 1; ri++) {
      for (let si = 0; si < M_SEG; si++) {
        const s2 = (si + 1) % M_SEG;
        const a = ri * M_SEG + si, b = ri * M_SEG + s2, c = (ri + 1) * M_SEG + si, d = (ri + 1) * M_SEG + s2;
        IDX.push(a, c, b, b, c, d);
      }
    }
    const N = new Float32Array(V.length);
    for (let i = 0; i < IDX.length; i += 3) {
      const i0 = IDX[i] * 3, i1 = IDX[i + 1] * 3, i2 = IDX[i + 2] * 3;
      const ax = V[i1] - V[i0], ay = V[i1 + 1] - V[i0 + 1], az = V[i1 + 2] - V[i0 + 2];
      const bx = V[i2] - V[i0], by = V[i2 + 1] - V[i0 + 1], bz = V[i2 + 2] - V[i0 + 2];
      let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
      const L = Math.hypot(nx, ny, nz) || 1; nx /= L; ny /= L; nz /= L;
      for (const o3 of [i0, i1, i2]) { N[o3] += nx; N[o3 + 1] += ny; N[o3 + 2] += nz; }
    }
    for (let i = 0; i < N.length; i += 3) {
      const L = Math.hypot(N[i], N[i + 1], N[i + 2]) || 1;
      N[i] /= L; N[i + 1] /= L; N[i + 2] /= L;
    }
    return { pos: new Float32Array(V), nrm: N, h: new Float32Array(Hh), idx: new Uint32Array(IDX), count: IDX.length };
  }

  let pS = null, pB = null, pM = null, vaoS = null, vaoB = null, vaoM = null, MTN = null, bgTex = null;
  let BG_ASPECT = 16 / 9;

  function initGL(bgImg) {
    pS = prog(gl, VS, FS); pB = prog(gl, BG_VS, BG_FS);
    vaoB = gl.createVertexArray(); vaoS = gl.createVertexArray();
    gl.bindVertexArray(vaoS);
    const attr = (name, data, size) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pS, name);
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    attr('aPos', M.pos, 3); attr('aColor', M.color, 3); attr('aSeed', M.seed, 1);
    attr('aState', M.state, 1); attr('aAgg', M.agg, 1);
    gl.bindVertexArray(null);

    MTN = buildMountain();
    pM = prog(gl, MTN_VS, MTN_FS); vaoM = gl.createVertexArray();
    gl.bindVertexArray(vaoM);
    const mAttr = (name, data, size) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const l = gl.getAttribLocation(pM, name);
      gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0);
    };
    mAttr('aPos', MTN.pos, 3); mAttr('aNrm', MTN.nrm, 3); mAttr('aH', MTN.h, 1);
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, MTN.idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);

    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0.03, 0.043, 0.07, 1);

    if (bgImg) {
      BG_ASPECT = bgImg.naturalWidth / bgImg.naturalHeight;
      bgTex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, bgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bgImg);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
  }

  function resize() {
    const r = cv.getBoundingClientRect();
    state.w = Math.max(1, r.width); state.h = Math.max(1, r.height);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    cv.width = Math.round(state.w * dpr); cv.height = Math.round(state.h * dpr);
  }
  function baseDist() { const a = state.w / state.h; return a < 1 ? (2.08 / Math.max(0.55, a)) * 0.82 : 2.08; }

  /* ---------- 悬停拾取：对全量词建屏幕索引 ---------- */
  let wordScreen = null;   // Float32Array(allIdx.length*3)，x,y,可见性
  function buildWordScreen(vp) {
    const S = new Float32Array(M.allIdx.length * 3);
    for (let i = 0; i < M.allIdx.length; i++) {
      const o = M.allIdx[i];
      const cw = vp[3] * o.x + vp[7] * o.y + vp[11] * o.z + vp[15];
      if (cw <= 0.02) { S[i * 3] = -1e5; S[i * 3 + 1] = -1e5; continue; }
      const cx = vp[0] * o.x + vp[4] * o.y + vp[8] * o.z + vp[12];
      const cy = vp[1] * o.x + vp[5] * o.y + vp[9] * o.z + vp[13];
      S[i * 3] = (cx / cw * 0.5 + 0.5) * cv.width;
      S[i * 3 + 1] = (1 - (cy / cw * 0.5 + 0.5)) * cv.height;
    }
    wordScreen = S;
  }
  /** 屏幕坐标命中：半径按「CSS 像素」给，再换算到缓冲区坐标。
   *  ⚠️ 原来固定用 30（缓冲区像素）—— 而 dpr 被限制到 2，手机上的实际容差只有 15 CSS px，
   *  手指点不准（鼠标 15px 还凑合，触摸就太苛刻）。触屏调用时给更大的半径。*/
  function pick(px, py, radiusCss) {
    if (!wordScreen) return -1;
    const dprUsed = cv.width / (state.w || cv.clientWidth || cv.width) || 1;
    const R = (radiusCss || 26) * dprUsed;
    let best = -1, bd = R * R, bs = -1;
    const S = wordScreen;
    for (let i = 0; i < M.allIdx.length; i++) {
      const dx = S[i * 3] - px, dy = S[i * 3 + 1] - py, d = dx * dx + dy * dy;
      if (d < bd) { if (M.allIdx[i].st >= bs) { bd = d; bs = M.allIdx[i].st; best = i; } }
    }
    return best;
  }

  /* ---------- 渲染循环 ---------- */
  let rafId = 0, last = 0, __fc = 0, drag = null, lastVP = null;
  const ptrs = new Map();
  let pinch = null;

  function frame(now) {
    if (!state.running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016); last = now;
    if (state.goal) {
      for (const k in state.goal) state[k] += (state.goal[k] - state[k]) * Math.min(1, dt * 4.2);
      if (Math.abs(state.goal.dist - state.dist) < 0.003) state.goal = null;
    } else if (state.autoRot) state.yaw += state.autoRot * dt;

    gl.viewport(0, 0, cv.width, cv.height);
    const aspect = state.w / state.h;
    const vp = mul(persp(0.75, aspect, 0.02, 20),
      lookAt(state.tx + state.dist * Math.cos(state.pitch) * Math.sin(state.yaw),
        state.ty + state.dist * Math.sin(state.pitch),
        state.tz + state.dist * Math.cos(state.pitch) * Math.cos(state.yaw),
        state.tx, state.ty, state.tz));
    lastVP = vp;
    const intro = (now - state.intro) / 1000;

    // 背景
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(pB); gl.bindVertexArray(vaoB);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, bgTex);
    gl.uniform1i(gl.getUniformLocation(pB, 'uBg'), 1);
    gl.uniform1f(gl.getUniformLocation(pB, 'uImgAspect'), BG_ASPECT);
    gl.uniform1f(gl.getUniformLocation(pB, 'uTime'), now / 1000);
    gl.uniform1f(gl.getUniformLocation(pB, 'uYaw'), state.yaw);
    gl.uniform1f(gl.getUniformLocation(pB, 'uAspect'), aspect);
    gl.uniform1f(gl.getUniformLocation(pB, 'uIntro'), Math.min(1, intro / 1.1));
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    // 山体（实心载体，写深度）
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.depthFunc(gl.LESS);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.useProgram(pM); gl.bindVertexArray(vaoM);
    gl.uniformMatrix4fv(gl.getUniformLocation(pM, 'uVP'), false, vp);
    gl.uniform3f(gl.getUniformLocation(pM, 'uLight'), -0.45, 0.72, 0.53);
    gl.uniform1f(gl.getUniformLocation(pM, 'uIntro'), Math.min(1, intro / 1.1));
    gl.drawElements(gl.TRIANGLES, MTN.count, gl.UNSIGNED_INT, 0);

    // 星光（贴在山面上：只测深度不写）
    gl.depthMask(false);
    gl.useProgram(pS); gl.bindVertexArray(vaoS);
    gl.uniformMatrix4fv(gl.getUniformLocation(pS, 'uVP'), false, vp);
    gl.uniform1f(gl.getUniformLocation(pS, 'uTime'), now / 1000);
    gl.uniform1f(gl.getUniformLocation(pS, 'uIntro'), Math.min(1, intro / 1.3));
    const dprS = Math.min(window.devicePixelRatio || 1, 2);
    gl.uniform1f(gl.getUniformLocation(pS, 'uScale'), dprS * Math.min(cv.width, cv.height) / 520);
    gl.uniform1f(gl.getUniformLocation(pS, 'uHover'), state.hoverPt);
    gl.uniform1f(gl.getUniformLocation(pS, 'uMotion'), reduced ? 0.0 : 1.0);
    gl.drawArrays(gl.POINTS, 0, M.n);
    gl.bindVertexArray(null);

    updateTopicLabels(vp);
    if ((++__fc % 6 === 0) && !drag) buildWordScreen(vp);
    rafId = requestAnimationFrame(frame);
  }

  const labelEls = [];
  function updateTopicLabels(vp) {
    if (!labelEls.length) return;
    const ARMS = M.topics.length, mid = 0.62;
    for (let t = 0; t < ARMS; t++) {
      const y = mid, cone = 1.0 - y * 0.82, rr = cone * 1.02;
      const ang = (t / ARMS) * Math.PI * 2 + y * 2.4;
      const x = Math.cos(ang) * rr, yy = y * HSCALE, z = Math.sin(ang) * rr;
      const cw = vp[3] * x + vp[7] * yy + vp[11] * z + vp[15];
      const el = labelEls[t]; if (!el) continue;
      if (cw <= 0.05) { el.style.opacity = '0'; continue; }
      const cx = vp[0] * x + vp[4] * yy + vp[8] * z + vp[12];
      const cy = vp[1] * x + vp[5] * yy + vp[9] * z + vp[13];
      const sx = (cx / cw * 0.5 + 0.5) * state.w, sy = (1 - (cy / cw * 0.5 + 0.5)) * state.h;
      el.style.transform = `translate(${sx}px,${sy}px) translate(-50%,-50%)`;
      el.style.color = TOPIC_COLORS[t % TOPIC_COLORS.length];
      el.style.opacity = String(Math.max(0, Math.min(0.9, (1.0 - cw / 2.9) * 1.6)));
    }
  }

  /* ---------- 交互 ---------- */
  const local = (e) => { const r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const ptrDist = () => {
    const a = [...ptrs.values()];
    return a.length < 2 ? 0 : Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
  };
  // 触屏没有 hover —— 手机靠「点按」查词。这里记录按下点，抬指时判断是否算一次点按。
  let tapInfo = null;
  const TAP_MS = 450;      // 超过这个时长算长按，不查词
  const TAP_SLOP = 12;     // 移动超过这个距离算拖动，不查词

  /** 查词 + 浮窗：鼠标走 hover 贴光标；触屏走点按、浮窗钉在底部中间（不被手指挡住）*/
  function showWordAt(p, touch) {
    const r = cv.getBoundingClientRect();
    const px = (p.x / r.width) * cv.width, py = (p.y / r.height) * cv.height;
    // 触屏用更大的命中半径（手指比鼠标粗；dpr 换算在 pick 里做）
    const wi = pick(px, py, touch ? 40 : 26);
    // 只在「换了词」或浮窗原本是隐藏的 时才改 DOM —— 鼠标 hover 每帧都会调这里，
    // 无脑重写 innerHTML 会让每次移动都触发一遍解析+布局
    const changed = wi !== state.hoverWord || tipEl.style.display === 'none';
    state.hoverWord = wi;
    if (wi < 0) {
      state.hoverPt = -1;
      tipEl.style.display = 'none';
      return;
    }
    const o = M.allIdx[wi];
    // 高亮：已学词高亮它自己那个点；未学词高亮同山脊同层最近的形体点
    const lp = learnedPt.get(o.w);
    state.hoverPt = lp !== undefined ? lp
      : (o.ti * LAYERS + Math.round(((o.alt - 1) / 4) * (LAYERS - 1))) * PER_CELL;
    if (changed) {
      tipEl.innerHTML = `<b>${escapeHtml(o.w)}</b><small>${escapeHtml(M.topics[o.ti] || '')} · 海拔 ${o.alt}/5 · ${STAGE_LABEL[o.st] || '未学'}</small>`;
    }
    tipEl.style.display = 'block';
    if (touch) {
      // 位置交给 CSS（底部居中），清掉鼠标那次留下的内联坐标
      tipEl.classList.add('oc-tip-touch');
      tipEl.style.left = '';
      tipEl.style.top = '';
    } else {
      tipEl.classList.remove('oc-tip-touch');
      tipEl.style.left = Math.min(p.x + 16, r.width - 210) + 'px';
      tipEl.style.top = Math.max(8, p.y - 54) + 'px';
    }
  }

  function onDown(e) {
    notePointerType(e.pointerType);
    cv.setPointerCapture(e.pointerId);
    ptrs.set(e.pointerId, local(e));
    state.autoRot = 0;
    if (ptrs.size === 1) {
      drag = { x: local(e).x, y: local(e).y };
      tapInfo = { id: e.pointerId, x: drag.x, y: drag.y, t: Date.now() };
      cv.classList.add('oc-dragging');
    } else if (ptrs.size === 2) {
      drag = null;
      tapInfo = null;                       // 双指 = 缩放，不是点按
      pinch = { d: ptrDist(), dist: state.dist };
    }
  }
  function onMove(e) {
    notePointerType(e.pointerType);
    const p = local(e);
    if (ptrs.has(e.pointerId)) {
      ptrs.set(e.pointerId, p);
      if (ptrs.size >= 2 && pinch) {
        const d = ptrDist();
        if (pinch.d > 4 && d > 4) state.dist = Math.max(0.6, Math.min(9, pinch.dist * (pinch.d / d)));
        return;
      }
      if (drag) {
        const dx = p.x - drag.x, dy = p.y - drag.y;
        state.yaw += dx * 0.006;
        state.pitch = Math.max(-0.12, Math.min(1.30, state.pitch + dy * 0.005));
        drag.x = p.x; drag.y = p.y; if (state.goal) state.goal = null;
        return;
      }
    }
    // 悬停查词：鼠标「未按下」也要工作（原型的 ptrs 守卫让纯悬停永远不触发，已修）
    if (e.pointerType !== 'mouse' || drag) return;
    showWordAt(p, false);
  }
  function endPtr(e) {
    const info = tapInfo && tapInfo.id === e.pointerId ? tapInfo : null;
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (ptrs.size === 0) { drag = null; cv.classList.remove('oc-dragging'); }
    else if (ptrs.size === 1) { const a = [...ptrs.values()][0]; drag = { x: a.x, y: a.y }; }
    if (!info) return;
    tapInfo = null;
    if (e.pointerType === 'mouse') return;               // 鼠标有 hover，不必点按
    if (Date.now() - info.t > TAP_MS) return;            // 长按不算
    const p = local(e);
    if (Math.hypot(p.x - info.x, p.y - info.y) > TAP_SLOP) return;  // 拖过不算
    showWordAt(p, true);
  }
  function onLeave(e) {
    if (e.pointerType !== 'mouse') return;
    ptrs.delete(e.pointerId); drag = null; pinch = null;
    state.hoverWord = -1; state.hoverPt = -1;
    tipEl.style.display = 'none'; cv.classList.remove('oc-dragging');
  }
  function onWheel(e) {
    e.preventDefault();
    state.dist = Math.max(0.6, Math.min(9, state.dist * (e.deltaY > 0 ? 1.09 : 0.92)));
  }
  function onResize() { resize(); if (state.goal) state.goal.dist = baseDist(); else state.dist = baseDist(); }

  cv.addEventListener('pointerdown', onDown);
  cv.addEventListener('pointermove', onMove);
  cv.addEventListener('pointerup', endPtr);
  cv.addEventListener('pointercancel', endPtr);
  cv.addEventListener('pointerleave', onLeave);
  cv.addEventListener('wheel', onWheel, { passive: false });
  const toggleBtn = root.querySelector('.oc-toggle');
  const onToggle = () => root.classList.toggle('oc-open');
  toggleBtn.addEventListener('click', onToggle);
  window.addEventListener('resize', onResize);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null;
  if (ro) ro.observe(host);

  /* ---------- 面板 / HUD ---------- */
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const pct = (v) => `${Math.round(v * 100)}%`;

  function renderPanel() {
    const bP = M.bandProgress || [], tP = M.topicProgress || [];
    // 海拔带（从山顶到山脚）
    const bandRows = BANDS.map(([n, s], i) => {
      const idx = 4 - i;                       // 雪线=4 … 山脚=0
      const v = bP[idx] || 0;
      return `<li><span class="oc-pn">${n}<em>${s}</em></span>
        <span class="oc-pb"><i style="width:${Math.min(100, v * 100).toFixed(1)}%"></i></span>
        <span class="oc-pv">${pct(v)}</span></li>`;
    }).join('');
    // 话题：按进度排序取前 5（有进度的才排前）
    const top = M.topics.map((t, i) => ({ t, i, v: tP[i] || 0, n: M.topicCounts ? M.topicCounts[i] : 0 }))
      .sort((a, b) => b.v - a.v).slice(0, 5)
      .map((o) => `<li><span class="oc-pn"><i class="oc-dot" style="background:${TOPIC_COLORS[o.i % TOPIC_COLORS.length]}"></i>${o.t}<em>${o.n} 词</em></span>
        <span class="oc-pb"><i style="width:${Math.min(100, o.v * 100).toFixed(1)}%;background:${TOPIC_COLORS[o.i % TOPIC_COLORS.length]}"></i></span>
        <span class="oc-pv">${pct(o.v)}</span></li>`).join('');
    panelEl.innerHTML = `<div class="oc-ph">海拔带</div><ul class="oc-pl">${bandRows}</ul>
      <div class="oc-ph">话题进度</div><ul class="oc-pl">${top}</ul>`;
  }

  function renderTopicLabels(topics) {
    const box = root.querySelector('.oc-topics');
    box.innerHTML = ''; labelEls.length = 0;
    topics.forEach((t) => {
      const s = document.createElement('span'); s.textContent = t;
      box.appendChild(s); labelEls.push(s);
    });
  }

  /* ---------- 启动 ---------- */
  let destroyed = false;
  (async () => {
    const [data, bgImg] = await Promise.all([
      fetch(wordsUrl, { cache: 'force-cache' }).then((r) => r.json()),
      new Promise((res) => {
        const im = new Image();
        im.onload = () => res(im); im.onerror = () => res(null);
        im.src = bgUrl;
      }),
    ]);
    if (destroyed) return;
    const prog = { words: progressFn() || {}, loggedIn: true };

    const stages = prog && prog.words ? prog.words : {};
    layout(data, stages);
    resize(); state.dist = baseDist();
    initGL(bgImg);
    renderTopicLabels(data.topics);
    renderPanel();

    const total = data.words.length;
    let learned = 0, mastered = 0;
    for (const w of data.words) {
      const st = stages[w[0]] || 0;
      if (st >= 2) learned++;
      if (st >= 4) mastered++;
    }
    const loggedIn = prog && prog.loggedIn === true;
    // 大字用「已学过」（= 阶段≥2），因为它先长起来；已掌握放在副行
    root.querySelector('[data-role="tot"]').textContent = total.toLocaleString();
    root.querySelector('[data-role="lit"]').textContent = learned.toLocaleString();
    root.querySelector('[data-role="learned"]').textContent = !loggedIn
      ? '登录后显示你的进度'
      : `其中已掌握 ${mastered.toLocaleString()} 个`;
    root.querySelector('[data-role="sub"]').textContent =
      `CozyLingo Open ${total.toLocaleString()} 词 · 词频海拔 · 话题山脊`;

    hintState = !loggedIn ? 'anon' : (learned === 0 ? 'empty' : 'default');
    renderHint();

    state.intro = performance.now(); state.running = true; last = performance.now();
    rafId = requestAnimationFrame(frame);

    // 调试出口（QA / 客观自检用；与原型一致，始终挂上，无副作用）
    window.__orchard = {
      state, M, pick, buildWordScreen, root, canvas: cv,
      get wordScreen() { return wordScreen; },
      get vp() { return lastVP; },          // 渲染用的同一个视图投影矩阵
    };
  })().catch((e) => {
    warnEl.style.display = 'flex';
    warnEl.textContent = '灵果山加载失败：' + (e && e.message ? e.message : e);
  });

  return {
    destroy() {
      destroyed = true;
      state.running = false;
      if (rafId) cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      if (ro) ro.disconnect();
      cv.removeEventListener('pointerdown', onDown);
      cv.removeEventListener('pointermove', onMove);
      cv.removeEventListener('pointerup', endPtr);
      cv.removeEventListener('pointercancel', endPtr);
      cv.removeEventListener('pointerleave', onLeave);
      cv.removeEventListener('wheel', onWheel);
      try {
        if (gl) {
          const lose = gl.getExtension('WEBGL_lose_context');
          if (lose) lose.loseContext();
        }
      } catch { /* ignore */ }
      root.remove();
    },
  };
}
