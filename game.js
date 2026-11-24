/* Bibo's Fabric Quest. Loaded only when the Game tab is first opened (index.html adds this script on demand).
   Part 1: pure engine (no DOM, also loaded by tests/test-game.js in Node). Part 2: UI. */
const Engine = (function () {
  const V = {};
  [['aeiou', 1], ['rstln', 1], ['dg', 2], ['bcmp', 3], ['fhvwy', 4], ['k', 5], ['jx', 8], ['qz', 10]]
    .forEach(([s, v]) => { for (const c of s) V[c] = v; });
  const LB = { 3: 0, 4: 2, 5: 5, 6: 10, 7: 15, 8: 22, 9: 30, 10: 40, 11: 50, 12: 60 };
  const VOW = 'aeiou';
  const BAG = { e: 12, a: 9, i: 9, o: 8, n: 6, r: 6, t: 6, l: 4, s: 4, u: 4, d: 4, g: 3, b: 2, c: 2, m: 2, p: 2, f: 2, h: 2, v: 2, w: 2, y: 2, k: 1, j: 1, x: 1, q: 1, z: 1 };
  const CFG = {
    hand: 8, supply: 32, slots: 5, maxWord: 12, discards: 3, letterMul: 3, lenMul: 3, addMul: 3,
    base: 350, growth: 1.9, ramp: 0.08, roundMul: [1, 1.3, 1.4], // endless: target = base * growth^stage * (1 + ramp*stage) * roundMul
    coinRound: 3, price: { fabric: 6, gold: 4, ruby: 5, glass: 7, steel: 6, supply: 3, letter: 4, reroll: 2, book: 5, multi: 5, wild: 8 }, supplyPack: 3, handMaxBuys: 4
  };
  /* Fabrics fire LEFT TO RIGHT in slot order (Balatro jokers): 'chips' = +Chips (blue), 'add' = +Mult (red), 'x' = xMult. */
  const FABRICS = [
    { id: 'long', name: 'Long Stitch', icon: '🧵', desc: '+6 Mult untuk kata 6+ huruf.', kind: 'add' },
    { id: 'double', name: 'Double Stitch', icon: '🪡', desc: '+45 Chips untuk kata dengan huruf kembar.', kind: 'chips' },
    { id: 'short', name: 'Short & Sweet', icon: '🍬', desc: '+4 Mult untuk kata 3 huruf.', kind: 'add' },
    { id: 'chain', name: 'Word Chain', icon: '⛓️', desc: 'Kata 5+ huruf: +2 Mult untuk tiap kata 5+ huruf berturut-turut (termasuk kata ini). Putus kalau kata < 5 huruf.', kind: 'add' },
    { id: 'velvet', name: 'Vowel Velvet', icon: '🟣', desc: '+1 Mult untuk tiap huruf vokal.', kind: 'add' },
    { id: 'rare', name: 'Rare Thread', icon: '💎', desc: '+60 Chips untuk kata berisi J, Q, X, atau Z.', kind: 'chips' },
    { id: 'club', name: 'Consonant Club', icon: '🎩', desc: '+6 Chips untuk tiap konsonan.', kind: 'chips' },
    { id: 'golden', name: 'Golden Weave', icon: '🌟', desc: '×1,5 Mult untuk kata berisi huruf E.', kind: 'x' },
    { id: 'first', name: 'First Impression', icon: '👋', desc: '×2 Mult untuk kata valid pertama tiap ronde.', kind: 'x' },
    { id: 'jackpot', name: 'Jackpot', icon: '🎰', desc: '20% peluang ×2 Mult.', kind: 'x' },
    { id: 'refill', name: 'Refill Master', icon: '🔄', desc: 'Sekali per ronde: kata 5+ huruf menarik 1 huruf ekstra (tangan sementara +1).', kind: 'util' },
    { id: 'saver', name: 'Saver', icon: '🐷', desc: '+1 koin tiap 3 huruf sisa saat ronde selesai.', kind: 'util' },
    { id: 'recycler', name: 'Recycler', icon: '♻️', desc: '20% peluang 1 huruf terpakai kembali ke supply.', kind: 'util' },
    { id: 'thread7', name: 'Thread Count', icon: '7️⃣', desc: '+7 Mult untuk kata 7 huruf.', kind: 'add' },
    { id: 'patch', name: 'Patchwork', icon: '🧩', desc: '×2 Mult untuk kata dengan 3+ vokal berbeda.', kind: 'x' },
    { id: 'measure', name: 'Measuring Tape', icon: '📏', desc: '+30 Chips untuk kata 5+ huruf.', kind: 'chips', locked: true },
    { id: 'steady', name: 'Steady Hand', icon: '🤲', desc: '+2 koin tiap ronde yang dimenangkan tanpa Buang.', kind: 'util', locked: true },
    { id: 'lemariku', name: 'Lemariku', icon: '🚪', desc: '×2 Mult untuk kata yang sudah ada di Lemarimu.', kind: 'x', locked: true }
  ];
  // a locked Fabric shows up in starters, rewards and the shop only after its achievement (G.unlocked)
  const avail = (G, f) => !f.locked || (G.unlocked || []).includes(f.id);
  const FAB = {}; FABRICS.forEach(f => FAB[f.id] = f);
  const BOSSES = [
    { id: 'minimal', name: 'The Minimalist', desc: 'Kata di bawah 5 huruf hanya dapat 50% skor.' },
    { id: 'silent', name: 'The Silent One', desc: 'Satu huruf terkunci dan tidak bisa dipakai.', pick: 'dlnrst' },
    { id: 'repeater', name: 'The Repeater', desc: 'Kata tanpa huruf kembar hanya dapat 50% skor.' },
    { id: 'short', name: 'The Short Cutter', desc: 'Kata lebih dari 5 huruf tidak dapat bonus panjang.' },
    { id: 'vthief', name: 'The Vowel Thief', desc: 'Satu huruf vokal terkunci dan tidak bisa dipakai.', pick: 'aeiou' }
  ];

  /* Hands (Balatro's poker hands): the part of speech of the word. Level-ups are sold in the shop ("Buku Tata Bahasa"). */
  /* Hands (Balatro's poker hands) = part of speech: base Chips + base Mult. A grammar book ("Buku") adds +10 Chips and +1 Mult. */
  const HANDS = {
    o: { name: 'Kata lain', icon: '🔤', chips: 5, mult: 1 },
    n: { name: 'Noun', icon: '📦', chips: 10, mult: 2 },
    v: { name: 'Verb', icon: '🏃', chips: 15, mult: 3 },
    a: { name: 'Adjective', icon: '🎨', chips: 20, mult: 4 },
    r: { name: 'Adverb', icon: '⚡', chips: 30, mult: 5 }
  };
  const HAND_STEP = [10, 1];
  /* Card upgrades (Balatro enhancements): Gold +30 Chips, Rubi +4 Mult, Glass x1.5 Mult (when played); Besi x1.25 Mult while it stays in the hand. */
  const UPS = { gold: { name: 'Gold', icon: '🥇', desc: '+30 Chips saat dimainkan.' }, ruby: { name: 'Rubi', icon: '❤️', desc: '+4 Mult saat dimainkan.' },
    glass: { name: 'Glass', icon: '🔮', desc: '×1,5 Mult saat dimainkan.' }, steel: { name: 'Besi', icon: '🔩', desc: '×1,25 Mult selama tetap di tangan (tidak dimainkan).' } };
  const AFFIX_ADD = 3;
  /* Multi-letter cards (Paperback) and the wild card. Affixes in the right place (prefix first, suffix last) give x1.5 each. */
  const PRE = ['un', 're', 'dis'], SUF = ['ly', 'ing', 'ed', 'er', 'est', 'ful', 'ness', 'ous', 'able', 'ive', 'less', 'ment', 'tion'], PAIRS = ['th', 'ch', 'sh', 'qu', 'ck'];
  const MULTI = PRE.concat(SUF, PAIRS);
  const kindOf = ch => ch === '?' ? 'wild' : PRE.includes(ch) ? 'pre' : SUF.includes(ch) ? 'suf' : ch.length > 1 ? 'pair' : 'letter';
  const txt = t => t.ch === '?' ? (t.as || '') : t.ch;

  let DICT = new Map(), ARR = [];
  // one word per line, lower case, optional upper-case part-of-speech mark at the end: catN, runV, happyA, slowlyR, the
  function setDict(lines) {
    DICT = new Map(); ARR = [];
    lines.forEach(l => {
      const m = /^([a-z]+)([NVAR]?)$/.exec(String(l).trim());
      if (!m || m[1].length < 3 || m[1].length > CFG.maxWord || !/[aeiouy]/.test(m[1])) return;
      DICT.set(m[1], m[2] ? m[2].toLowerCase() : 'o'); ARR.push(m[1]);
    });
  }
  const isWord = w => DICT.has(w);
  const posOf = w => DICT.get(w) || 'o';
  const lvOf = (G, p) => (G && G.handLv && G.handLv[p]) || 1;
  function handInfo(p, lv) { const h = HANDS[p] || HANDS.o, l = lv || 1; return { pos: p, name: h.name, icon: h.icon, lv: l, chips: h.chips + (l - 1) * HAND_STEP[0], mult: h.mult + (l - 1) * HAND_STEP[1] }; }

  function rngFrom(seed) { let s = seed >>> 0; return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function shuffle(a, rng) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  let UID = 1;
  const mk = (ch, up) => ({ id: UID++, ch, up: up || null });
  function randLetter(rng) {
    const all = []; for (const c in BAG) for (let i = 0; i < BAG[c]; i++) all.push(c);
    return all[Math.floor(rng() * all.length)];
  }

  // card value: letters x3 (gold x2, glass x3); multi-letter = sum of its letters; wild = half of the letter it plays as (rounded up)
  function val(t) {
    if (t.ch === '?') return t.as ? Math.ceil(V[t.as] * CFG.letterMul / 2) : 0;
    let v = 0; for (const c of t.ch) v += V[c];
    return v * CFG.letterMul;
  }
  /* Score (Balatro): Chips x Mult, built in 4 phases, each step in order, so the ORDER of cards and Fabrics matters.
     1 hand (part of speech) + length bonus; 2 played cards left to right (chips, Gold +30 Chips, Rubi +4 Mult, Glass x1.5, affix in place +3 Mult);
     3 cards held in the hand (Besi x1.25); 4 Fabrics left to right; boss rules (x0.5) last. steps[] is what the scoring animation plays. */
  function score(tiles, fab, ctx, boss, rng) {
    const w = tiles.map(txt).join(''), n = w.length, has = id => fab.includes(id);
    const vow = [...w].filter(c => VOW.includes(c)), con = n - vow.length, rep = new Set(w).size < n;
    const steps = []; let chips = 0, mult = 0;
    const step = o => { if (o.c) chips += o.c; if (o.m) mult += o.m; if (o.x) mult *= o.x; steps.push(o); };
    const hand = handInfo(posOf(w), ctx.lv ? ctx.lv[posOf(w)] : 1);
    step({ c: hand.chips, m: hand.mult, label: hand.icon + ' ' + hand.name, hand: true });
    let lenBonus = (LB[n] || 0) * CFG.lenMul;
    if (boss && boss.id === 'short' && n > 5) lenBonus = 0;
    if (lenBonus) step({ c: lenBonus, label: '+' + lenBonus + ' panjang' });
    const lv = tiles.map(t => val(t)), affix = [];
    tiles.forEach((t, i) => {
      step({ c: lv[i], tile: i });
      if (t.up === 'gold') step({ c: 30, tile: i, label: '+30' });
      if (t.up === 'ruby') step({ m: 4, tile: i, label: '+4 Mult' });
      if (t.up === 'glass') step({ x: 1.5, tile: i, label: '×1,5' });
      const k = kindOf(t.ch);
      if ((k === 'pre' && i === 0) || (k === 'suf' && i === tiles.length - 1)) { affix.push(t.ch); step({ m: AFFIX_ADD, tile: i, label: '+' + AFFIX_ADD + ' Mult' }); }
    });
    (ctx.held || []).forEach(t => { if (t.up === 'steel') step({ x: 1.25, held: t.id, label: '×1,25' }); });
    const k5 = (ctx.chain || 0) + 1;
    fab.forEach(id => {
      let o = null;
      if (id === 'long' && n >= 6) o = { m: 6 };
      else if (id === 'double' && rep) o = { c: 45 };
      else if (id === 'short' && n === 3) o = { m: 4 };
      else if (id === 'chain' && n >= 5) o = { m: 2 * k5 };
      else if (id === 'velvet' && vow.length) o = { m: vow.length };
      else if (id === 'rare' && /[jqxz]/.test(w)) o = { c: 60 };
      else if (id === 'club' && con) o = { c: 6 * con };
      else if (id === 'golden' && w.includes('e')) o = { x: 1.5 };
      else if (id === 'first' && ctx.first) o = { x: 2 };
      else if (id === 'jackpot') { const hit = rng() < 0.2; if (hit) o = { x: 2 }; }
      else if (id === 'thread7' && n === 7) o = { m: 7 };
      else if (id === 'patch' && new Set(vow).size >= 3) o = { x: 2 };
      else if (id === 'measure' && n >= 5) o = { c: 30 };
      else if (id === 'lemariku' && ctx.inLemari) o = { x: 2 };
      if (o) step(Object.assign(o, { slot: id, label: o.c ? '+' + o.c : o.m ? '+' + o.m + ' Mult' : '×' + String(o.x).replace('.', ',') }));
    });
    const bossHalf = !!(boss && ((boss.id === 'repeater' && !rep) || (boss.id === 'minimal' && n < 5)));
    if (bossHalf) step({ x: 0.5, label: 'Boss ×0,5', boss: true });
    const jackpot = has('jackpot') ? steps.some(x => x.slot === 'jackpot') : null;
    const letters = lv.reduce((a, b) => a + b, 0);
    return { word: w, lv, letters, lenBonus, hand, affix, bossHalf, jackpot, steps, chips, mult, subtotal: chips, final: Math.round(chips * mult) };
  }

  // a card is locked when the boss locks a letter it contains; a wild card is never locked but may not play as that letter
  const blocked = (R, t) => !!(R.boss && R.boss.block && t.ch !== '?' && t.ch.includes(R.boss.block));
  function bossOK(R, w) { return true; }   // every boss rule now changes the score instead of refusing a word (Minimalist: owner 23 Nov)
  const usableOf = R => R.hand.filter(t => !blocked(R, t));
  // spell w with the usable cards: exact cards first (upgraded first), wild cards last. Returns [{t, as}] or null.
  function spell(R, w, usable) {
    const pool = usable.slice().sort((a, b) => (a.ch === '?') - (b.ch === '?') || (b.ch.length - a.ch.length) || ((b.up ? 1 : 0) - (a.up ? 1 : 0)));
    const lock = R.boss && R.boss.block, used = new Set(), out = [];
    (function go(i) {
      if (i === w.length) return true;
      for (const t of pool) {
        if (used.has(t.id)) continue;
        let as = null, len;
        if (t.ch === '?') { if (w[i] === lock) continue; as = w[i]; len = 1; }
        else if (w.startsWith(t.ch, i)) len = t.ch.length; else continue;
        used.add(t.id); out.push({ t, as });
        if (go(i + len)) return true;
        used.delete(t.id); out.pop();
      }
      return false;
    }(0)) || (out.length = 0);
    return out.length ? out : null;
  }
  // quick letter-count filter before the (rare) full spelling search
  function feasible(w, have, wilds) {
    const need = {}; let miss = 0;
    for (const c of w) { need[c] = (need[c] || 0) + 1; if (need[c] > (have[c] || 0)) { miss++; if (miss > wilds) return false; } }
    return true;
  }
  function candidates(R, firstOnly) {
    const usable = usableOf(R), have = {}; let wilds = 0, letters = 0;
    usable.forEach(t => { if (t.ch === '?') { wilds++; letters++; } else for (const c of t.ch) { have[c] = (have[c] || 0) + 1; letters++; } });
    const out = [];
    for (const w of ARR) {
      if (w.length > letters || !bossOK(R, w) || !feasible(w, have, wilds) || !spell(R, w, usable)) continue;
      out.push(w); if (firstOnly) break;
    }
    return out;
  }
  // cards for a word (bots/tests): wild cards get the letter they play as
  function tilesFor(R, w) { const s = spell(R, w, usableOf(R)); return s ? s.map(x => { if (x.as) x.t.as = x.as; return x.t; }) : null; }
  function best(G, R) {
    let b = null; const nr = () => 0.99;
    for (const w of candidates(R)) {
      const tl = tilesFor(R, w); if (!tl) continue;
      const ids = new Set(tl.map(t => t.id)), s = score(tl, G.fabrics, { first: !R.firstDone, chain: R.chain, lv: G.handLv, held: R.hand.filter(t => !ids.has(t.id)) }, R.boss, nr);
      if (!b || s.final > b.s.final) b = { w, tl: tl.slice(), as: tl.map(t => t.as), s };
    }
    if (b) b.tl.forEach((t, i) => { t.as = b.as[i]; });
    return b;
  }

  /* Decks ("Kain"), Balatro-style: chosen at the start of a run; all but the basic one are opened by an achievement */
  const DECKS = [
    { id: 'base', name: 'Kain Dasar', icon: '🧵', desc: 'Supply huruf acak biasa.' },
    { id: 'noun', name: 'Kain Noun', icon: '📦', desc: 'Supply berisi kartu NESS, MENT, TION, ER. Hand Noun mulai Lv2.', cards: ['ness', 'ment', 'tion', 'er'], lv: 'n' },
    { id: 'verb', name: 'Kain Verb', icon: '🏃', desc: 'Supply berisi kartu ING, ED, RE, UN. Hand Verb mulai Lv2.', cards: ['ing', 'ed', 're', 'un'], lv: 'v' },
    { id: 'adj', name: 'Kain Adjective', icon: '🎨', desc: 'Supply berisi kartu FUL, OUS, ABLE, LESS. Hand Adjective mulai Lv2.', cards: ['ful', 'ous', 'able', 'less'], lv: 'a' },
    { id: 'adv', name: 'Kain Adverb', icon: '⚡', desc: 'Supply berisi kartu LY, LY, ? . Hand Adverb mulai Lv2.', cards: ['ly', 'ly', '?'], lv: 'r' },
    { id: 'long', name: 'Kain Panjang', icon: '📜', desc: 'Tangan 9 kartu sejak awal, tapi supply −4.', hand: 1, extra: -4 },
    { id: 'vowel', name: 'Kain Vokal', icon: '🅰️', desc: 'Supply ekstra A, E, I, O.', cards: ['a', 'e', 'i', 'o'] },
    { id: 'gold', name: 'Kain Emas', icon: '🥇', desc: 'Mulai dengan 3 huruf Gold (E, R, T).', gold: ['e', 'r', 't'] },
    { id: 'wild', name: 'Kain Wild', icon: '❓', desc: 'Supply berisi 2 kartu wild ?.', cards: ['?', '?'] }
  ];
  const DECK = {}; DECKS.forEach(d => DECK[d.id] = d);
  /* Achievements (owner 23 Nov: hard, so they take many runs). "total" ones add up the runs saved on the server (the server decides them
     when a run is saved); "run" ones are earned inside one run (claimed at once); lemari50 is decided by the server from the saved words. */
  const ACH = [
    { id: 'boss10', name: 'Penjahit Tangguh', desc: 'Kalahkan 10 boss (total semua run).', total: 'bosses', need: 10, open: ['fabric', 'measure'] },
    { id: 'noun150', name: 'Kolektor Benda', desc: 'Mainkan 150 noun (total semua run).', total: 'nouns', need: 150, open: ['deck', 'noun'] },
    { id: 'verb100', name: 'Banyak Gerak', desc: 'Mainkan 100 verb (total semua run).', total: 'verbs', need: 100, open: ['deck', 'verb'] },
    { id: 'adj60', name: 'Tukang Warna', desc: 'Mainkan 60 adjective (total semua run).', total: 'adjs', need: 60, open: ['deck', 'adj'] },
    { id: 'adv25', name: 'Si Paling Adverb', desc: 'Mainkan 25 adverb (total semua run).', total: 'advs', need: 25, open: ['deck', 'adv'] },
    { id: 'affix10', name: 'Tukang Imbuhan', desc: 'Mainkan 10 kata dengan prefiks dan sufiks sekaligus (total).', total: 'affix_words', need: 10, open: ['deck', 'wild'] },
    { id: 'giant5', name: 'Kata Raksasa', desc: 'Mainkan 5 kata 10 huruf atau lebih (total).', total: 'giant_words', need: 5, open: ['deck', 'long'] },
    { id: 'minimal5', name: 'Penakluk Minimalist', desc: 'Kalahkan The Minimalist 5 kali (total).', total: 'minimals', need: 5, open: ['deck', 'vowel'] },
    { id: 'calm', name: 'Tangan Tenang', desc: 'Selesaikan satu stage penuh (2 ronde + boss) tanpa Buang sama sekali.', run: true, open: ['fabric', 'steady'] },
    { id: 'stage8', name: 'Sampai Stage 8', desc: 'Capai Stage 8 dalam satu run.', run: true, open: ['deck', 'gold'] },
    { id: 'lemari50', name: 'Pengumpul', desc: 'Simpan 50 kata dari game ke Lemari (total).', total: 'lemari', need: 50, open: ['fabric', 'lemariku'] }
  ];
  // what an achievement list opens: { fabrics: [...], decks: [...] }
  function opened(achIds) {
    const o = { fabrics: [], decks: ['base'] };
    ACH.forEach(a => { if ((achIds || []).includes(a.id)) (a.open[0] === 'deck' ? o.decks : o.fabrics).push(a.open[1]); });
    return o;
  }
  // "run" achievements earned inside this run
  function earned(G) {
    const out = [];
    if (G.stats.calm) out.push('calm');
    if (G.stage >= 7) out.push('stage8');
    return out;
  }
  // this run's counts, sent with the result; the server adds them up for the "total" achievements
  function runCounts(G) {
    const st = G.stats, pc = st.pos || {};
    return { nouns: pc.n || 0, verbs: pc.v || 0, adjs: pc.a || 0, advs: pc.r || 0, bosses: st.bosses || 0, minimals: st.minimals || 0, affix_words: st.affixWords || 0, giant_words: st.giantWords || 0 };
  }

  function newGame(starterId, deckId, unlocked) {
    const G = { stage: 0, rnd: 0, fabrics: starterId ? [starterId] : [], upgrades: [], coins: 0, extra: 0, letterAdds: [], handBonus: 0, discardBonus: 0, bosses: [],
      handLv: { o: 1, n: 1, v: 1, a: 1, r: 1 }, deck: DECK[deckId] ? deckId : 'base', unlocked: (unlocked || []).slice(),
      stats: { words: 0, longest: '', best: { w: '', s: 0 }, total: 0, list: [], pos: { o: 0, n: 0, v: 0, a: 0, r: 0 }, bosses: 0 } };
    const d = DECK[G.deck];
    (d.cards || []).forEach(c => G.letterAdds.push(c));
    if (d.lv) G.handLv[d.lv] = 2;
    if (d.hand) G.handBonus = d.hand;
    if (d.extra) G.extra = d.extra;
    (d.gold || []).forEach(c => G.upgrades.push(mk(c, 'gold')));
    return G;
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
  function submit(G, R, tl, rng, ctxExtra) {
    if (tl.some(t => t.ch === '?' && !t.as)) return { ok: false, msg: 'Pilih dulu huruf untuk kartu ?.' };
    if (tl.some(t => t.ch === '?' && R.boss && t.as === R.boss.block)) return { ok: false, msg: 'Huruf ' + R.boss.block.toUpperCase() + ' sedang dikunci boss.' };
    const w = tl.map(txt).join('');
    if (w.length < 3) return { ok: false, msg: 'Minimal 3 huruf.' };
    if (!isWord(w)) return { ok: false, msg: '“' + w.toUpperCase() + '” belum ada di kamus.' };
    const used = new Set(tl.map(t => t.id)), held = R.hand.filter(t => !used.has(t.id));
    const res = score(tl, G.fabrics, Object.assign({ first: !R.firstDone, chain: R.chain, lv: G.handLv, held }, ctxExtra || {}), R.boss, rng);
    R.score += res.final; R.words++; R.firstDone = true;
    R.chain = w.length >= 5 ? R.chain + 1 : 0;
    const ids = new Set(tl.map(t => t.id));
    R.hand = R.hand.filter(t => !ids.has(t.id));
    const st = G.stats; st.words++; st.total += res.final;
    if (w.length > st.longest.length) st.longest = w;
    if (res.final > st.best.s) st.best = { w, s: res.final };
    st.list.push({ w, s: res.final, p: res.hand.pos });
    st.pos = st.pos || {}; st.pos[res.hand.pos] = (st.pos[res.hand.pos] || 0) + 1;
    if (res.affix.length === 2) st.affixWords = (st.affixWords || 0) + 1;   // a prefix first and a suffix last
    if (w.length >= 10) st.giantWords = (st.giantWords || 0) + 1;
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
  const stuck = R => candidates(R, true).length === 0;
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
    let coins = CFG.coinRound + G.stage, saver = 0, steady = 0;
    if (G.fabrics.includes('saver')) saver = Math.floor((R.hand.length + R.supply.length) / 3);
    const st = G.stats, noDisc = R.discards === R.maxDiscards;
    if (noDisc) { if (G.fabrics.includes('steady')) steady = 2; } else st.stageDisc = true;
    if (R.boss) {
      st.bosses = (st.bosses || 0) + 1; if (R.boss.id === 'minimal') st.minimals = (st.minimals || 0) + 1;
      if (!st.stageDisc) st.calm = true;   // a whole stage (2 rounds + boss) won without a discard
      st.stageDisc = false;
    }
    G.coins += coins + saver + steady; return { coins, saver, steady };
  }
  function rewardOptions(G, rng) {
    const owned = new Set(G.fabrics), pool = FABRICS.filter(f => !owned.has(f.id) && avail(G, f));
    const opts = [];
    const kinds = shuffle(['fabric', 'fabric', 'up', 'coin', 'book', 'multi'], rng);
    for (const k of kinds) {
      if (opts.length >= 3) break;
      if (k === 'fabric') { const f = pool.filter(f => !opts.some(o => o.id === f.id))[Math.floor(rng() * pool.length)]; if (f) opts.push({ type: 'fabric', id: f.id }); }
      else if (k === 'up') opts.push(upItem(rng));
      else if (k === 'book') opts.push(bookItem(rng));
      else if (k === 'multi') opts.push(multiItem(rng));
      else opts.push({ type: 'coin', n: 6 });
    }
    while (opts.length < 3) opts.push(rng() < 0.6 ? upItem(rng) : { type: 'coin', n: 6 + G.stage });
    if (!opts.some(o => ['up', 'multi', 'wild', 'book', 'letter'].includes(o.type))) opts[2] = rng() < 0.5 ? upItem(rng) : multiItem(rng);   // a card upgrade is always on offer
    return opts;
  }
  const upItem = rng => ({ type: 'up', kind: ['gold', 'ruby', 'glass', 'steel'][Math.floor(rng() * 4)], ch: randLetter(rng) });
  const priced = o => Object.assign(o, { price: CFG.price[o.type === 'up' ? o.kind : o.type] });
  // card section: 2 Gold/Glass letters, 1 letter, 2 multi-letter (or wild) cards, 1 grammar book
  function shopCards(G, rng) {
    return [upItem(rng), upItem(rng), { type: 'letter', ch: randLetter(rng) }, multiItem(rng), multiItem(rng), bookItem(rng)].map(o => Object.assign(priced(o), { sec: 'card' }));
  }
  function shopFabrics(G, rng) {
    const owned = new Set(G.fabrics);
    return shuffle(FABRICS.filter(f => !owned.has(f.id) && avail(G, f)), rng).slice(0, 3).map(f => ({ type: 'fabric', id: f.id, price: CFG.price.fabric, sec: 'fabric' }));
  }
  function shopItems(G, rng) { return shopCards(G, rng).concat(shopFabrics(G, rng)); }
  // reroll one section only; the other section keeps its offers (and what was already bought)
  function rerollShop(G, shop, sec, rng) { return shop.filter(o => (o.sec || (o.type === 'fabric' ? 'fabric' : 'card')) !== sec).concat(sec === 'fabric' ? shopFabrics(G, rng) : shopCards(G, rng)); }
  const bookItem = rng => ({ type: 'book', pos: 'nvar'[Math.floor(rng() * 4)] });
  // a multi-letter card, or (1 in 5) a wild card; both join the supply of every later round
  const multiItem = rng => rng() < 0.2 ? { type: 'wild', ch: '?' } : { type: 'multi', ch: MULTI[Math.floor(rng() * MULTI.length)] };
  // always-available permanent upgrades; price rises with each purchase
  function permItems(G) {
    const out = [];
    out.push({ type: 'supply', n: CFG.supplyPack, price: CFG.price.supply + Math.floor(Math.max(0, G.extra) / CFG.supplyPack) });
    out.push({ type: 'discard', price: 6 + 3 * G.discardBonus });
    out.push({ type: 'hand', price: 8 + 4 * G.handBonus, maxed: G.handBonus >= CFG.handMaxBuys });
    return out;
  }
  function addUpgrade(G, kind, ch) { G.upgrades.push(mk(ch, kind)); }
  // after restoring a saved run: new tile ids must not collide with the restored ones
  function resumeIds(G, R) { let m = 0; const see = t => { if (t.id > m) m = t.id; }; G.upgrades.forEach(see); if (R) { R.hand.forEach(see); R.supply.forEach(see); } if (m >= UID) UID = m + 1; }
  return { UPS, HAND_STEP, DECKS, DECK, ACH, opened, earned, runCounts, avail, val, txt, kindOf, HANDS, MULTI, PRE, SUF, PAIRS, posOf, lvOf, handInfo, spell, V, LB, CFG, FABRICS, FAB, BOSSES, setDict, isWord, rngFrom, shuffle, mk, score, blocked, candidates, tilesFor, best, newGame,
    roundIndex, targetFor, handSize, permItems, makeRound, draw, submit, stuck, failed, discard, canDiscard, finishRound, rewardOptions, shopItems, shopCards, shopFabrics, rerollShop, addUpgrade, resumeIds, randLetter, get ARR() { return ARR; } };
})();

/* ---------- UI (only runs in the browser, after the host page calls WRGame.init) ---------- */
const UI = (function () {
  const E = Engine, F = id => E.FAB[id];
  const KEY = 'wr_game', BEST = 'wr_game_best';
  const REG = [['yarn', 'Si Kusut'], ['button', 'Kancing Nakal'], ['needle', 'Jarum Jahil'], ['pin', 'Peniti Pelit'], ['iron', 'Setrika Sinis'], ['hanger', 'Hanger Galak']];
  let host = null, root = null, body = null, ready = null, mounted = false;
  let best = 0, G = null, R = null, phase = 'intro', sel = [], msg = '', last = null, starters = [], rewards = [], shop = [], modal = null, fx = null, shake = false;
  let anim = null, sendState = '', sendErr = '', means = {}, achOwned = [], achTotals = {}, achNew = [], deckOpts = [], toastTimer = null;
  const ACHKEY = 'wr_game_ach';
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
.bq-goal{height:11px;background:var(--card-2);border-radius:999px;overflow:hidden;margin:4px 0 0}.bq-goal i{display:block;height:100%;background:linear-gradient(90deg,#4fa3ff,#7ee0b5);transition:width .5s}.bq-goal.over i{background:linear-gradient(90deg,#ff6b6b,#ffd23f,#7ee0b5,#4fa3ff,#c08bff)}
.bq-gt{font-size:11.5px;font-weight:800;color:var(--muted)}
.bq-k{font-size:10.5px;font-weight:800;border-radius:6px;padding:1px 5px;background:var(--card-2);color:var(--muted);vertical-align:middle}.bq-k.c{background:#2f7fd1;color:#fff}.bq-k.m{background:#e0475f;color:#fff}.bq-k.x{background:#8a2be2;color:#fff}
.bq-tile.ruby{background:linear-gradient(135deg,#ffb3c0,#ff5f7e);box-shadow:0 3px 0 #b8324f}.bq-tile.steel{background:linear-gradient(135deg,#e3e7ee,#9aa4b2);box-shadow:0 3px 0 #626b78}
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
.bq-tile.multi{font-size:16px;letter-spacing:-.5px}.bq-tile.wild{background:linear-gradient(135deg,#ffd9e6,#c9b8ff);box-shadow:0 3px 0 #8f7bc8}
.bq-tile.wild i{position:absolute;left:4px;top:1px;font:800 10px var(--ui);font-style:normal;opacity:.7}
.bq-chip.h{background:var(--blue);color:#fff;font-weight:800}
.bq-mute.off{opacity:.35;text-decoration:line-through}.bq-toast{position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:30;background:var(--yellow);color:var(--on-accent);border-radius:16px;padding:10px 16px;font-weight:800;font-size:14px;box-shadow:0 6px 20px #0006;max-width:92vw;animation:bq-pop .3s}
.bq-giveup{border:0;background:none;color:var(--muted);font:inherit;font-size:12px;font-weight:700;cursor:pointer;padding:2px 0;align-self:center}
.bq-ach{display:flex;gap:10px;align-items:center;background:var(--card);border-radius:16px;padding:10px 12px}.bq-ach.lock{opacity:.6}.bq-ach .ic{font-size:24px}.bq-ach b{display:block}
.bq-mute{border:0;background:var(--card-2);color:var(--text);border-radius:999px;width:36px;height:30px;font-size:15px;cursor:pointer;flex:none}
.bq-abc{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;margin-top:10px}.bq-abc .bq-tile{width:auto;height:46px;font-size:20px}
.bq-wl .row{cursor:pointer}.bq-wl .row s{text-decoration:none;font-size:11px;font-weight:800;color:var(--accent-text);margin-left:6px}
.bq-wl .mean{background:var(--card);border-radius:12px;padding:8px 12px;font-size:13px;margin:-2px 0 2px}.bq-wl .mean b{font-family:var(--ui);font-size:14px}
.bq-bar.cm{align-items:center;gap:8px}.bq-cm{display:flex;align-items:center;gap:5px;font-weight:800}
.bq-cm b{display:inline-block;min-width:46px;text-align:center;border-radius:10px;padding:3px 8px;font:800 17px var(--display);color:#fff;transition:transform .12s}
.bq-cm .c{background:#2f7fd1}.bq-cm .m{background:#e0475f}.bq-cm .x{color:var(--muted)}
.bq-cm b.pulse{transform:scale(1.25)}.bq-cm .tot{background:none;color:var(--text);min-width:0;padding:0 2px}
.bq-cm .tot.rain{background:linear-gradient(90deg,#ff6b6b,#ffd23f,#7ee0b5,#4fa3ff,#c08bff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:bq-pop .4s}
.bq-sc{margin-left:auto;text-align:right;font-size:11.5px;line-height:1.25;color:var(--muted)}.bq-sc b{color:var(--text)}
.bq-speed{border:0;background:var(--card-2);color:var(--text);border-radius:999px;height:30px;padding:0 9px;font:inherit;font-size:12px;font-weight:800;cursor:pointer;flex:none}
.bq-tile.hit{transform:translateY(-6px) scale(1.08);box-shadow:0 0 0 3px var(--yellow)}.bq-slot.hit{animation:bq-sh .3s;box-shadow:0 0 0 2px var(--yellow)}
.bq-fly{position:absolute;left:50%;top:-6px;transform:translateX(-50%);font:800 13px var(--ui);color:#fff;background:#2f7fd1;border-radius:8px;padding:1px 6px;pointer-events:none;white-space:nowrap;animation:bq-fly .6s forwards;z-index:3}
.bq-fly.m{background:#e0475f}.bq-fly.l{left:0;top:-22px;animation-name:bq-flyl}@keyframes bq-flyl{from{opacity:0;transform:translateY(6px)}25%{opacity:1}to{opacity:0;transform:translateY(-14px)}}@keyframes bq-fly{from{opacity:0;transform:translate(-50%,6px)}25%{opacity:1}to{opacity:0;transform:translate(-50%,-26px)}}
.bq-spark{position:absolute;width:7px;height:7px;border-radius:2px;pointer-events:none;animation:bq-spark .55s forwards}@keyframes bq-spark{to{opacity:0;transform:translate(var(--dx),var(--dy)) rotate(160deg)}}
.bq-tile i.af{position:absolute;left:3px;top:1px;font:800 9px var(--ui);font-style:normal;color:#e0475f}
.bq-arti{border:0;background:var(--card-2);color:var(--text);border-radius:999px;font:inherit;font-size:12px;font-weight:800;padding:3px 9px;margin-right:6px;cursor:pointer;vertical-align:middle}
.bq-mean{font-size:15px;display:flex;flex-direction:column;gap:4px;margin-top:6px}.bq-mean b{font-size:18px}
.bq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.bq-gi{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:2px;text-align:left;background:var(--card);border:1.5px solid var(--line);border-radius:16px;padding:10px 10px 8px;color:var(--text);font:inherit;font-size:13px;cursor:pointer;min-height:112px}
.bq-gi .ic{font-size:24px;margin:0}.bq-gi b{font-size:14px;line-height:1.2}.bq-gi .d{font-size:11.5px;line-height:1.3;color:var(--muted);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin:0}
.bq-gi .pr{margin-top:auto;font-weight:800;color:var(--accent-text);font-size:13px}.bq-gi.sold{opacity:.4;cursor:default}.bq-gi.poor .pr{color:var(--muted)}
.bq-sec{display:flex;justify-content:space-between;align-items:center;margin-top:4px}.bq-sec b{font-family:var(--display);font-size:17px}
.bq-hands{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.bq-hands span{background:var(--card);border-radius:12px;padding:6px 10px;font-size:12px}
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
.bq-modal .add{min-height:44px;padding:0 16px;border:0;border-radius:999px;background:var(--yellow);color:var(--on-accent);font:inherit;font-weight:800;font-size:14px;cursor:pointer;flex:1}.bq-modal .add:disabled{background:var(--card-2);color:var(--muted)}
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
@media(max-height:680px){.bq-r{--bq-art:56px;gap:6px}.bq-r .bq-btn{min-height:40px}.bq-r .bq-slot{min-height:34px}.bq-r .bq-giveup{padding:0}.bq-r .bq-bar,.bq-r .bq-boss{font-size:11px}.bq-r .bq-boss{padding:4px 8px}.bq-r .bq-hand .bq-tile{height:42px}.bq-r .bq-prev{min-height:66px}}
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
    G.handLv = G.handLv || { o: 1, n: 1, v: 1, a: 1, r: 1 }; G.unlocked = G.unlocked || []; G.newAch = G.newAch || []; G.deck = G.deck || 'base';
    if (R) [].concat(R.hand, R.supply).forEach(t => { delete t.as; });
  }

  /* ---------- background music: a soft loop made in the browser (Web Audio), no file to download ---------- */
  // one AudioContext for music and sound effects, made on the first tap (browsers only allow sound after a tap)
  let ac = null, musicOut = null, sfxOut = null;
  function audio() {
    if (ac) return ac;
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return null;
    ac = new C();
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600; f.connect(ac.destination);
    musicOut = ac.createGain(); musicOut.gain.value = 0.09; musicOut.connect(f);
    sfxOut = ac.createGain(); sfxOut.gain.value = 0.22; sfxOut.connect(ac.destination);
    return ac;
  }
  const hz = m => 440 * Math.pow(2, (m - 69) / 12);
  function tone(out, f, t, dur, type, vol, f2) {
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(out, t, dur, vol, from, to) {
    const n = Math.floor(ac.sampleRate * dur), buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource(), bp = ac.createBiquadFilter(), g = ac.createGain();
    src.buffer = buf; bp.type = 'bandpass'; bp.Q.value = 1.2; bp.frequency.setValueAtTime(from, t); bp.frequency.exponentialRampToValueAtTime(to, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(bp); bp.connect(g); g.connect(out); src.start(t); src.stop(t + dur);
  }
  const Music = (function () {
    const KEYM = 'wr_game_music', STEP = 60 / 84 / 2;   // eighth notes at 84 bpm
    const CHORDS = [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]];   // C, Am, F, G
    const MEL = [72, null, 76, 74, null, 72, 69, null, 72, null, 69, 67, null, 64, 67, null, 69, null, 72, 69, null, 65, 67, null, 67, null, 71, 74, null, 72, null, null];
    let timer = null, step = 0, next = 0, on = store.get(KEYM) !== '0';
    function tick() {
      while (next < ac.currentTime + 0.25) {
        const ch = CHORDS[Math.floor(step / 8) % 4], i = step % 8, mel = MEL[step % 32];
        if (i === 0) tone(musicOut, hz(ch[0] - 24), next, STEP * 7, 'triangle', 0.5);
        tone(musicOut, hz(ch[[0, 1, 2, 1][i % 4]] + (i >= 4 ? 12 : 0)), next, STEP * 1.6, 'sine', 0.16);
        if (mel) tone(musicOut, hz(mel), next, STEP * 2.4, 'sine', 0.22);
        next += STEP; step++;
      }
    }
    function start() {
      if (!on || timer) return;
      try { if (!audio()) return; ac.resume(); next = ac.currentTime + 0.1; timer = setInterval(tick, 60); tick(); } catch (e) { timer = null; /* no audio: play silently */ }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function toggle() { on = !on; store.set(KEYM, on ? '1' : '0'); if (on) start(); else stop(); }
    return { start, stop, toggle, get on() { return on; }, get playing() { return !!timer; } };
  })();
  /* sound effects, also made in the browser: attack, coin "cring", win, wrong word, discard, run over, letter tap, achievement */
  const Sfx = (function () {
    const KEYS = 'wr_game_sfx'; let on = store.get(KEYS) !== '0', lastPlayed = '';
    const SOUNDS = {
      tick(t, k) { tone(sfxOut, 1400 * Math.pow(1.06, k || 0), t, 0.05, 'sine', 0.13); },
      ding(t, k) { tone(sfxOut, hz(79 + 2 * (k || 0)), t, 0.25, 'triangle', 0.4); tone(sfxOut, hz(91 + 2 * (k || 0)), t + 0.03, 0.2, 'sine', 0.15); },
      attack(t) { noise(sfxOut, t, 0.22, 0.5, 600, 3000); tone(sfxOut, 160, t + 0.18, 0.25, 'sine', 0.9, 55); },
      coin(t) { tone(sfxOut, 1319, t, 0.12, 'square', 0.12); tone(sfxOut, 1760, t + 0.07, 0.35, 'sine', 0.5); tone(sfxOut, 2637, t + 0.07, 0.25, 'sine', 0.15); },
      win(t) { [72, 76, 79, 84].forEach((m, i) => tone(sfxOut, hz(m), t + i * 0.09, 0.35, 'triangle', 0.5)); },
      bad(t) { tone(sfxOut, 180, t, 0.16, 'square', 0.18, 120); },
      discard(t) { noise(sfxOut, t, 0.18, 0.4, 2500, 700); },
      over(t) { [67, 64, 60, 55].forEach((m, i) => tone(sfxOut, hz(m), t + i * 0.18, 0.4, 'triangle', 0.45)); },
      unlock(t) { [79, 84, 88, 91].forEach((m, i) => tone(sfxOut, hz(m), t + i * 0.07, 0.3, 'sine', 0.4)); SOUNDS.coin(t + 0.3); }
    };
    function play(name, k) {
      lastPlayed = name;
      if (!on || document.hidden || (root && root.hidden)) return;
      try { if (!audio()) return; ac.resume(); SOUNDS[name](ac.currentTime + 0.01, k); } catch (e) { /* no audio */ }
    }
    function toggle() { on = !on; store.set(KEYS, on ? '1' : '0'); if (on) play('coin'); }
    return { play, toggle, get on() { return on; }, get last() { return lastPlayed; } };
  })();
  const soundHtml = () => `<button type="button" class="bq-mute ${Music.on ? '' : 'off'}" data-a="music" aria-label="Musik latar" aria-pressed="${Music.on}">🎵</button><button type="button" class="bq-mute ${Sfx.on ? '' : 'off'}" data-a="sfx" aria-label="Efek suara" aria-pressed="${Sfx.on}">🔔</button>`;

  /* ---------- end of run: meaning of a word (looked up only when tapped) ---------- */
  const escH = x => String(x == null ? '' : x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  function meanHtml(m) {
    if (m.state === 'loading') return '<span class="bq-mut">Mencari arti…</span>';
    if (m.state === 'err') return '<span class="bq-msg">' + escH(m.msg) + '</span>';
    const r = m.r || {};
    return '<b>' + escH(r.translation || '-') + '</b>' + (r.phonetic ? ' <span class="bq-mut">' + escH(r.phonetic) + '</span>' : '') + (r.definition ? '<div>' + escH(r.definition) + '</div>' : '') + (r.example ? '<div class="bq-mut">“' + escH(r.example) + '”</div>' : '');
  }
  function showMeaning(w) {
    const el = body.querySelector('[data-mean="' + w + '"]'), m = means[w]; if (!el || !m) return;
    el.hidden = !m.open; el.innerHTML = meanHtml(m);
  }
  // look a word up once per run; the answer is kept for the popup during play and for the summary
  function fetchMeaning(w, done) {
    const m = means[w];
    if (m && m.state !== 'err') { done(); return; }
    means[w] = { state: 'loading', open: false }; done();
    host.lookup(w).then(r => { means[w] = { state: 'ok', open: false, r: r }; done(); },
      e => { means[w] = { state: 'err', open: false, msg: e && e.message ? e.message : 'Arti belum bisa dimuat.' }; if (host.failed) host.failed(e); done(); });
  }
  // after the meaning arrives, "+ Lemari" saves it with that meaning
  function refreshAdd(w) {
    const row = body.querySelector('.row[data-i="' + w + '"]'); if (!row) return;
    const old = row.querySelector('.add'); if (!old || old.disabled) return;
    try { const b = host.addButton(w, means[w].r.translation || ''); if (b) { b.addEventListener('click', ev => ev.stopPropagation()); old.replaceWith(b); } } catch (e) { /* keep the old button */ }
  }

  /* ---------- html pieces ---------- */
  const label = () => 'Stage ' + (G.stage + 1) + ' · ' + (G.rnd === 2 ? 'Boss' : 'Ronde ' + (G.rnd + 1));
  const isBoss = () => G.rnd === 2;
  function chipsOf(s) {
    let h = s.hand ? handChip(s.hand) : '';
    (s.steps || []).forEach(x => {
      if (x.slot) h += `<span class="bq-chip ${x.x ? 'j' : x.m ? 'm' : 'a'}">${F(x.slot).icon} ${x.label}</span>`;
      else if (x.tile !== undefined && x.label) h += `<span class="bq-chip ${x.x ? 'j' : x.m ? 'm' : 'a'}">${x.label}</span>`;
      else if (x.held) h += `<span class="bq-chip j">🔩 ${x.label}</span>`;
      else if (x.boss) h += `<span class="bq-chip j">${x.label}</span>`;
    });
    if (s.jackpot === false) h += '<span class="bq-chip">🎰 tidak kena</span>';
    return h;
  }

  const tileHtml = (t, cls, attrs) => { const k = E.kindOf(t.ch), face = k === 'wild' ? (t.as || '?') : t.ch;
    return `<button type="button" class="bq-tile ${t.up || ''} ${k === 'wild' ? 'wild' : k !== 'letter' ? 'multi' : ''} ${cls || ''}" ${attrs || ''}>${k === 'wild' && t.as ? '<i>?</i>' : ''}${face}<small>${k === 'wild' && !t.as ? '½' : E.val(t)}</small></button>`; };
  const fmt = n => String(n).replace('.', ',');
  const handChip = h => `<span class="bq-chip h">${h.icon} ${h.name} Lv${h.lv} · ${h.chips} × ${h.mult}</span>`;
  const KINDTAG = { chips: '<span class="bq-k c">+Chips</span>', add: '<span class="bq-k m">+Mult</span>', x: '<span class="bq-k x">×Mult</span>', util: '<span class="bq-k">Utilitas</span>' };
  const fabricCard = (id, tag) => { const f = F(id); return `<span class="ic">${f.icon}</span><b>${f.name}</b> ${KINDTAG[f.kind] || ''}${tag || ''}<span class="d">${f.desc}</span>`; };
  function optHtml(o) {
    const U = o.ch ? o.ch.toUpperCase() : '';
    if (o.type === 'fabric') return fabricCard(o.id);
    if (o.type === 'up') { const u = E.UPS[o.kind]; return `<span class="ic">${u.icon}</span><b>${u.name} · huruf ${U}</b><span class="d">${u.desc} Permanen: masuk supply tiap ronde sampai run selesai.</span>`; }
    if (o.type === 'letter') return `<span class="ic">🔤</span><b>Huruf ${U}</b><span class="d">Satu huruf ${U} ditambahkan ke supply di semua ronde berikutnya.</span>`;
    if (o.type === 'book') { const h = E.HANDS[o.pos], now = E.handInfo(o.pos, E.lvOf(G, o.pos)), nx = E.handInfo(o.pos, now.lv + 1);
      return `<span class="ic">📖</span><b>Buku ${h.name} · Lv${nx.lv}</b><span class="d">Hand ${h.name} naik: ${now.chips} Chips × ${now.mult} Mult → ${nx.chips} × ${nx.mult}.</span>`; }
    if (o.type === 'multi') { const k = E.kindOf(o.ch);
      return `<span class="ic">🧩</span><b>Kartu ${U}</b><span class="d">${k === 'pre' ? 'Prefiks: di awal kata ×1,5.' : k === 'suf' ? 'Sufiks: di akhir kata ×1,5.' : 'Gabungan huruf, bebas di posisi mana pun.'} 1 kartu = ${o.ch.length} huruf. Masuk supply semua ronde berikutnya.</span>`; }
    if (o.type === 'wild') return `<span class="ic">❓</span><b>Kartu wild ?</b><span class="d">Jadi huruf apa pun yang kamu pilih, nilainya setengah huruf itu. Masuk supply semua ronde berikutnya.</span>`;
    if (o.type === 'discard') return `<span class="ic">🗑️</span><b>+1 jatah Buang per ronde</b><span class="d">Sekarang ${E.CFG.discards + G.discardBonus} per ronde.</span>`;
    if (o.type === 'hand') return `<span class="ic">✋</span><b>+1 kartu di tangan</b><span class="d">Tangan jadi ${E.handSize(G) + 1} kartu (maks. 12; di atas 9 kartu tangan jadi 2 baris).</span>`;
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
    const en = enemyInfo(), sc = anim ? anim.before : R.score, pct = Math.min(100, sc / R.target * 100), over = sc > R.target, f = fx; fx = null;
    const say = f && f.say ? `<div class="bq-say">${f.say}</div>` : '';
    const art = `<img src="${en.img}" alt="">`;
    return `<div class="bq-arena">${say}${f ? `<div class="bq-dmg">+${fmtN(f.dmg)}</div>` : ''}
      <div class="bq-fig"><div class="bq-img ${f ? 'bq-atk' : ''}"><img src="img/game/bibo-${pose()}.webp" alt="Bibo"></div><div class="bq-name">Bibo</div></div><div class="bq-vs">VS</div>
      <div class="bq-fig"><div class="bq-img ${f ? 'bq-ehit' : ''} ${R.cleared && !anim ? 'bq-dead' : ''}">${art}</div><div class="bq-goal ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div><div class="bq-name">${en.n}</div><div class="bq-gt">${fmtN(sc)} / ${fmtN(R.target)}${over ? ' 🔥' : ''}</div></div></div>`;
  }

  const fmtM = m => fmtN(Math.round(m * 100) / 100);
  // 1.240 · 12,4 rb · 3,2 jt · 1,5 M · 2 T (short enough for a phone)
  function fmtN(v) {
    const a = Math.abs(v), r = (x, u) => (Math.round(x * 10) / 10).toString().replace('.', ',') + ' ' + u;
    if (a >= 999950000000) return r(v / 1e12, 'T'); if (a >= 999950000) return r(v / 1e9, 'M'); if (a >= 999950) return r(v / 1e6, 'jt'); if (a >= 1e4) return r(v / 1e3, 'rb');
    return Number.isInteger(v) ? v.toLocaleString('id-ID') : String(v).replace('.', ',');
  }
  function cmHtml(cm, shown) {
    return `<div class="bq-bar cm"><span class="bq-cm"><b class="c" id="bq-c">${cm ? fmtN(cm.c) : 0}</b><span class="x">×</span><b class="m" id="bq-m">${cm ? fmtM(cm.m) : 0}</b>${cm && cm.t !== undefined ? `<span class="x">=</span><b class="tot" id="bq-t">${fmtN(cm.t)}</b>` : '<b class="tot" id="bq-t"></b>'}</span>
      <span class="bq-sc">Skor ronde <b>${fmtN(shown)}</b><br>Target <b>${fmtN(R.target)}</b></span></div>`;
  }
  function roundHtml() {
    let pv = '', cm = null;
    const shown = anim ? anim.before : R.score;
    if (anim) {
      cm = { c: 0, m: 0 };
      pv = `<div class="bq-pl"><b>${anim.res.word.toUpperCase()}</b> · menghitung… <span class="bq-mut">(ketuk untuk lewati)</span></div>`;
    } else if (sel.length) {
      const w = sel.map(E.txt).join('');
      if (w.length >= 3 && E.isWord(w)) {
        const ids = new Set(sel.map(t => t.id)), s = E.score(sel, G.fabrics, { first: !R.firstDone, chain: R.chain, lv: G.handLv, inLemari: inLemari(w), held: R.hand.filter(t => !ids.has(t.id)) }, R.boss, () => 1);
        cm = { c: s.chips, m: s.mult, t: s.final };
        pv = `<div class="bq-pl"><button type="button" class="bq-arti" data-a="artiSel">📖 Arti</button><b>${w.toUpperCase()}</b> → <b>${fmtN(s.final)}</b> poin</div><div class="bq-chips">${chipsOf(Object.assign({}, s, { jackpot: undefined }))}${G.fabrics.includes('jackpot') ? '<span class="bq-chip">🎰 bisa ×2</span>' : ''}</div>`;
      } else pv = `<div class="bq-pl">${w.length < 3 ? 'Pilih minimal 3 huruf untuk kata, atau langsung Buang' : '<b>' + w.toUpperCase() + '</b> belum jadi kata valid (boleh Buang huruf ini)'}</div>`;
    } else pv = '<div class="bq-pl">Ketuk huruf: susun kata untuk menyerang, atau buang huruf yang tidak berguna.</div>';
    const selIds = new Set(sel.map(t => t.id));
    const head = `<div class="bq-top"><div class="t"><b>${label()}</b></div><button type="button" class="bq-speed" data-a="speed" aria-label="Kecepatan hitung skor">${['⚡', '1×', '2×'][speed()]}</button>${soundHtml()}<span class="bq-coin">🪙 ${G.coins}</span></div>${arenaHtml()}
      ${cmHtml(cm, shown)}
      ${R.boss ? `<div class="bq-boss"><b>${R.boss.name}:</b> ${R.boss.desc}${R.boss.block ? ' Terkunci: <b>' + R.boss.block.toUpperCase() + '</b>' : ''}</div>` : ''}`;
    const lastHtml = last && last.res ? `<div class="bq-last bq-pop">Terakhir: <b>${last.res.word.toUpperCase()} +${fmtN(last.res.final)}</b> <button type="button" class="bq-arti" data-a="arti" data-i="${last.res.word}">📖 Arti</button> <span class="bq-mut"></span>${last.res.recycled ? ` ♻️ ${last.res.recycled.toUpperCase()}` : ''}${last.res.extraDraw ? ' 🔄 +1' : ''}<div class="bq-chips">${chipsOf(last.res)}</div></div>` : '';
    if (!sel.length && lastHtml && !anim) pv = lastHtml;
    if (R.cleared && !anim) return head + `<div class="bq-center bq-pop"><h2>${enemyInfo().n} kalah! 🎉</h2><div class="bq-mut">+${last.fin.coins} koin${last.fin.saver ? ` (+${last.fin.saver} Saver)` : ''}</div><button type="button" class="bq-btn pri" style="width:100%;margin-top:10px" data-a="goNext">Ambil hadiah</button></div>`;
    return head + slotsHtml() + `
      <div class="bq-info"><span>📦 Supply ${R.supply.length}</span><span>🗑️ Buang ${R.discards}/${R.maxDiscards}</span><span>📝 ${R.words} kata</span>${R.chain > 0 && G.fabrics.includes('chain') ? `<span>⛓️ chain ${R.chain}</span>` : ''}</div>
      <div class="bq-prev"><div class="bq-sel">${(anim ? anim.tiles : sel).map((t, i, a) => { const k = E.kindOf(t.ch), af = (k === 'pre' && i === 0) || (k === 'suf' && i === a.length - 1);
        return tileHtml(t, '', anim ? '' : `data-a="unsel" data-i="${i}"`).replace('</button>', af ? '<i class="af">+3</i></button>' : '</button>'); }).join('')}</div>${pv}</div>
      <div class="bq-msg" role="status">${msg}</div>
      <div class="bq-hand" style="--bq-n:${R.handSize <= 9 ? R.handSize : Math.ceil(R.handSize / 2)}">${R.hand.map(t => { const lk = E.blocked(R, t), us = selIds.has(t.id); return tileHtml(t, lk ? 'lock' : us ? 'used' : '', lk ? 'disabled' : `data-a="pick" data-i="${t.id}"`); }).join('')}</div>
      <div class="bq-btns"><button type="button" class="bq-btn" data-a="clr" ${sel.length ? '' : 'disabled'}>Hapus</button><button type="button" class="bq-btn mint" data-a="discard" ${sel.length && E.canDiscard(R) ? '' : 'disabled'}>🗑️ Buang${sel.length ? ' ' + sel.length : ''}</button><button type="button" class="bq-btn pri" data-a="send" ${sel.length >= 3 ? '' : 'disabled'}>⚔️ Serang</button></div>
      <button type="button" class="bq-giveup" data-a="giveUp">🏳️ Akhiri run</button>
      <div class="bq-mut bq-kb">Di laptop: ketik huruf untuk memilih, Backspace menghapus, Enter menyerang.</div>`;
  }
  function introHtml() {
    const saved = load(), resumable = saved && saved.phase !== 'end';
    return `<div class="bq-center bq-hero"><img src="img/game/bibo-idle.webp" alt="Bibo"><h2 style="margin-top:6px;font-size:26px">Bibo's Fabric Quest</h2><div class="bq-mut">Susun kata, kalahkan musuh jahit, naik stage sejauh mungkin.</div></div>
      <div class="bq-card"><b>Cara main</b><ul class="bq-mut" style="margin:6px 0 0;padding-left:18px">
        <li>Tangan 8 huruf, supply 32. Ketuk huruf berurutan untuk menyusun kata (3 huruf sampai sebesar tanganmu), lalu Serang.</li>
        <li>Skor kata jadi serangan Bibo. Capai target ronde untuk mengalahkan musuh.</li>
        <li>Huruf jelek? Pilih lalu Buang: ambil huruf baru dari supply (3 kali per ronde).</li>
        <li>Jenis kata = hand: Noun +15, Verb +20 ×1,5, Adjective +30 ×2, Adverb +45 ×3. Naikkan levelnya dengan Buku di shop.</li>
        <li>Di shop ada kartu imbuhan (UN, LY, ING…), gabungan huruf (TH, QU…), dan kartu wild ?.</li>
        <li>Tiap stage: 2 ronde + 1 boss, lalu shop. Run tak berujung; target makin berat tiap stage.</li></ul></div>
      <div class="bq-btns" style="justify-content:center;align-items:center">${soundHtml()}<span class="bq-mut">Musik 🎵 dan efek suara 🔔 (ketuk untuk menyalakan/mematikan)</span></div>
      ${best ? `<div class="bq-card bq-center">🏅 Rekor kamu: <b>Stage ${best}</b></div>` : ''}
      <button type="button" class="bq-btn" style="width:100%" data-a="achList">🏆 Achievement (${achOwned.filter(a => E.ACH.some(x => x.id === a)).length}/${E.ACH.length})</button>
      ${resumable ? '<button type="button" class="bq-btn pri" style="width:100%" data-a="resume">Lanjutkan run</button><button type="button" class="bq-btn" style="width:100%" data-a="start">Mulai run baru</button>' : '<button type="button" class="bq-btn pri" style="width:100%" data-a="start">Mulai run</button>'}`;
  }
  function achHtml() {
    const open = what => what[0] === 'deck' ? E.DECK[what[1]] : E.FAB[what[1]];
    return `<div class="bq-top"><h2 style="flex:1">🏆 Achievement</h2><button type="button" class="bq-btn sm" data-a="achBack">Kembali</button></div>
      <div class="bq-mut">Tersimpan di akunmu. Tiap achievement membuka Kain (dek awal) atau Fabric baru.</div>
      ${E.ACH.map(a => { const got = achOwned.includes(a.id), o = open(a.open), have = Math.min(a.need || 0, achTotals[a.total] || 0);
        const prog = !got && a.total ? `<div class="bq-hp" style="margin-top:4px"><i style="width:${have / a.need * 100}%;background:var(--mint)"></i></div><div class="bq-mut" style="font-size:12px">${have}/${a.need}</div>` : '';
        return `<div class="bq-ach ${got ? '' : 'lock'}"><span class="ic">${got ? '🏆' : '🔒'}</span><div style="flex:1"><b>${a.name}</b><span class="bq-mut">${a.desc}</span><div style="font-size:13px">Membuka ${a.open[0] === 'deck' ? 'Kain' : 'Fabric'}: ${o.icon} <b style="display:inline">${o.name}</b></div>${prog}</div></div>`; }).join('')}
      <div class="bq-mut">Hitungan total bertambah saat run selesai (kalah atau Akhiri run).</div>`;
  }
  function toast(text) {
    let el = document.getElementById('bq-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bq-toast'; el.className = 'bq-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  // new achievements of this run: shown at once, opened Fabrics join the pool at once, saved to the account with the run
  function checkAch() {
    if (!G) return;
    G.newAch = G.newAch || [];
    const fresh = E.earned(G).filter(id => !achOwned.includes(id) && !G.newAch.includes(id));
    fresh.forEach(id => {
      const a = E.ACH.find(x => x.id === id); G.newAch.push(id);
      if (a.open[0] === 'fabric' && !G.unlocked.includes(a.open[1])) G.unlocked.push(a.open[1]);
      toast('🏆 ' + achText(id));
    });
    if (fresh.length) {
      Sfx.play('unlock');
      if (host.claim) host.claim(fresh).then(r => { if (r && r.achievements) setAch(r.achievements, r.totals); }, () => { /* kept in G.newAch: sent again with the run */ });
    }
  }
  const inLemari = w => { try { return !!(host.lemariHas && host.lemariHas(w)); } catch (e) { return false; } };
  function setAch(list, totals) {
    achOwned = (list || []).slice(); if (totals) achTotals = totals;
    store.set(ACHKEY, JSON.stringify({ list: achOwned, totals: achTotals }));
  }
  const achText = id => { const a = E.ACH.find(x => x.id === id), o = a.open[0] === 'deck' ? E.DECK[a.open[1]] : E.FAB[a.open[1]]; return a.name + ' · terbuka: ' + o.icon + ' ' + o.name; };
  function endHtml() {
    const s = G.stats, uniq = []; const seen = {};
    s.list.slice().sort((a, b) => b.s - a.s).forEach(x => { if (!seen[x.w]) { seen[x.w] = 1; uniq.push(x); } });
    const POSN = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
    const sendLine = sendState === 'ok' ? '<div class="bq-mut">Hasil tersimpan.</div>' : sendState === 'sending' ? '<div class="bq-mut">Menyimpan hasil…</div>' : sendState === 'fail' ? `<div class="bq-msg">Hasil belum tersimpan: ${sendErr} <button type="button" class="bq-btn sm" data-a="retry">Coba lagi</button></div>` : '';
    return `<div class="bq-top"><div class="t"><b>${label()}</b><h2>Run berakhir</h2></div></div>${arenaHtml()}
      <div class="bq-card bq-center"><div class="bq-mut">Skor ronde ${R.score} dari ${R.target}.</div><div style="margin-top:6px">${G.reached >= best ? '🏅 Rekor baru!' : 'Rekor: Stage ' + best}</div>${sendLine}</div>
      ${achNew.length || (G.newAch || []).length ? `<div class="bq-card"><b>🏆 Achievement baru</b>${[...new Set((G.newAch || []).concat(achNew))].map(id => `<div class="bq-mut">${achText(id)}</div>`).join('')}</div>` : ''}
      <div class="bq-card"><b>Kata-katamu</b><div class="bq-mut">Ketuk kata untuk melihat artinya, lalu simpan ke Lemari.</div>
        <div class="bq-wl">${uniq.map(x => `<div class="row" data-a="meaning" data-i="${x.w}"><b>${x.w}${POSN[x.p] ? `<s>${POSN[x.p]}</s>` : ''}</b><i>${x.s} poin</i><span data-add="${x.w}"></span></div><div class="mean" data-mean="${x.w}" hidden></div>`).join('') || '<div class="bq-mut">Belum ada kata.</div>'}</div></div>
      <div class="bq-card"><div class="bq-info" style="font-size:13px"><span>🏔️ Stage ${G.reached}</span><span>📝 ${s.words} kata</span><span>🔤 terpanjang: ${s.longest ? s.longest.toUpperCase() : '-'}</span><span>⭐ terbaik: ${s.best.w ? s.best.w.toUpperCase() + ' (' + s.best.s + ')' : '-'}</span><span>Σ ${s.total} poin</span></div>
        <div class="bq-mut" style="margin-top:10px">Fabric yang dikumpulkan</div><div class="bq-chips">${G.fabrics.map(id => `<span class="bq-chip">${F(id).icon} ${F(id).name}</span>`).join('') || '-'}</div>
</div>
      <button type="button" class="bq-btn pri" data-a="start">Main lagi</button>`;
  }
  function modalHtml() {
    if (modal.t === 'mean') {
      const w = modal.w, m = means[w] || { state: 'loading' }, P = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' }[E.posOf(w)];
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2 style="font-size:24px">${w.toUpperCase()}${P ? ` <span class="bq-chip h" style="font-size:12px;vertical-align:middle">${P}</span>` : ''}</h2>
        <div class="bq-mean">${meanHtml(m)}</div>
        <div class="bq-btns" style="margin-top:12px;align-items:center"><span data-add="${w}"></span><button type="button" class="bq-btn" data-a="closeModal">Tutup</button></div></div></div>`;
    }
    if (modal.t === 'item') {
      const perm = modal.key[0] === 'p', o = perm ? E.permItems(G)[+modal.key.slice(1)] : shop[+modal.key.slice(1)];
      if (!o) return '';
      const can = !o.sold && !o.maxed && G.coins >= o.price;
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><div class="bq-opt" style="cursor:default">${optHtml(o)}</div>
        <div class="bq-mut" style="margin:8px 0">Koinmu: 🪙 ${G.coins}${o.maxed ? ' · sudah maksimal' : !can ? ' · koin belum cukup' : ''}</div>
        <div class="bq-btns"><button type="button" class="bq-btn" data-a="closeModal">Batal</button><button type="button" class="bq-btn pri" data-a="confirmBuy" ${can ? '' : 'disabled'}>${o.maxed ? 'Maksimal' : 'Beli 🪙 ' + o.price}</button></div></div></div>`;
    }
    if (modal.t === 'giveup') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Akhiri run?</h2><div class="bq-mut" style="margin:6px 0 12px">Run berhenti di ${label()}. Kata-katamu tetap bisa dilihat artinya dan disimpan ke Lemari.</div>
      <div class="bq-btns"><button type="button" class="bq-btn" data-a="closeModal">Lanjut main</button><button type="button" class="bq-btn pri" data-a="giveUpYes">Ya, akhiri</button></div></div></div>`;
    if (modal.t === 'wild') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Kartu ? jadi huruf apa?</h2><div class="bq-mut">Nilainya setengah dari huruf aslinya.${R.boss && R.boss.block ? ' Huruf ' + R.boss.block.toUpperCase() + ' sedang dikunci.' : ''}</div>
      <div class="bq-abc">${'abcdefghijklmnopqrstuvwxyz'.split('').map(c => `<button type="button" class="bq-tile" data-a="wildAs" data-i="${c}" ${R.boss && R.boss.block === c ? 'disabled' : ''}>${c}<small>${Math.ceil(E.V[c] * E.CFG.letterMul / 2)}</small></button>`).join('')}</div>
      <button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Batal</button></div></div>`;
    if (modal.t === 'fab') { const i = G.fabrics.indexOf(modal.id), mv = (phase === 'round' || phase === 'shop') && i !== -1 && G.fabrics.length > 1;
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><div class="bq-opt" style="cursor:default">${fabricCard(modal.id)}</div>
        ${mv ? `<div class="bq-mut" style="margin-top:8px">Fabric dihitung dari kiri ke kanan. Taruh +Chips/+Mult di kiri dan ×Mult di kanan supaya skornya terbesar.</div>
        <div class="bq-btns" style="margin-top:8px"><button type="button" class="bq-btn" data-a="moveFab" data-i="-1" ${i === 0 ? 'disabled' : ''}>◀ Geser kiri</button><button type="button" class="bq-btn" data-a="moveFab" data-i="1" ${i === G.fabrics.length - 1 ? 'disabled' : ''}>Geser kanan ▶</button></div>` : ''}
        <button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Tutup</button></div></div>`; }
    return `<div class="bq-modal"><div class="bq-card"><h2>Slot penuh</h2><div class="bq-mut" style="margin:4px 0 8px">Ganti salah satu Fabric dengan:</div><div class="bq-opt" style="margin-bottom:8px;cursor:default">${fabricCard(modal.id)}</div><div class="bq-mut">Ketuk Fabric yang diganti, atau lewati.</div><div class="bq-opts" style="margin-top:6px">${G.fabrics.map((id, i) => `<button type="button" class="bq-opt" data-a="doReplace" data-i="${i}"><span class="ic">${F(id).icon}</span><b>${F(id).name}</b></button>`).join('')}</div><button type="button" class="bq-btn" style="width:100%;margin-top:8px" data-a="skipReplace">Lewati Fabric baru</button></div></div>`;
  }
  function render() {
    let h = '';
    if (phase === 'intro') h = introHtml();
    else if (phase === 'deck') h = `<h2>Pilih Kain</h2><div class="bq-mut">Kain menentukan isi supply-mu. Kain baru terbuka lewat achievement.</div><div class="bq-opts">${deckOpts.map(id => { const d = E.DECK[id]; return `<button type="button" class="bq-opt" data-a="pickDeck" data-i="${id}"><span class="ic">${d.icon}</span><b>${d.name}</b><span class="d">${d.desc}</span></button>`; }).join('')}</div>`;
    else if (phase === 'ach') h = achHtml();
    else if (phase === 'starter') h = `<h2>Pilih Fabric awal</h2><div class="bq-mut">Kamu mulai dengan 1 Fabric dari 3 pilihan.</div><div class="bq-opts">${starters.map((id, i) => `<button type="button" class="bq-opt" data-a="pickStarter" data-i="${i}">${fabricCard(id)}</button>`).join('')}</div>`;
    else if (phase === 'bosspre') h = `<div class="bq-card bq-center"><img src="img/game/boss-${R.boss.id}.webp" alt="" style="height:150px;width:auto"><h2>${R.boss.name}</h2><p>${R.boss.desc}${R.boss.block ? `<br><b style="color:var(--error);font-size:22px">Huruf terkunci: ${R.boss.block.toUpperCase()}</b>` : ''}</p><div class="bq-mut">Capai skor <b>${fmtN(R.target)}</b> untuk mengalahkannya.</div></div><button type="button" class="bq-btn pri" data-a="faceBoss">Hadapi boss</button>`;
    else if (phase === 'round') h = roundHtml();
    else if (phase === 'reward') h = `<h2>Ronde selesai! 🎉</h2><div class="bq-mut">Pilih 1 hadiah.</div><div class="bq-opts">${rewards.map((o, i) => `<button type="button" class="bq-opt" data-a="takeReward" data-i="${i}">${optHtml(o)}</button>`).join('')}</div>`;
    else if (phase === 'shop') {
      const perm = E.permItems(G), secOf = o => o.sec || (o.type === 'fabric' ? 'fabric' : 'card');
      const box = (o, key, priceTxt, off) => `<button type="button" class="bq-gi ${o.sold ? 'sold' : off ? 'poor' : ''}" data-a="item" data-i="${key}" ${o.sold ? 'disabled' : ''}>${optHtml(o)}<span class="pr">${o.sold ? 'Terjual' : priceTxt}</span></button>`;
      const sec = name => shop.map((o, i) => secOf(o) === name ? box(o, 's' + i, '🪙 ' + o.price, G.coins < o.price) : '').join('');
      const rr = name => `<button type="button" class="bq-btn sm" ${G.coins < E.CFG.price.reroll ? 'disabled' : ''} data-a="reroll" data-i="${name}">🔁 Reroll (🪙 ${E.CFG.price.reroll})</button>`;
      h = `<div class="bq-top"><h2 style="flex:1">🛍️ Shop</h2><span class="bq-coin">🪙 ${G.coins}</span></div><div class="bq-mut">Ketuk barang untuk melihat detail dan membeli. Boleh keluar tanpa beli.</div>
        <div class="bq-sec"><b>🧩 Kartu</b>${rr('card')}</div><div class="bq-grid">${sec('card')}</div>
        <div class="bq-sec"><b>🧵 Fabric</b>${rr('fabric')}</div><div class="bq-grid">${sec('fabric') || '<div class="bq-mut">Semua Fabric sudah kamu punya.</div>'}</div>
        <div class="bq-sec"><b>🎒 Perlengkapan</b><span class="bq-mut">harga naik tiap beli</span></div><div class="bq-grid">${perm.map((o, i) => box(o, 'p' + i, o.maxed ? 'MAKS' : '🪙 ' + o.price, o.maxed || G.coins < o.price)).join('')}</div>
        <div><div class="bq-mut">Fabric kamu</div>${slotsHtml()}</div>
        <div><div class="bq-mut">Hand kamu</div><div class="bq-hands">${'nvar'.split('').map(p => { const h = E.handInfo(p, E.lvOf(G, p)); return `<span>${h.icon} <b>${h.name}</b> Lv${h.lv} · ${h.chips} × ${h.mult}</span>`; }).join('')}</div></div>
        <button type="button" class="bq-btn pri" data-a="leaveShop">Lanjut ke ${label()}</button>`;
    } else if (phase === 'end') h = endHtml();
    body.innerHTML = '<div class="bq' + (phase === 'round' ? ' bq-r' : '') + '">' + h + (modal ? modalHtml() : '') + '</div>';
    if (shake) { const p = body.querySelector('.bq-prev'); if (p) p.classList.add('bq-shake'); }
    shake = false;
    body.querySelectorAll('[data-add]').forEach(el => { try { const w = el.getAttribute('data-add'), m = means[w]; const b = host.addButton(w, m && m.r ? m.r.translation : ''); if (b) { b.addEventListener('click', ev => ev.stopPropagation()); el.replaceWith(b); } } catch (e) { /* host without Lemari: no add button */ } });
    Object.keys(means).forEach(showMeaning);
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
    host.submit({ run_id: g.runId, stage: g.reached, round: g.rnd + 1, words: s.words, longest: s.longest, best_word: s.best.w, best_score: s.best.s, total_score: s.total, fabrics: g.fabrics.slice(), deck: g.deck || 'base', achievements: (g.newAch || []).slice(), counts: E.runCounts(g) })
      .then(function (r) {
        markSent(g); sendState = 'ok';
        if (r && r.achievements) {
          const fresh = r.achievements.filter(id => !achOwned.includes(id) && E.ACH.some(a => a.id === id));
          setAch(r.achievements, r.totals);
          if (fresh.length) { achNew = achNew.concat(fresh); toast('🏆 ' + achText(fresh[0]) + (fresh.length > 1 ? ' (+' + (fresh.length - 1) + ' lagi)' : '')); Sfx.play('unlock'); }
        } if (r && r.stats && host.onStats) host.onStats(r.stats); if (phase === 'end') render(); },
        function (e) { sendState = 'fail'; sendErr = e && e.message ? e.message : 'Coba lagi nanti.'; if (host.failed) host.failed(e); if (phase === 'end') render(); });
    if (phase === 'end') render();
  }
  function endRun() {
    checkAch(); Sfx.play('over');
    phase = 'end'; G.reached = G.stage + 1;
    if (G.reached > best) { best = G.reached; store.set(BEST, String(best)); }
    achNew = []; sendState = ''; sendResult();
  }
  function gain(o, after) {
    if (o.type === 'coin') { G.coins += o.n; after(); }
    else if (o.type === 'up') { E.addUpgrade(G, o.kind, o.ch); after(); }
    else if (o.type === 'supply') { G.extra += o.n; after(); }
    else if (o.type === 'letter' || o.type === 'multi' || o.type === 'wild') { G.letterAdds.push(o.ch); after(); }
    else if (o.type === 'book') { G.handLv = G.handLv || { o: 1, n: 1, v: 1, a: 1, r: 1 }; G.handLv[o.pos] = E.lvOf(G, o.pos) + 1; after(); }
    else if (o.type === 'fabric') { if (G.fabrics.length < E.CFG.slots) { G.fabrics.push(o.id); after(); } else { modal = { t: 'replace', id: o.id, after: after }; render(); } }
  }
  /* Balatro-style scoring: each card adds its chips, then the length bonus, the hand and every Fabric fire one by one,
     then Chips × Mult becomes the attack. The numbers come from the engine's result, so the total always equals res.final.
     Tap to skip; speed 1× / 2× / instant (⚡); instant when the phone asks for reduced motion. */
  const SPEEDKEY = 'wr_game_speed';
  function speed() {
    const v = store.get(SPEEDKEY);
    if (v === null && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return 0;
    return v === null ? 1 : (+v || 0) % 3;
  }
  function scoreSteps(res) {
    return res.steps.map(x => Object.assign({ big: !!(x.hand || x.slot || x.boss || x.held) }, x, { label: x.label || (x.c ? '+' + x.c : '') }));
  }

  function pop(el, text, mult) {
    if (!el) return;
    const f = document.createElement('span'); f.className = 'bq-fly' + (mult ? ' m' : '') + (el.id === 'bq-c' || el.id === 'bq-m' ? ' l' : ''); f.textContent = text;
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
    el.appendChild(f); setTimeout(() => f.remove(), 650);
  }
  function sparks(el) {
    if (!el) return;
    const cols = ['#ffd23f', '#ff8fb1', '#7ee0b5', '#4fa3ff', '#c08bff'];
    el.parentNode.style.position = 'relative';
    for (let i = 0; i < 7; i++) {
      const p = document.createElement('span'); p.className = 'bq-spark';
      p.style.background = cols[i % cols.length]; p.style.left = (el.offsetLeft + el.offsetWidth / 2) + 'px'; p.style.top = (el.offsetTop + el.offsetHeight / 2) + 'px';
      p.style.setProperty('--dx', Math.round(Math.cos(i) * 34) + 'px'); p.style.setProperty('--dy', Math.round(Math.sin(i * 1.7) * 26) + 'px');
      el.parentNode.appendChild(p); setTimeout(() => p.remove(), 600);
    }
  }
  function playScore(tiles, res, before, done) {
    const sp = speed();
    anim = { tiles, res, before, chips: 0, mult: 0, timers: [], done };
    if (!sp) { finishScore(); return; }
    render();
    const unit = sp === 2 ? 0.5 : 1, steps = scoreSteps(res);
    let at = 120 * unit, k = 0;
    steps.forEach((s0, idx) => {
      anim.timers.push(setTimeout(() => {
        if (!anim) return;
        if (s0.c) anim.chips += s0.c;
        if (s0.m) anim.mult += s0.m;
        if (s0.x) anim.mult *= s0.x;
        const ce = body.querySelector('#bq-c'), me = body.querySelector('#bq-m');
        if (ce) ce.textContent = fmtN(anim.chips);
        if (me) me.textContent = fmtM(anim.mult);
        const box = (s0.m || s0.x) ? me : ce;
        if (box) { box.classList.add('pulse'); setTimeout(() => box.classList.remove('pulse'), 120); }
        if (s0.tile !== undefined) {
          const te = body.querySelectorAll('.bq-sel .bq-tile')[s0.tile];
          if (te) { te.classList.add('hit'); pop(te, s0.label, !!(s0.m || s0.x)); }
          Sfx.play('tick', k++);
        } else {
          const se = s0.slot ? body.querySelector('.bq-slot[data-i="' + s0.slot + '"]') : s0.held ? body.querySelector('.bq-hand [data-i="' + s0.held + '"]') : null;
          if (se) { se.classList.remove('hit'); void se.offsetWidth; se.classList.add('hit'); }
          pop(se || box, s0.label, !!(s0.m || s0.x)); if (s0.m || s0.x) sparks(me);
          Sfx.play('ding', k++);
        }
      }, at));
      at += (s0.big ? 380 : s0.tile !== undefined ? 170 : 260) * unit;
    });
    anim.timers.push(setTimeout(() => {
      if (!anim) return;
      const te = body.querySelector('#bq-t');
      if (te) { te.textContent = '= ' + fmtN(res.final); te.classList.add('rain'); }
    }, at));
    anim.timers.push(setTimeout(finishScore, at + 520 * unit));
  }
  function finishScore() {
    if (!anim) return;
    const a = anim; a.timers.forEach(clearTimeout); anim = null; a.done();
  }

  function beginRound() { R = E.makeRound(G, rng); sel = []; msg = ''; last = null; phase = R.boss ? 'bosspre' : 'round'; render(); }
  function advance() { if (isBoss()) { G.stage++; G.rnd = 0; checkAch(); shop = E.shopItems(G, rng); phase = 'shop'; render(); } else { G.rnd++; beginRound(); } }
  const A = {
    start() {
      deckOpts = E.opened(achOwned).decks;
      if (deckOpts.length > 1) { G = null; phase = 'deck'; modal = null; render(); return; }
      A.pickDeck('base');
    },
    pickDeck(id) {
      means = {}; G = E.newGame(null, id, E.opened(achOwned).fabrics); G.runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); G.submitted = false; G.newAch = [];
      const ids = E.FABRICS.filter(f => E.avail(G, f)).map(f => f.id).filter(x => ['refill', 'saver', 'recycler'].indexOf(x) === -1);
      starters = E.shuffle(ids.slice(), rng).slice(0, 3); phase = 'starter'; last = null; sel = []; modal = null; sendState = ''; render();
    },
    achList() { phase = 'ach'; render(); },
    achBack() { phase = 'intro'; render(); },
    giveUp() { modal = { t: 'giveup' }; render(); },
    giveUpYes() { modal = null; endRun(); },
    sfx() { Sfx.toggle(); render(); },
    resume() { const s = load(); if (!s) { A.start(); return; } restore(s); if (phase === 'round' && R && !R.cleared && E.failed(G, R)) { endRun(); return; } render(); },
    pickStarter(i) { G.fabrics = [starters[+i]]; beginRound(); },
    faceBoss() { phase = 'round'; render(); },
    pick(id) {
      const t = R.hand.find(x => x.id === +id); if (!t || sel.length >= R.handSize || sel.some(s => s.id === t.id)) return;
      if (t.ch === '?') { modal = { t: 'wild', id: t.id }; render(); return; }
      sel.push(t); msg = ''; Sfx.play('tick'); render();
    },
    wildAs(c) { const t = R.hand.find(x => x.id === modal.id); modal = null; if (t && !(R.boss && R.boss.block === c)) { t.as = c; sel.push(t); msg = ''; } render(); },
    unsel(i) { const t = sel.splice(+i, 1)[0]; if (t) delete t.as; render(); },
    clr() { sel.forEach(t => delete t.as); sel = []; msg = ''; render(); },
    music() { Music.toggle(); render(); },
    meaning(w) {
      const m = means[w];
      if (m && m.state === 'ok') { m.open = !m.open; showMeaning(w); return; }
      fetchMeaning(w, () => { if (means[w]) means[w].open = true; showMeaning(w); if (means[w] && means[w].state === 'ok') refreshAdd(w); });
    },
    arti(w) {
      if (!w || !E.isWord(w)) return;
      modal = { t: 'mean', w: w }; render();
      fetchMeaning(w, () => { if (modal && modal.t === 'mean' && modal.w === w) render(); });
    },
    artiSel() { A.arti(sel.map(E.txt).join('')); },
    send() {
      if (anim) return;
      const w = sel.map(E.txt).join(''), played = sel.map(t => Object.assign({}, t)), before = R.score;
      const r = E.submit(G, R, sel, rng, { inLemari: inLemari(w) });
      if (!r.ok) { msg = r.msg; shake = true; Sfx.play('bad'); render(); return; }
      last = { res: r.res }; sel = []; msg = '';
      const lost = !r.won && E.failed(G, R);
      if (r.won) { last.fin = E.finishRound(G, R); rewards = E.rewardOptions(G, rng); R.cleared = true; }
      playScore(played, r.res, before, () => {
        const f = r.res.final;
        Sfx.play('attack');
        fx = { dmg: f, say: r.res.jackpot ? 'JACKPOT!' : f >= R.target * 0.35 ? 'Mantap!' : r.res.word.length >= 6 ? 'Panjang!' : '' };
        if (r.won) setTimeout(() => Sfx.play('win'), 380);
        if (lost) { endRun(); return; }
        checkAch(); render();
      });
    },
    moveFab(d) { const i = G.fabrics.indexOf(modal && modal.id), j = i + (+d); if (i < 0 || j < 0 || j >= G.fabrics.length) return; const f = G.fabrics; [f[i], f[j]] = [f[j], f[i]]; render(); },
    speed() { store.set(SPEEDKEY, String((speed() + 1) % 3)); render(); },
    discard() { sel.forEach(t => delete t.as); if (!E.discard(G, R, sel.slice())) return; Sfx.play('discard'); const n = sel.length; sel = []; msg = 'Buang ' + n + ' huruf, ambil dari supply.'; if (E.failed(G, R)) { endRun(); return; } render(); },
    goNext() { phase = 'reward'; Sfx.play('coin'); render(); },
    takeReward(i) { if (rewards[+i] && rewards[+i].type === 'coin') Sfx.play('coin'); gain(rewards[+i], advance); },
    showFab(id) { modal = { t: 'fab', id: id }; render(); },
    closeModal() { modal = null; render(); },
    doReplace(i) { const m = modal; G.fabrics[+i] = m.id; modal = null; m.after(); },
    skipReplace() { const m = modal; modal = null; m.after(); },
    buy(i) {
      const o = shop[+i]; if (!o || o.sold || G.coins < o.price) return;
      if (o.type === 'fabric' && G.fabrics.length >= E.CFG.slots) { modal = { t: 'replace', id: o.id, after: () => { if (G.fabrics.includes(o.id)) { G.coins -= o.price; o.sold = true; Sfx.play('coin'); } render(); } }; render(); return; }
      G.coins -= o.price; o.sold = true; Sfx.play('coin'); gain(o, render);
    },
    buyPerm(i) {
      const o = E.permItems(G)[+i]; if (!o || o.maxed || G.coins < o.price) return; G.coins -= o.price; Sfx.play('coin');
      if (o.type === 'supply') G.extra += o.n; else if (o.type === 'discard') G.discardBonus++; else if (o.type === 'hand') G.handBonus++;
      render();
    },
    reroll(sec) { if (G.coins < E.CFG.price.reroll) return; G.coins -= E.CFG.price.reroll; Sfx.play('coin'); shop = E.rerollShop(G, shop, sec === 'fabric' ? 'fabric' : 'card', rng); render(); },
    item(key) { modal = { t: 'item', key: key }; render(); },
    confirmBuy() { const k = modal && modal.key; modal = null; if (!k) return; if (k[0] === 'p') A.buyPerm(k.slice(1)); else A.buy(k.slice(1)); },
    leaveShop() { beginRound(); },
    retry() { sendResult(); },
    noop() { }
  };
  function onClick(ev) {
    if (!root.hidden && !document.hidden) Music.start();
    if (anim) { finishScore(); return; }
    const t = ev.target.closest ? ev.target.closest('[data-a]') : null;
    if (!t || !body.contains(t)) return;
    const fn = A[t.getAttribute('data-a')]; if (fn) fn(t.getAttribute('data-i'));
  }
  function onKey(ev) {
    if (anim) return;
    if (!root || root.hidden || phase !== 'round' || modal || !R || R.cleared) return;
    if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
    if (ev.key === 'Enter') { if (sel.length >= 3) { ev.preventDefault(); A.send(); } }
    else if (ev.key === 'Backspace') { ev.preventDefault(); sel.pop(); render(); }
    else if (/^[a-z]$/i.test(ev.key)) { const c = ev.key.toLowerCase(); const t = R.hand.find(t => t.ch === c && !E.blocked(R, t) && !sel.some(s => s.id === t.id)); if (t) A.pick(t.id);
      else { const wd = R.hand.find(t => t.ch === '?' && !sel.some(s => s.id === t.id)); if (wd && !(R.boss && R.boss.block === c)) { wd.as = c; sel.push(wd); msg = ''; render(); } } }
  }

  /* ---------- entry points ---------- */
  function init(h) {
    host = h; root = h.root; body = h.body;
    if (!mounted) {
      mounted = true;
      const st = document.createElement('style'); st.id = 'bq-css'; st.textContent = CSS; document.head.appendChild(st);
      body.addEventListener('click', onClick); document.addEventListener('keydown', onKey);
      document.addEventListener('visibilitychange', () => { if (document.hidden) Music.stop(); });
      if (window.MutationObserver) new MutationObserver(() => { if (root.hidden) Music.stop(); }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
    }
    best = +store.get(BEST) || 0;
  }
  function open() {
    if (!ready) {
      ready = fetch('words-game.txt').then(r => { if (!r.ok) throw new Error('dict'); return r.text(); }).then(t => { E.setDict(t.split('\n').map(w => w.trim()).filter(Boolean)); });
      ready.catch(() => { ready = null; });
    }
    body.innerHTML = '<div class="bq bq-center bq-mut" style="padding:40px 0">Memuat kamus…</div>';
    try { const c = JSON.parse(store.get(ACHKEY) || '{}') || {}; achOwned = Array.isArray(c) ? [] : (c.list || []); achTotals = c.totals || {}; } catch (e) { achOwned = []; achTotals = {}; }
    // the account's achievements arrive in the background (the copy on this phone is used meanwhile, or when offline)
    if (host.profile) host.profile().then(r => { if (r && r.achievements) { setAch(r.achievements, r.totals); if (phase === 'intro' || phase === 'ach') render(); } }, e => { if (host.failed) host.failed(e); });
    return ready.then(() => {
      const s = load();
      if (s && s.phase === 'end' && s.G && !s.G.submitted) { restore(s); sendState = ''; sendResult(); }   // a finished run whose result never reached the server: try again quietly
      G = null; R = null; phase = 'intro'; sel = []; modal = null; render();
    }, () => { body.innerHTML = '<div class="bq bq-center"><div class="bq-card">Kamus game belum bisa dimuat. Cek koneksi, lalu buka Game lagi.</div></div>'; });
  }
  return { init: init, open: open, music: Music, sfx: Sfx };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = Engine;
else if (typeof window !== 'undefined') window.WRGame = { init: UI.init, open: UI.open, music: UI.music, sfx: UI.sfx, Engine: Engine };
