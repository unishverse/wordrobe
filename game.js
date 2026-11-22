/* Bibo's Fabric Quest. Loaded only when the Game tab is first opened (index.html adds this script on demand).
   Part 1: pure engine (no DOM, also loaded by tests/test-game.js in Node). Part 2: UI. */
const Engine = (function () {
  const V = {};
  [['aeiou', 1], ['rstln', 1], ['dg', 2], ['bcmp', 3], ['fhvwy', 4], ['k', 5], ['jx', 8], ['qz', 10]]
    .forEach(([s, v]) => { for (const c of s) V[c] = v; });
  const LB = { 3: 0, 4: 2, 5: 5, 6: 10, 7: 15, 8: 22, 9: 30 };
  const VOW = 'aeiou';
  const BAG = { e: 12, a: 9, i: 9, o: 8, n: 6, r: 6, t: 6, l: 4, s: 4, u: 4, d: 4, g: 3, b: 2, c: 2, m: 2, p: 2, f: 2, h: 2, v: 2, w: 2, y: 2, k: 1, j: 1, x: 1, q: 1, z: 1 };
  const CFG = {
    hand: 8, supply: 24, slots: 5, discards: 3, letterMul: 3, lenMul: 3, addMul: 3,
    base: 60, growth: 1.8, ramp: 0.08, roundMul: [1, 1.3, 1.6], // endless: target = base * growth^stage * (1 + ramp*stage) * roundMul
    coinRound: 3, price: { fabric: 6, gold: 4, glass: 6, supply: 3, letter: 4, reroll: 2 }, supplyPack: 3, handMaxBuys: 1
  };
  const FABRICS = [
    { id: 'long', name: 'Long Stitch', icon: '🧵', desc: 'Kata 6+ huruf ×2.', kind: 'mult' },
    { id: 'double', name: 'Double Stitch', icon: '🪡', desc: 'Kata dengan huruf kembar +' + 15 * CFG.addMul + '.', kind: 'add' },
    { id: 'short', name: 'Short & Sweet', icon: '🍬', desc: 'Kata 3 huruf +' + 10 * CFG.addMul + '.', kind: 'add' },
    { id: 'chain', name: 'Word Chain', icon: '⛓️', desc: 'Kata 5+ huruf berturut-turut menaikkan pengali: ×1,5 di kata ke-2, +0,5 tiap kata lagi, maks ×3. Putus kalau kata < 5 huruf.', kind: 'mult' },
    { id: 'velvet', name: 'Vowel Velvet', icon: '🟣', desc: 'Tiap huruf vokal +' + 3 * CFG.addMul + '.', kind: 'add' },
    { id: 'rare', name: 'Rare Thread', icon: '💎', desc: 'Kata berisi J, Q, X, atau Z +' + 20 * CFG.addMul + '.', kind: 'add' },
    { id: 'club', name: 'Consonant Club', icon: '🎩', desc: 'Tiap konsonan +' + 2 * CFG.addMul + '.', kind: 'add' },
    { id: 'golden', name: 'Golden Weave', icon: '🌟', desc: 'Kata berisi huruf E ×1,5.', kind: 'mult' },
    { id: 'first', name: 'First Impression', icon: '👋', desc: 'Kata valid pertama tiap ronde ×3.', kind: 'mult' },
    { id: 'jackpot', name: 'Jackpot', icon: '🎰', desc: '20% peluang skor kata ×2.', kind: 'chance' },
    { id: 'refill', name: 'Refill Master', icon: '🔄', desc: 'Sekali per ronde: kata 5+ huruf menarik 1 huruf ekstra (tangan sementara +1).', kind: 'util' },
    { id: 'saver', name: 'Saver', icon: '🐷', desc: '+1 koin tiap 3 huruf sisa saat ronde selesai.', kind: 'util' },
    { id: 'recycler', name: 'Recycler', icon: '♻️', desc: '20% peluang 1 huruf terpakai kembali ke supply.', kind: 'util' },
    { id: 'thread7', name: 'Thread Count', icon: '7️⃣', desc: 'Kata 7 huruf +' + 30 * CFG.addMul + '.', kind: 'add' },
    { id: 'patch', name: 'Patchwork', icon: '🧩', desc: 'Kata dengan 3+ vokal berbeda ×2.', kind: 'mult' }
  ];
  const FAB = {}; FABRICS.forEach(f => FAB[f.id] = f);
  const BOSSES = [
    { id: 'minimal', name: 'The Minimalist', desc: 'Kata minimal 5 huruf.' },
    { id: 'silent', name: 'The Silent One', desc: 'Satu huruf terkunci dan tidak bisa dipakai.', pick: 'dlnrst' },
    { id: 'repeater', name: 'The Repeater', desc: 'Kata tanpa huruf kembar hanya dapat 50% skor.' },
    { id: 'short', name: 'The Short Cutter', desc: 'Kata lebih dari 5 huruf tidak dapat bonus panjang.' },
    { id: 'vthief', name: 'The Vowel Thief', desc: 'Satu huruf vokal terkunci dan tidak bisa dipakai.', pick: 'aeiou' }
  ];

  let DICT = new Set(), ARR = [];
  function setDict(words) {
    ARR = words.filter(w => w.length >= 3 && w.length <= 9 && /[aeiouy]/.test(w));
    DICT = new Set(ARR);
  }
  const isWord = w => DICT.has(w);

  function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  let UID = 1;
  const mk = (ch, up) => ({ id: UID++, ch, up: up || null });
  function randLetter(rng) {
    const all = []; for (const c in BAG) for (let i = 0; i < BAG[c]; i++) all.push(c);
    return all[Math.floor(rng() * all.length)];
  }

  function val(t) { return V[t.ch] * CFG.letterMul * (t.up === 'gold' ? 2 : t.up === 'glass' ? 3 : 1); }
  function score(tiles, fab, ctx, boss, rng) {
    const w = tiles.map(t => t.ch).join(''), n = w.length, has = id => fab.includes(id);
    const lv = tiles.map(t => val(t));
    const letters = lv.reduce((a, b) => a + b, 0);
    let lenBonus = (LB[n] || 0) * CFG.lenMul;
    if (boss && boss.id === 'short' && n > 5) lenBonus = 0;
    const adds = [], mults = [];
    const vow = [...w].filter(c => VOW.includes(c)), con = n - vow.length;
    const rep = new Set(w).size < n;
    if (has('double') && rep) adds.push({ id: 'double', v: 15 * CFG.addMul });
    if (has('short') && n === 3) adds.push({ id: 'short', v: 10 * CFG.addMul });
    if (has('velvet') && vow.length) adds.push({ id: 'velvet', v: 3 * CFG.addMul * vow.length });
    if (has('rare') && /[jqxz]/.test(w)) adds.push({ id: 'rare', v: 20 * CFG.addMul });
    if (has('club') && con) adds.push({ id: 'club', v: 2 * CFG.addMul * con });
    if (has('thread7') && n === 7) adds.push({ id: 'thread7', v: 30 * CFG.addMul });
    if (has('long') && n >= 6) mults.push({ id: 'long', v: 2 });
    if (has('golden') && w.includes('e')) mults.push({ id: 'golden', v: 1.5 });
    if (has('first') && ctx.first) mults.push({ id: 'first', v: 3 });
    if (has('patch') && new Set(vow).size >= 3) mults.push({ id: 'patch', v: 2 });
    if (has('chain') && n >= 5) { const k = ctx.chain + 1; if (k >= 2) mults.push({ id: 'chain', v: Math.min(3, 1 + 0.5 * (k - 1)) }); }
    let bossHalf = false;
    if (boss && boss.id === 'repeater' && !rep) bossHalf = true;
    const addSum = adds.reduce((a, x) => a + x.v, 0);
    let mult = mults.reduce((a, x) => a * x.v, 1);
    if (bossHalf) mult *= 0.5;
    let jackpot = null;
    if (has('jackpot')) { jackpot = rng() < 0.2; if (jackpot) mult *= 2; }
    const subtotal = letters + lenBonus + addSum;
    return { word: w, lv, letters, lenBonus, adds, mults, bossHalf, jackpot, subtotal, mult, final: Math.round(subtotal * mult) };
  }

  const blocked = (R, t) => !!(R.boss && R.boss.block && t.ch === R.boss.block);
  function counts(tiles) { const c = {}; tiles.forEach(t => c[t.ch] = (c[t.ch] || 0) + 1); return c; }
  function bossOK(R, w) { return !(R.boss && R.boss.id === 'minimal' && w.length < 5); }
  function candidates(R) {
    const usable = R.hand.filter(t => !blocked(R, t)), c = counts(usable), out = [];
    for (const w of ARR) {
      if (w.length > usable.length || !bossOK(R, w)) continue;
      const need = {}; let ok = true;
      for (const ch of w) { need[ch] = (need[ch] || 0) + 1; if (need[ch] > (c[ch] || 0)) { ok = false; break; } }
      if (ok) out.push(w);
    }
    return out;
  }
  // pick tiles for a word, preferring higher-multiplier (upgraded) tiles
  function tilesFor(R, w) {
    const pool = R.hand.filter(t => !blocked(R, t)).slice().sort((a, b) => (b.up ? 1 : 0) - (a.up ? 1 : 0));
    const used = new Set(), out = [];
    for (const ch of w) { const t = pool.find(t => t.ch === ch && !used.has(t.id)); if (!t) return null; used.add(t.id); out.push(t); }
    return out;
  }
  function best(G, R) {
    let b = null; const nr = () => 0.99;
    for (const w of candidates(R)) {
      const tl = tilesFor(R, w); if (!tl) continue;
      const s = score(tl, G.fabrics, { first: !R.firstDone, chain: R.chain }, R.boss, nr);
      if (!b || s.final > b.s.final) b = { w, tl, s };
    }
    return b;
  }

  function newGame(starterId) {
    return { stage: 0, rnd: 0, fabrics: starterId ? [starterId] : [], upgrades: [], coins: 0, extra: 0, letterAdds: [], handBonus: 0, discardBonus: 0, bosses: [],
      stats: { words: 0, longest: '', best: { w: '', s: 0 }, total: 0, list: [] } };
  }
  const roundIndex = G => G.stage * 3 + G.rnd;
  function targetFor(stage, rnd) { const b = CFG.base * Math.pow(CFG.growth, stage) * (1 + CFG.ramp * stage) * CFG.roundMul[rnd]; return Math.round(b / 10) * 10 || 10; }
  function pickBoss(G, rng) {
    let left = BOSSES.filter(b => !G.bosses.includes(b.id));
    if (!left.length) { G.bosses = []; left = BOSSES.slice(); }
    const b = left[Math.floor(rng() * left.length)];
    G.bosses.push(b.id);
    const o = { id: b.id, name: b.name, desc: b.desc };
    if (b.pick) o.block = b.pick[Math.floor(rng() * b.pick.length)];
    return o;
  }
  const handSize = G => CFG.hand + G.handBonus;
  function makeRound(G, rng) {
    const hs = handSize(G);
    const total = hs + CFG.supply + G.extra + G.letterAdds.length;
    const bag = []; for (const c in BAG) for (let i = 0; i < BAG[c]; i++) bag.push(c);
    shuffle(bag, rng);
    const tiles = bag.slice(0, Math.max(0, total - G.upgrades.length - G.letterAdds.length)).map(c => mk(c));
    G.letterAdds.forEach(c => tiles.push(mk(c)));
    G.upgrades.forEach(u => tiles.push(u));
    shuffle(tiles, rng);
    const isBoss = G.rnd === 2;
    return { target: targetFor(G.stage, G.rnd), score: 0, handSize: hs, hand: tiles.slice(0, hs), supply: tiles.slice(hs),
      words: 0, firstDone: false, chain: 0, refillUsed: false, discards: CFG.discards + G.discardBonus, maxDiscards: CFG.discards + G.discardBonus, boss: isBoss ? pickBoss(G, rng) : null };
  }
  function draw(R, upTo) { while (R.hand.length < upTo && R.supply.length) R.hand.push(R.supply.shift()); }

  // submit tiles in order; returns {ok,msg} or {ok,res,won}
  function submit(G, R, tl, rng) {
    const w = tl.map(t => t.ch).join('');
    if (w.length < 3) return { ok: false, msg: 'Minimal 3 huruf.' };
    if (!bossOK(R, w)) return { ok: false, msg: R.boss.name + ': minimal 5 huruf.' };
    if (!isWord(w)) return { ok: false, msg: '“' + w.toUpperCase() + '” belum ada di kamus.' };
    const res = score(tl, G.fabrics, { first: !R.firstDone, chain: R.chain }, R.boss, rng);
    R.score += res.final; R.words++; R.firstDone = true;
    R.chain = w.length >= 5 ? R.chain + 1 : 0;
    const ids = new Set(tl.map(t => t.id));
    R.hand = R.hand.filter(t => !ids.has(t.id));
    G.upgrades = G.upgrades.filter(u => !ids.has(u.id));
    const st = G.stats; st.words++; st.total += res.final;
    if (w.length > st.longest.length) st.longest = w;
    if (res.final > st.best.s) st.best = { w, s: res.final };
    st.list.push({ w, s: res.final });
    let recycled = null;
    if (G.fabrics.includes('recycler') && rng() < 0.2) {
      const t = tl[Math.floor(rng() * tl.length)];
      R.supply.splice(Math.floor(rng() * (R.supply.length + 1)), 0, mk(t.ch)); recycled = t.ch;
    }
    draw(R, R.handSize);
    let extra = false;
    if (G.fabrics.includes('refill') && !R.refillUsed && w.length >= 5 && R.supply.length) {
      R.hand.push(R.supply.shift()); R.refillUsed = true; extra = true;
    }
    res.recycled = recycled; res.extraDraw = extra;
    return { ok: true, res, won: R.score >= R.target };
  }
  const stuck = R => candidates(R).length === 0;
  const failed = (G, R) => R.score < R.target && stuck(R) && (R.supply.length === 0 || R.discards === 0);
  // Balatro-style discard: limited per round; tiles vanish for this round, supply refills the hand.
  // Upgraded tiles are not lost: they stay in G.upgrades and come back next round.
  function canDiscard(R) { return R.discards > 0 && R.supply.length > 0; }
  function discard(G, R, tl) {
    if (!canDiscard(R) || !tl.length) return false;
    const ids = new Set(tl.map(t => t.id));
    R.hand = R.hand.filter(t => !ids.has(t.id)); R.discards--;
    draw(R, R.handSize); return true;
  }
  function finishRound(G, R) {
    let coins = CFG.coinRound + G.stage, saver = 0;
    if (G.fabrics.includes('saver')) saver = Math.floor((R.hand.length + R.supply.length) / 3);
    G.coins += coins + saver; return { coins, saver };
  }
  function rewardOptions(G, rng) {
    const owned = new Set(G.fabrics), pool = FABRICS.filter(f => !owned.has(f.id));
    const opts = [];
    const kinds = shuffle(['fabric', 'fabric', 'up', 'coin'], rng);
    for (const k of kinds) {
      if (opts.length >= 3) break;
      if (k === 'fabric') { const f = pool.filter(f => !opts.some(o => o.id === f.id))[Math.floor(rng() * pool.length)]; if (f) opts.push({ type: 'fabric', id: f.id }); }
      else if (k === 'up') opts.push({ type: 'up', kind: rng() < 0.5 ? 'gold' : 'glass', ch: randLetter(rng) });
      else opts.push({ type: 'coin', n: 6 });
    }
    while (opts.length < 3) opts.push(rng() < 0.6 ? { type: 'up', kind: rng() < 0.5 ? 'gold' : 'glass', ch: randLetter(rng) } : { type: 'coin', n: 6 + G.stage });
    return opts;
  }
  function shopItems(G, rng) {
    const owned = new Set(G.fabrics), pool = shuffle(FABRICS.filter(f => !owned.has(f.id)), rng);
    const items = [];
    pool.slice(0, 2).forEach(f => items.push({ type: 'fabric', id: f.id, price: CFG.price.fabric }));
    const kind = rng() < 0.5 ? 'gold' : 'glass';
    items.push({ type: 'up', kind, ch: randLetter(rng), price: CFG.price[kind] });
    items.push({ type: 'letter', ch: randLetter(rng), price: CFG.price.letter });
    return items;
  }
  // always-available permanent upgrades; price rises with each purchase
  function permItems(G) {
    const out = [];
    out.push({ type: 'supply', n: CFG.supplyPack, price: CFG.price.supply + Math.floor(G.extra / CFG.supplyPack) });
    out.push({ type: 'discard', price: 6 + 3 * G.discardBonus });
    out.push({ type: 'hand', price: 8 + 4 * G.handBonus, maxed: G.handBonus >= CFG.handMaxBuys });
    return out;
  }
  function addUpgrade(G, kind, ch) { G.upgrades.push(mk(ch, kind)); }
  // after restoring a saved run: new tile ids must not collide with the restored ones
  function resumeIds(G, R) { let m = 0; const see = t => { if (t.id > m) m = t.id; }; G.upgrades.forEach(see); if (R) { R.hand.forEach(see); R.supply.forEach(see); } if (m >= UID) UID = m + 1; }
  return { val, V, LB, CFG, FABRICS, FAB, BOSSES, setDict, isWord, rngFrom, shuffle, mk, score, blocked, candidates, tilesFor, best, newGame,
    roundIndex, targetFor, handSize, permItems, makeRound, draw, submit, stuck, failed, discard, canDiscard, finishRound, rewardOptions, shopItems, addUpgrade, resumeIds, randLetter, get ARR() { return ARR; } };
})();

/* ---------- UI (only runs in the browser, after the host page calls WRGame.init) ---------- */
const UI = (function () {
  const E = Engine, F = id => E.FAB[id];
  const KEY = 'wr_game', BEST = 'wr_game_best';
  const REG = [['yarn', 'Si Kusut'], ['button', 'Kancing Nakal'], ['needle', 'Jarum Jahil'], ['pin', 'Peniti Pelit'], ['iron', 'Setrika Sinis'], ['hanger', 'Hanger Galak']];
  let host = null, root = null, body = null, ready = null, mounted = false;
  let best = 0, G = null, R = null, phase = 'intro', sel = [], msg = '', last = null, starters = [], rewards = [], shop = [], modal = null, fx = null, shake = false;
  let showAll = false, sendState = '', sendErr = '';
  const rng = Math.random;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage off: the run just won't survive a reload */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  const CSS = `
.bq{display:flex;flex-direction:column;gap:12px;padding-bottom:24px}
.bq h2{font-family:var(--display);margin:0;font-size:22px;line-height:1.15}
.bq .bq-mut{color:var(--muted);font-size:13px}
.bq-top{display:flex;align-items:center;gap:10px}.bq-top .t{flex:1;min-width:0}.bq-top .t b{display:block;font-size:13px;color:var(--muted);font-weight:700}
.bq-coin{background:var(--card-2);padding:5px 12px;border-radius:999px;font-weight:800;white-space:nowrap}
.bq-card{background:var(--card);border-radius:20px;padding:16px}
.bq-center{text-align:center}.bq-big{font-size:28px}
.bq-btn{border:0;border-radius:16px;min-height:48px;padding:0 14px;font:inherit;font-weight:800;font-size:15px;cursor:pointer;background:var(--card-2);color:var(--text);flex:1;min-width:92px}
.bq-btn.pri{background:var(--yellow);color:var(--on-accent)}.bq-btn.mint{background:var(--mint);color:var(--on-accent)}.bq-btn:disabled{opacity:.4;cursor:not-allowed}
.bq-btn.sm{min-height:40px;font-size:13px;flex:none}
.bq-btns{display:flex;gap:8px;flex-wrap:wrap}
.bq-arena{display:flex;align-items:flex-end;justify-content:space-between;gap:6px;background:var(--card);border-radius:20px;padding:8px 12px 8px;position:relative;overflow:hidden;box-shadow:inset 0 0 0 1.5px var(--line)}
.bq-fig{text-align:center;width:44%;position:relative}
.bq-fig .bq-img{height:var(--bq-art,118px);display:flex;align-items:flex-end;justify-content:center}
.bq-fig img{max-height:var(--bq-art,118px);max-width:100%;width:auto;height:auto;display:block}
.bq-name{font-size:12px;font-weight:800;margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.bq-hp{height:11px;background:var(--card-2);border-radius:999px;overflow:hidden;margin:4px 0 0}.bq-hp i{display:block;height:100%;background:linear-gradient(90deg,#ff6b6b,#ff9a6b);transition:width .5s}
.bq-vs{align-self:center;font:800 18px var(--display);color:var(--line)}
.bq-atk{animation:bq-atk .5s}@keyframes bq-atk{35%{transform:translateX(64px) rotate(6deg)}}
.bq-ehit{animation:bq-ehit .5s .18s}@keyframes bq-ehit{20%{transform:translateX(9px);filter:brightness(2)}55%{transform:translateX(-9px)}}
.bq-dead{animation:bq-dead .9s .3s forwards}@keyframes bq-dead{to{transform:translateY(24px) rotate(28deg) scale(.5);opacity:0}}
.bq-dmg{position:absolute;right:16%;top:8px;font:800 28px var(--display);color:var(--yellow);animation:bq-dmg 1s .2s both;text-shadow:0 2px 0 #0008}@keyframes bq-dmg{from{transform:translateY(14px);opacity:0}30%{opacity:1}to{transform:translateY(-16px);opacity:0}}
.bq-say{position:absolute;left:12px;top:8px;background:#fff;color:#111;font:800 12px var(--ui);padding:3px 9px;border-radius:10px;animation:bq-dmg 1.6s both}
.bq-bar{display:flex;justify-content:space-between;font-size:13px;color:var(--muted)}.bq-bar b{color:var(--text)}
.bq-boss{background:var(--card);border-radius:16px;padding:10px 12px;font-size:13px;box-shadow:inset 0 0 0 1.5px var(--pink)}.bq-boss b{color:var(--pink)}
.bq-slots{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px}
.bq-slot{background:var(--card);border:1.5px dashed var(--line);border-radius:12px;min-height:58px;padding:4px;text-align:center;font:inherit;font-size:10.5px;line-height:1.15;display:flex;flex-direction:column;justify-content:center;align-items:center;color:var(--muted)}
button.bq-slot{cursor:pointer;border:1.5px solid var(--yellow);color:var(--text)}.bq-slot .ic{font-size:20px}
.bq-info{display:flex;gap:6px;font-size:12px;color:var(--muted);flex-wrap:wrap}.bq-info span{background:var(--card);padding:4px 10px;border-radius:999px}
.bq-prev{background:var(--card);border-radius:20px;padding:12px;min-height:104px}
.bq-sel{display:flex;gap:5px;min-height:46px;flex-wrap:wrap;margin-bottom:6px}.bq-sel .bq-tile{width:38px;height:44px;font-size:19px}
.bq-pl{font-size:13px;color:var(--muted)}.bq-pl b{color:var(--accent-text);font-size:17px}
.bq-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:4px}
.bq-chip{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--card-2);color:var(--text)}
.bq-chip.a{color:var(--ok-text)}.bq-chip.m{color:var(--accent-text)}.bq-chip.j{color:var(--error)}
.bq-hand{display:flex;gap:6px;flex-wrap:wrap;justify-content:center}
.bq-tile{position:relative;width:44px;height:52px;border-radius:10px;border:0;background:#efe7d6;color:#1a1820;font:800 23px var(--display);text-transform:uppercase;cursor:pointer;box-shadow:0 3px 0 #b9ae95;padding:0}
.bq-tile small{position:absolute;right:4px;bottom:2px;font:700 10px var(--ui);opacity:.7}
.bq-tile.gold{background:linear-gradient(135deg,#ffe27a,#f2b705);box-shadow:0 3px 0 #a47c00}
.bq-tile.glass{background:linear-gradient(135deg,#d4f2ff,#8fd3f5);box-shadow:0 3px 0 #4a93b5}
.bq-tile.used{opacity:.25;transform:translateY(3px);box-shadow:none}
.bq-tile.lock{background:#3a3748;color:#888;box-shadow:none;cursor:not-allowed}.bq-tile.lock:after{content:'🔒';position:absolute;top:-4px;left:-2px;font-size:12px}
.bq-msg{min-height:20px;font-size:13px;font-weight:700;color:var(--error)}
.bq-last{background:var(--card);border-radius:16px;padding:10px 12px;font-size:13px}.bq-last b{color:var(--accent-text)}
.bq-opts{display:grid;gap:8px}
.bq-opt{background:var(--card);border:1.5px solid var(--line);border-radius:18px;padding:12px 14px;text-align:left;color:var(--text);cursor:pointer;font:inherit;font-size:14px}
.bq-opt:hover:not(:disabled){border-color:var(--yellow)}.bq-opt b{font-size:16px}.bq-opt .ic{font-size:22px;margin-right:6px}
.bq-opt .pr{float:right;color:var(--accent-text);font-weight:800}.bq-opt:disabled{opacity:.45;cursor:not-allowed}
.bq-opt .d{display:block;color:var(--muted);font-weight:500;margin-top:2px}
.bq-modal{position:fixed;inset:0;background:#000b;display:flex;align-items:center;justify-content:center;padding:16px;z-index:20}
.bq-modal .bq-card{max-width:420px;width:100%;max-height:90vh;overflow:auto;background:var(--ink)}
.bq-shake{animation:bq-sh .3s}@keyframes bq-sh{25%{transform:translateX(-5px)}75%{transform:translateX(5px)}}
.bq-pop{animation:bq-pop .3s}@keyframes bq-pop{from{transform:scale(.9);opacity:0}}
.bq-wl{display:flex;flex-direction:column;gap:6px;margin-top:8px}
.bq-wl .row{display:flex;align-items:center;gap:10px;background:var(--card-2);border-radius:14px;padding:6px 6px 6px 14px}
.bq-wl .row b{flex:1;font-family:var(--display);font-size:16px}.bq-wl .row i{font-style:normal;color:var(--muted);font-size:12px}
.bq-wl .add{min-height:36px;padding:0 12px;border:0;border-radius:999px;background:var(--yellow);color:var(--on-accent);font:inherit;font-weight:800;font-size:13px;cursor:pointer}
.bq-wl .add:disabled{background:var(--card);color:var(--muted);cursor:default}
.bq-hero img{height:120px;width:auto}
/* the round screen fits one phone screen: smaller art, one-line chips, a hand that never wraps */
.bq-r{gap:8px;--bq-art:100px}
.bq-r .bq-name{white-space:normal;line-height:1.2}
.bq-r .bq-top{gap:8px}.bq-r .bq-top .t b{display:inline;font-size:14px;color:var(--text)}.bq-r .bq-coin{padding:3px 10px;font-size:14px}
.bq-r .bq-bar{font-size:12px}
.bq-r .bq-boss{padding:6px 10px;font-size:12px;line-height:1.3}
.bq-r .bq-slot{min-height:40px;font-size:9.5px;border-radius:10px}.bq-r .bq-slot .ic{font-size:16px}
.bq-r .bq-info{flex-wrap:nowrap;overflow:hidden;font-size:11.5px}.bq-r .bq-info span{padding:3px 8px;white-space:nowrap}
.bq-r .bq-prev{min-height:84px;max-height:118px;padding:8px 10px;overflow:hidden}
.bq-r .bq-sel{min-height:38px;margin-bottom:4px;flex-wrap:nowrap;gap:4px}.bq-r .bq-sel .bq-tile{width:32px;height:38px;font-size:17px}
.bq-r .bq-last{background:none;padding:0;border-radius:0}
.bq-r .bq-msg{min-height:16px;font-size:12px;line-height:16px;margin:-2px 0}
.bq-r .bq-hand{display:grid;grid-template-columns:repeat(var(--bq-n,8),minmax(0,48px));gap:5px;justify-content:center}
.bq-r .bq-hand .bq-tile{width:auto;height:50px;font-size:22px}
.bq-r .bq-btn{min-height:46px;min-width:0;padding:0 8px;white-space:nowrap}
.bq-r .bq-kb{font-size:12px}
@media(hover:none){.bq-kb{display:none}}
@media(max-height:740px){.bq-r{--bq-art:84px}}
@media(max-height:680px){.bq-r{--bq-art:64px}.bq-r .bq-hand .bq-tile{height:44px}.bq-r .bq-prev{min-height:76px}}
@media(prefers-reduced-motion:reduce){.bq-atk,.bq-ehit,.bq-dead,.bq-dmg,.bq-say,.bq-pop,.bq-shake{animation:none}}`;

  /* ---------- persistence ---------- */
  function save() {
    if (!G || modal) return;
    store.set(KEY, JSON.stringify({ v: 1, G: G, R: R, phase: phase, starters: starters, rewards: rewards, shop: shop, last: last && last.fin ? { fin: last.fin } : null }));
  }
  function load() {
    try {
      const s = JSON.parse(store.get(KEY) || 'null');
      if (!s || s.v !== 1 || !s.G || !s.phase) return null;
      return s;
    } catch (e) { return null; }
  }
  function restore(s) {
    G = s.G; R = s.R; phase = s.phase; starters = s.starters || []; rewards = s.rewards || []; shop = s.shop || []; last = s.last || null;
    sel = []; msg = ''; modal = null; fx = null; E.resumeIds(G, R);
  }

  /* ---------- html pieces ---------- */
  const label = () => 'Stage ' + (G.stage + 1) + ' · ' + (G.rnd === 2 ? 'Boss' : 'Ronde ' + (G.rnd + 1));
  const isBoss = () => G.rnd === 2;
  function chipsOf(s) {
    let h = '';
    s.adds.forEach(a => h += `<span class="bq-chip a">${F(a.id).icon} +${a.v}</span>`);
    s.mults.forEach(m => h += `<span class="bq-chip m">${F(m.id).icon} ×${m.v}</span>`);
    if (s.bossHalf) h += '<span class="bq-chip j">Boss ×0,5</span>';
    if (s.jackpot === true) h += '<span class="bq-chip j">🎰 JACKPOT ×2</span>'; else if (s.jackpot === false) h += '<span class="bq-chip">🎰 tidak kena</span>';
    return h;
  }
  const tileHtml = (t, cls, attrs) => `<button type="button" class="bq-tile ${t.up || ''} ${cls || ''}" ${attrs || ''}>${t.ch}<small>${E.val(t)}</small></button>`;
  const fabricCard = (id, tag) => { const f = F(id); return `<span class="ic">${f.icon}</span><b>${f.name}</b>${tag || ''}<span class="d">${f.desc}</span>`; };
  function optHtml(o) {
    const U = o.ch ? o.ch.toUpperCase() : '';
    if (o.type === 'fabric') return fabricCard(o.id);
    if (o.type === 'up') return `<span class="ic">${o.kind === 'gold' ? '🥇' : '🔮'}</span><b>${o.kind === 'gold' ? 'Gold' : 'Glass'} · huruf ${U}</b><span class="d">Tile ${U} ber-upgrade ikut di ronde berikutnya sampai terpakai. ${o.kind === 'gold' ? 'Nilai huruf ×2.' : 'Nilai huruf ×3.'}</span>`;
    if (o.type === 'letter') return `<span class="ic">🔤</span><b>Huruf ${U}</b><span class="d">Satu huruf ${U} ditambahkan ke supply di semua ronde berikutnya.</span>`;
    if (o.type === 'discard') return `<span class="ic">🗑️</span><b>+1 jatah Buang per ronde</b><span class="d">Sekarang ${E.CFG.discards + G.discardBonus} per ronde.</span>`;
    if (o.type === 'hand') return `<span class="ic">✋</span><b>+1 huruf di tangan</b><span class="d">Tangan jadi ${E.handSize(G) + 1} huruf; kata boleh sampai ${E.handSize(G) + 1} huruf (maks. 9).</span>`;
    if (o.type === 'supply') return `<span class="ic">📦</span><b>+${o.n} huruf supply</b><span class="d">Supply tiap ronde berikutnya lebih banyak.</span>`;
    return `<span class="ic">🪙</span><b>+${o.n} koin</b><span class="d">Buat belanja di shop.</span>`;
  }
  function slotsHtml() {
    let h = '<div class="bq-slots">';
    for (let i = 0; i < E.CFG.slots; i++) { const id = G.fabrics[i]; h += id ? `<button type="button" class="bq-slot" data-a="showFab" data-i="${id}"><span class="ic">${F(id).icon}</span>${F(id).name}</button>` : '<div class="bq-slot">kosong</div>'; }
    return h + '</div>';
  }
  function enemyInfo() {
    if (R.boss) return { img: 'img/game/boss-' + R.boss.id + '.webp', n: R.boss.name };
    const e = REG[(G.stage * 2 + G.rnd) % REG.length];
    return { img: 'img/game/enemy-' + e[0] + '.webp', n: e[1] };
  }
  function pose() {
    if (phase === 'end') return 'defeated';
    if (R && R.cleared) return 'victory';
    if (fx) return 'attack';
    if (shake) return 'hurt';
    return sel.length ? 'thinking' : 'idle';
  }
  function arenaHtml() {
    const en = enemyInfo(), left = Math.max(0, R.target - R.score), pct = left / R.target * 100, f = fx; fx = null;
    const say = f && f.say ? `<div class="bq-say">${f.say}</div>` : '';
    const art = `<img src="${en.img}" alt="">`;
    return `<div class="bq-arena">${say}${f ? `<div class="bq-dmg">-${f.dmg}</div>` : ''}
      <div class="bq-fig"><div class="bq-img ${f ? 'bq-atk' : ''}"><img src="img/game/bibo-${pose()}.webp" alt="Bibo"></div><div class="bq-name">Bibo</div></div><div class="bq-vs">VS</div>
      <div class="bq-fig"><div class="bq-img ${f ? 'bq-ehit' : ''} ${R.cleared ? 'bq-dead' : ''}">${art}</div><div class="bq-hp"><i style="width:${pct}%"></i></div><div class="bq-name">${en.n} · ${left}/${R.target}</div></div></div>`;
  }
  function roundHtml() {
    let pv = '';
    if (sel.length) {
      const w = sel.map(t => t.ch).join('');
      if (w.length >= 3 && E.isWord(w) && (!R.boss || R.boss.id !== 'minimal' || w.length >= 5)) {
        const s = E.score(sel, G.fabrics, { first: !R.firstDone, chain: R.chain }, R.boss, () => 1);
        pv = `<div class="bq-pl"><b>${w.toUpperCase()}</b> · ${s.letters} + ${s.lenBonus} panjang → <b>${s.final}</b> poin</div><div class="bq-chips">${chipsOf(Object.assign({}, s, { jackpot: undefined }))}${G.fabrics.includes('jackpot') ? '<span class="bq-chip">🎰 bisa ×2</span>' : ''}</div>`;
      } else pv = `<div class="bq-pl">${w.length < 3 ? 'Pilih minimal 3 huruf untuk kata, atau langsung Buang' : 'Belum jadi kata valid (boleh Buang huruf ini)'}</div>`;
    } else pv = '<div class="bq-pl">Ketuk huruf: susun kata untuk menyerang, atau buang huruf yang tidak berguna.</div>';
    const selIds = new Set(sel.map(t => t.id));
    const head = `<div class="bq-top"><div class="t"><b>${label()}</b></div><span class="bq-coin">🪙 ${G.coins}</span></div>${arenaHtml()}
      <div class="bq-bar"><span>Skor ronde <b>${R.score}</b></span><span>Target <b>${R.target}</b></span></div>
      ${R.boss ? `<div class="bq-boss"><b>${R.boss.name}:</b> ${R.boss.desc}${R.boss.block ? ' Terkunci: <b>' + R.boss.block.toUpperCase() + '</b>' : ''}</div>` : ''}`;
    const lastHtml = last && last.res ? `<div class="bq-last bq-pop">Terakhir: <b>${last.res.word.toUpperCase()} -${last.res.final}</b> <span class="bq-mut">(${last.res.letters} + ${last.res.lenBonus})</span>${last.res.recycled ? ` ♻️ ${last.res.recycled.toUpperCase()}` : ''}${last.res.extraDraw ? ' 🔄 +1' : ''}<div class="bq-chips">${chipsOf(last.res)}</div></div>` : '';
    if (!sel.length && lastHtml) pv = lastHtml;
    if (R.cleared) return head + `<div class="bq-center bq-pop"><h2>${enemyInfo().n} kalah! 🎉</h2><div class="bq-mut">+${last.fin.coins} koin${last.fin.saver ? ` (+${last.fin.saver} Saver)` : ''}</div><button type="button" class="bq-btn pri" style="width:100%;margin-top:10px" data-a="goNext">Ambil hadiah</button></div>`;
    return head + slotsHtml() + `
      <div class="bq-info"><span>📦 Supply ${R.supply.length}</span><span>🗑️ Buang ${R.discards}/${R.maxDiscards}</span><span>📝 ${R.words} kata</span>${R.chain > 0 && G.fabrics.includes('chain') ? `<span>⛓️ chain ${R.chain}</span>` : ''}</div>
      <div class="bq-prev"><div class="bq-sel">${sel.map((t, i) => tileHtml(t, '', `data-a="unsel" data-i="${i}"`)).join('')}</div>${pv}</div>
      <div class="bq-msg" role="status">${msg}</div>
      <div class="bq-hand" style="--bq-n:${R.handSize}">${R.hand.map(t => { const lk = E.blocked(R, t), us = selIds.has(t.id); return tileHtml(t, lk ? 'lock' : us ? 'used' : '', lk ? 'disabled' : `data-a="pick" data-i="${t.id}"`); }).join('')}</div>
      <div class="bq-btns"><button type="button" class="bq-btn" data-a="clr" ${sel.length ? '' : 'disabled'}>Hapus</button><button type="button" class="bq-btn mint" data-a="discard" ${sel.length && E.canDiscard(R) ? '' : 'disabled'}>🗑️ Buang${sel.length ? ' ' + sel.length : ''}</button><button type="button" class="bq-btn pri" data-a="send" ${sel.length >= 3 ? '' : 'disabled'}>⚔️ Serang</button></div>
      <div class="bq-mut bq-kb">Di laptop: ketik huruf untuk memilih, Backspace menghapus, Enter menyerang.</div>`;
  }
  function introHtml() {
    const saved = load(), resumable = saved && saved.phase !== 'end';
    return `<div class="bq-center bq-hero"><img src="img/game/bibo-idle.webp" alt="Bibo"><h2 style="margin-top:6px;font-size:26px">Bibo's Fabric Quest</h2><div class="bq-mut">Susun kata, kalahkan musuh jahit, naik stage sejauh mungkin.</div></div>
      <div class="bq-card"><b>Cara main</b><ul class="bq-mut" style="margin:6px 0 0;padding-left:18px">
        <li>Tangan 8 huruf, supply 24. Ketuk huruf berurutan untuk menyusun kata (3 huruf sampai sebesar tanganmu), lalu Serang.</li>
        <li>Skor kata jadi serangan Bibo. Capai target ronde untuk mengalahkan musuh.</li>
        <li>Huruf jelek? Pilih lalu Buang: ambil huruf baru dari supply (3 kali per ronde).</li>
        <li>Tiap stage: 2 ronde + 1 boss, lalu shop. Run tak berujung; target makin berat tiap stage.</li></ul></div>
      ${best ? `<div class="bq-card bq-center">🏅 Rekor kamu: <b>Stage ${best}</b></div>` : ''}
      ${resumable ? '<button type="button" class="bq-btn pri" style="width:100%" data-a="resume">Lanjutkan run</button><button type="button" class="bq-btn" style="width:100%" data-a="start">Mulai run baru</button>' : '<button type="button" class="bq-btn pri" style="width:100%" data-a="start">Mulai run</button>'}`;
  }
  function endHtml() {
    const s = G.stats, uniq = []; const seen = {};
    s.list.slice().sort((a, b) => b.s - a.s).forEach(x => { if (!seen[x.w]) { seen[x.w] = 1; uniq.push(x); } });
    const shown = showAll ? uniq : uniq.slice(0, 10);
    const sendLine = sendState === 'ok' ? '<div class="bq-mut">Hasil tersimpan.</div>' : sendState === 'sending' ? '<div class="bq-mut">Menyimpan hasil…</div>' : sendState === 'fail' ? `<div class="bq-msg">Hasil belum tersimpan: ${sendErr} <button type="button" class="bq-btn sm" data-a="retry">Coba lagi</button></div>` : '';
    return `<div class="bq-top"><div class="t"><b>${label()}</b><h2>Run berakhir</h2></div></div>${arenaHtml()}
      <div class="bq-card bq-center"><div class="bq-mut">Skor ronde ${R.score} dari ${R.target}.</div><div style="margin-top:6px">${G.reached >= best ? '🏅 Rekor baru!' : 'Rekor: Stage ' + best}</div>${sendLine}</div>
      <div class="bq-card"><div class="bq-info" style="font-size:13px"><span>🏔️ Stage ${G.reached}</span><span>📝 ${s.words} kata</span><span>🔤 terpanjang: ${s.longest ? s.longest.toUpperCase() : '-'}</span><span>⭐ terbaik: ${s.best.w ? s.best.w.toUpperCase() + ' (' + s.best.s + ')' : '-'}</span><span>Σ ${s.total} poin</span></div>
        <div class="bq-mut" style="margin-top:10px">Fabric yang dikumpulkan</div><div class="bq-chips">${G.fabrics.map(id => `<span class="bq-chip">${F(id).icon} ${F(id).name}</span>`).join('') || '-'}</div>
        <div class="bq-mut" style="margin-top:10px">Kata-katamu (simpan ke Lemari)</div><div class="bq-wl">${shown.map(x => `<div class="row"><b>${x.w}</b><i>${x.s} poin</i><span data-add="${x.w}"></span></div>`).join('') || '<div class="bq-mut">Belum ada kata.</div>'}</div>
        ${uniq.length > 10 && !showAll ? `<button type="button" class="bq-btn sm" style="margin-top:8px" data-a="showAll">Tampilkan semua (${uniq.length})</button>` : ''}</div>
      <button type="button" class="bq-btn pri" data-a="start">Main lagi</button>`;
  }
  function modalHtml() {
    if (modal.t === 'fab') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><div class="bq-opt" style="cursor:default">${fabricCard(modal.id)}</div><button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Tutup</button></div></div>`;
    return `<div class="bq-modal"><div class="bq-card"><h2>Slot penuh</h2><div class="bq-mut" style="margin:4px 0 8px">Ganti salah satu Fabric dengan:</div><div class="bq-opt" style="margin-bottom:8px;cursor:default">${fabricCard(modal.id)}</div><div class="bq-mut">Ketuk Fabric yang diganti, atau lewati.</div><div class="bq-opts" style="margin-top:6px">${G.fabrics.map((id, i) => `<button type="button" class="bq-opt" data-a="doReplace" data-i="${i}"><span class="ic">${F(id).icon}</span><b>${F(id).name}</b></button>`).join('')}</div><button type="button" class="bq-btn" style="width:100%;margin-top:8px" data-a="skipReplace">Lewati Fabric baru</button></div></div>`;
  }
  function render() {
    let h = '';
    if (phase === 'intro') h = introHtml();
    else if (phase === 'starter') h = `<h2>Pilih Fabric awal</h2><div class="bq-mut">Kamu mulai dengan 1 Fabric dari 3 pilihan.</div><div class="bq-opts">${starters.map((id, i) => `<button type="button" class="bq-opt" data-a="pickStarter" data-i="${i}">${fabricCard(id)}</button>`).join('')}</div>`;
    else if (phase === 'bosspre') h = `<div class="bq-card bq-center"><img src="img/game/boss-${R.boss.id}.webp" alt="" style="height:150px;width:auto"><h2>${R.boss.name}</h2><p>${R.boss.desc}${R.boss.block ? `<br><b style="color:var(--error);font-size:22px">Huruf terkunci: ${R.boss.block.toUpperCase()}</b>` : ''}</p><div class="bq-mut">Target ${R.target}</div></div><button type="button" class="bq-btn pri" data-a="faceBoss">Hadapi boss</button>`;
    else if (phase === 'round') h = roundHtml();
    else if (phase === 'reward') h = `<h2>Ronde selesai! 🎉</h2><div class="bq-mut">Pilih 1 hadiah.</div><div class="bq-opts">${rewards.map((o, i) => `<button type="button" class="bq-opt" data-a="takeReward" data-i="${i}">${optHtml(o)}</button>`).join('')}</div>`;
    else if (phase === 'shop') {
      const perm = E.permItems(G);
      h = `<div class="bq-top"><h2 style="flex:1">🛍️ Shop</h2><span class="bq-coin">🪙 ${G.coins}</span></div><div class="bq-mut">Shop antar stage. Boleh keluar tanpa beli.</div>
        <div class="bq-mut"><b>Tawaran stage ini</b></div><div class="bq-opts">${shop.map((o, i) => o.sold ? '' : `<button type="button" class="bq-opt" ${G.coins < o.price ? 'disabled' : ''} data-a="buy" data-i="${i}"><span class="pr">🪙 ${o.price}</span>${optHtml(o)}</button>`).join('')}</div>
        <div class="bq-btns"><button type="button" class="bq-btn sm" ${G.coins < E.CFG.price.reroll ? 'disabled' : ''} data-a="reroll">🔁 Reroll tawaran (🪙 ${E.CFG.price.reroll})</button></div>
        <div class="bq-mut"><b>Perlengkapan permanen</b> (selalu ada, harga naik tiap beli)</div><div class="bq-opts">${perm.map((o, i) => `<button type="button" class="bq-opt" ${(o.maxed || G.coins < o.price) ? 'disabled' : ''} data-a="buyPerm" data-i="${i}"><span class="pr">${o.maxed ? 'MAKS' : '🪙 ' + o.price}</span>${optHtml(o)}</button>`).join('')}</div>
        <div><div class="bq-mut">Fabric kamu</div>${slotsHtml()}</div>
        <button type="button" class="bq-btn pri" data-a="leaveShop">Lanjut ke ${label()}</button>`;
    } else if (phase === 'end') h = endHtml();
    body.innerHTML = '<div class="bq' + (phase === 'round' ? ' bq-r' : '') + '">' + h + (modal ? modalHtml() : '') + '</div>';
    if (shake) { const p = body.querySelector('.bq-prev'); if (p) p.classList.add('bq-shake'); }
    shake = false;
    body.querySelectorAll('[data-add]').forEach(el => { try { const b = host.addButton(el.getAttribute('data-add')); if (b) el.replaceWith(b); } catch (e) { /* host without Lemari: no add button */ } });
    save();
  }

  /* ---------- actions ---------- */
  // the run may already be replaced by a new one when the answer arrives: update whichever copy is stored
  function markSent(g) {
    g.submitted = true;
    if (G === g) { save(); return; }
    const s = load(); if (s && s.G && s.G.runId === g.runId) { s.G.submitted = true; store.set(KEY, JSON.stringify(s)); }
  }
  function sendResult() {
    const g = G;
    if (!g || g.submitted || sendState === 'sending') return;
    const s = g.stats;
    sendState = 'sending'; sendErr = '';
    host.submit({ run_id: g.runId, stage: g.reached, round: g.rnd + 1, words: s.words, longest: s.longest, best_word: s.best.w, best_score: s.best.s, total_score: s.total, fabrics: g.fabrics.slice() })
      .then(function (r) { markSent(g); sendState = 'ok'; if (r && r.stats && host.onStats) host.onStats(r.stats); if (phase === 'end') render(); },
        function (e) { sendState = 'fail'; sendErr = e && e.message ? e.message : 'Coba lagi nanti.'; if (host.failed) host.failed(e); if (phase === 'end') render(); });
    if (phase === 'end') render();
  }
  function endRun() {
    phase = 'end'; G.reached = G.stage + 1;
    if (G.reached > best) { best = G.reached; store.set(BEST, String(best)); }
    showAll = false; sendState = ''; sendResult();
  }
  function gain(o, after) {
    if (o.type === 'coin') { G.coins += o.n; after(); }
    else if (o.type === 'up') { E.addUpgrade(G, o.kind, o.ch); after(); }
    else if (o.type === 'supply') { G.extra += o.n; after(); }
    else if (o.type === 'letter') { G.letterAdds.push(o.ch); after(); }
    else if (o.type === 'fabric') { if (G.fabrics.length < E.CFG.slots) { G.fabrics.push(o.id); after(); } else { modal = { t: 'replace', id: o.id, after: after }; render(); } }
  }
  function beginRound() { R = E.makeRound(G, rng); sel = []; msg = ''; last = null; phase = R.boss ? 'bosspre' : 'round'; render(); }
  function advance() { if (isBoss()) { G.stage++; G.rnd = 0; shop = E.shopItems(G, rng); phase = 'shop'; render(); } else { G.rnd++; beginRound(); } }
  const A = {
    start() {
      G = E.newGame(null); G.runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); G.submitted = false;
      const ids = E.FABRICS.map(f => f.id).filter(x => ['refill', 'saver', 'recycler'].indexOf(x) === -1);
      starters = E.shuffle(ids.slice(), rng).slice(0, 3); phase = 'starter'; last = null; sel = []; modal = null; sendState = ''; render();
    },
    resume() { const s = load(); if (s) { restore(s); render(); } else A.start(); },
    pickStarter(i) { G.fabrics = [starters[+i]]; beginRound(); },
    faceBoss() { phase = 'round'; render(); },
    pick(id) { const t = R.hand.find(x => x.id === +id); if (!t || sel.length >= R.handSize || sel.some(s => s.id === t.id)) return; sel.push(t); msg = ''; render(); },
    unsel(i) { sel.splice(+i, 1); render(); },
    clr() { sel = []; msg = ''; render(); },
    send() {
      const r = E.submit(G, R, sel, rng);
      if (!r.ok) { msg = r.msg; shake = true; render(); return; }
      const f = r.res.final;
      fx = { dmg: f, say: r.res.jackpot ? 'JACKPOT!' : f >= R.target * 0.35 ? 'Mantap!' : r.res.word.length >= 6 ? 'Panjang!' : '' };
      last = { res: r.res }; sel = []; msg = '';
      if (r.won) { last.fin = E.finishRound(G, R); rewards = E.rewardOptions(G, rng); R.cleared = true; }
      else if (E.failed(G, R)) { endRun(); return; }
      render();
    },
    discard() { if (!E.discard(G, R, sel.slice())) return; const n = sel.length; sel = []; msg = 'Buang ' + n + ' huruf, ambil dari supply.'; if (E.failed(G, R)) { endRun(); return; } render(); },
    goNext() { phase = 'reward'; render(); },
    takeReward(i) { gain(rewards[+i], advance); },
    showFab(id) { modal = { t: 'fab', id: id }; render(); },
    closeModal() { modal = null; render(); },
    doReplace(i) { const m = modal; G.fabrics[+i] = m.id; modal = null; m.after(); },
    skipReplace() { const m = modal; modal = null; m.after(); },
    buy(i) {
      const o = shop[+i]; if (!o || o.sold || G.coins < o.price) return;
      if (o.type === 'fabric' && G.fabrics.length >= E.CFG.slots) { modal = { t: 'replace', id: o.id, after: () => { if (G.fabrics.includes(o.id)) { G.coins -= o.price; o.sold = true; } render(); } }; render(); return; }
      G.coins -= o.price; o.sold = true; gain(o, render);
    },
    buyPerm(i) {
      const o = E.permItems(G)[+i]; if (!o || o.maxed || G.coins < o.price) return; G.coins -= o.price;
      if (o.type === 'supply') G.extra += o.n; else if (o.type === 'discard') G.discardBonus++; else if (o.type === 'hand') G.handBonus++;
      render();
    },
    reroll() { if (G.coins < E.CFG.price.reroll) return; G.coins -= E.CFG.price.reroll; shop = E.shopItems(G, rng); render(); },
    leaveShop() { beginRound(); },
    showAll() { showAll = true; render(); },
    retry() { sendResult(); },
    noop() { }
  };
  function onClick(ev) {
    const t = ev.target.closest ? ev.target.closest('[data-a]') : null;
    if (!t || !body.contains(t)) return;
    const fn = A[t.getAttribute('data-a')]; if (fn) fn(t.getAttribute('data-i'));
  }
  function onKey(ev) {
    if (!root || root.hidden || phase !== 'round' || modal || !R || R.cleared) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'Enter') { if (sel.length >= 3) { ev.preventDefault(); A.send(); } }
    else if (ev.key === 'Backspace') { ev.preventDefault(); sel.pop(); render(); }
    else if (/^[a-z]$/i.test(ev.key)) { const c = ev.key.toLowerCase(); const t = R.hand.find(t => t.ch === c && !E.blocked(R, t) && !sel.some(s => s.id === t.id)); if (t) A.pick(t.id); }
  }

  /* ---------- entry points ---------- */
  function init(h) {
    host = h; root = h.root; body = h.body;
    if (!mounted) {
      mounted = true;
      const st = document.createElement('style'); st.id = 'bq-css'; st.textContent = CSS; document.head.appendChild(st);
      body.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
    }
    best = +store.get(BEST) || 0;
  }
  function open() {
    if (!ready) {
      ready = fetch('words-game.txt').then(r => { if (!r.ok) throw new Error('dict'); return r.text(); }).then(t => { E.setDict(t.split('\n').map(w => w.trim()).filter(Boolean)); });
      ready.catch(() => { ready = null; });
    }
    body.innerHTML = '<div class="bq bq-center bq-mut" style="padding:40px 0">Memuat kamus…</div>';
    return ready.then(() => {
      const s = load();
      if (s && s.phase === 'end' && s.G && !s.G.submitted) { restore(s); sendState = ''; sendResult(); }   // a finished run whose result never reached the server: try again quietly
      G = null; R = null; phase = 'intro'; sel = []; modal = null; render();
    }, () => { body.innerHTML = '<div class="bq bq-center"><div class="bq-card">Kamus game belum bisa dimuat. Cek koneksi, lalu buka Game lagi.</div></div>'; });
  }
  return { init: init, open: open };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
else if (typeof window !== 'undefined') window.WRGame = { init: UI.init, open: UI.open, Engine: Engine };
