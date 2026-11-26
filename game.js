/* Wordrobe Quest (was Bibo's Fabric Quest; renamed by the owner 25 Nov). Loaded only when the Game tab is first opened (index.html adds this script on demand).
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
    stages: 8,   // a standard run (owner 25 Nov): 8 stages x (Ronde Kecil, Ronde Besar, Boss) = 24 rounds; beating the stage-8 boss wins, endless may follow
    base: 450, growth: 1.75, ramp: 0.08, roundMul: [1, 1.3, 1.4], // endless: target = base * growth^stage * (1 + ramp*stage) * roundMul
    coinRound: 3, price: { fabric: 6, gold: 4, ruby: 5, glass: 7, steel: 6, dbl: 7, supply: 3, letter: 4, reroll: 2, book: 5, multi: 5, wild: 8 }, supplyPack: 3, handMaxBuys: 4
  };
  /* Fabrics fire LEFT TO RIGHT in slot order (Balatro jokers): 'chips' = +Chips (blue), 'add' = +Mult (red), 'x' = xMult. */
  // r = rarity (1 Umum, 2 Langka, 3 Epik, 4 Legendaris; owner 26 Nov, after Balatro's Common/Uncommon/Rare/Legendary); t = terms shown on the card
  const FABRICS = [
    { id: 'long', r: 1, name: 'Long Stitch', icon: '🧵', desc: '+6 Mult untuk kata 6+ huruf.', kind: 'add' },
    { id: 'double', r: 1, name: 'Double Stitch', icon: '🪡', desc: '+45 Chips untuk kata dengan huruf kembar.', kind: 'chips' },
    { id: 'short', r: 1, name: 'Short & Sweet', icon: '🍬', desc: '+4 Mult untuk kata 3 huruf.', kind: 'add' },
    { id: 'velvet', r: 1, name: 'Vowel Velvet', icon: '🟣', desc: '+1 Mult untuk tiap huruf vokal.', kind: 'add' },
    { id: 'rare', r: 1, name: 'Rare Thread', icon: '💎', desc: '+60 Chips untuk kata berisi J, Q, X, atau Z.', kind: 'chips', t: ['Berisi'] },
    { id: 'club', r: 1, name: 'Consonant Club', icon: '🎩', desc: '+6 Chips untuk tiap konsonan.', kind: 'chips' },
    { id: 'thread7', r: 1, name: 'Thread Count', icon: '7️⃣', desc: '+7 Mult untuk kata 7 huruf.', kind: 'add' },
    { id: 'measure', r: 1, name: 'Measuring Tape', icon: '📏', desc: '+30 Chips untuk kata 5+ huruf.', kind: 'chips', locked: true },
    { id: 'refill', r: 1, name: 'Refill Master', icon: '🔄', desc: 'Sekali per ronde: kata 5+ huruf menarik 1 huruf ekstra (tangan sementara +1).', kind: 'util' },
    { id: 'saver', r: 1, name: 'Saver', icon: '🐷', desc: '+1 koin tiap 3 huruf sisa saat ronde selesai.', kind: 'eco' },
    { id: 'steady', r: 1, name: 'Steady Hand', icon: '🤲', desc: '+2 koin tiap ronde yang dimenangkan tanpa Buang.', kind: 'eco', locked: true },
    { id: 'sisa', r: 1, name: 'Sisa Benang', icon: '🧶', desc: '+30 Chips untuk tiap sisa jatah Buang.', kind: 'chips' },
    { id: 'kusut', r: 1, name: 'Benang Kusut', icon: '🌀', desc: '+0 sampai +23 Mult, acak tiap kata.', kind: 'add' },
    { id: 'mungil', r: 1, name: 'Kata Mungil', icon: '🐭', desc: '+15 Mult untuk kata 4 huruf atau kurang.', kind: 'add' },
    { id: 'gulung', r: 1, name: 'Gulungan Penuh', icon: '🧻', desc: '+2 Chips untuk tiap huruf yang tersisa di supply.', kind: 'chips', t: ['Di supply'] },
    { id: 'kainbaru', r: 1, name: 'Kain Baru', icon: '🆕', desc: '+100 Chips, berkurang 5 tiap kata. Hancur saat habis.', kind: 'chips', t: ['Hancurkan'] },
    { id: 'celengan', r: 1, name: 'Celengan Bibo', icon: '🪙', desc: '+3 koin di akhir tiap ronde.', kind: 'eco' },
    { id: 'vokal', r: 1, name: 'Vokal Merdu', icon: '🎵', desc: 'Tiap vokal yang dimainkan: +3 Mult.', kind: 'add', t: ['Saat dimainkan'] },
    { id: 'kokoh', r: 1, name: 'Konsonan Kokoh', icon: '🧱', desc: 'Tiap konsonan yang dimainkan: +12 Chips.', kind: 'chips', t: ['Saat dimainkan'] },
    { id: 'mahal', r: 1, name: 'Huruf Mahal', icon: '💰', desc: 'Tiap kartu berisi J, Q, X, atau Z yang dimainkan: +30 Chips.', kind: 'chips', t: ['Saat dimainkan'] },
    { id: 'pitan', r: 1, name: 'Pita Noun', icon: '📦', desc: '+10 Mult bila kata adalah Noun.', kind: 'add', t: ['Adalah'] },
    { id: 'pitav', r: 1, name: 'Pita Verb', icon: '🏃', desc: '+10 Mult bila kata adalah Verb.', kind: 'add', t: ['Adalah'] },
    { id: 'pitaa', r: 1, name: 'Pita Adjective', icon: '🎨', desc: '+10 Mult bila kata adalah Adjective.', kind: 'add', t: ['Adalah'] },
    { id: 'pitar', r: 1, name: 'Pita Adverb', icon: '⚡', desc: '+10 Mult bila kata adalah Adverb.', kind: 'add', t: ['Adalah'] },
    { id: 'chain', r: 2, name: 'Word Chain', icon: '⛓️', desc: 'Kata 5+ huruf: +2 Mult untuk tiap kata 5+ huruf berturut-turut (termasuk kata ini). Putus kalau kata < 5 huruf.', kind: 'add' },
    { id: 'golden', r: 2, name: 'Golden Weave', icon: '🌟', desc: '×1,5 Mult untuk kata berisi huruf E.', kind: 'x', t: ['Berisi'] },
    { id: 'first', r: 2, name: 'First Impression', icon: '👋', desc: '×2 Mult untuk kata valid pertama tiap ronde.', kind: 'x' },
    { id: 'jackpot', r: 2, name: 'Jackpot', icon: '🎰', desc: '20% peluang ×2 Mult.', kind: 'x' },
    { id: 'patch', r: 2, name: 'Patchwork', icon: '🧩', desc: '×2 Mult untuk kata dengan 3+ vokal berbeda.', kind: 'x' },
    { id: 'recycler', r: 2, name: 'Recycler', icon: '♻️', desc: '20% peluang 1 huruf terpakai kembali ke supply.', kind: 'util' },
    { id: 'twin', r: 2, name: 'Jarum Kembar', icon: '🪢', desc: 'Kartu di tangan terpicu 2×: tiap kartu Besi memberi ×1,25 dua kali.', kind: 'rt', t: ['Ulang'] },
    { id: 'kosong', r: 2, name: 'Lemari Kosong', icon: '🫙', desc: '+15 Mult saat jatah Buang tinggal 0.', kind: 'add' },
    { id: 'rapi', r: 2, name: 'Jahitan Rapi', icon: '📎', desc: '+1 Mult tiap kata berturut-turut tanpa Buang. Buang mengembalikannya ke 0.', kind: 'add', t: ['Bertumbuh'] },
    { id: 'pitaukur', r: 2, name: 'Pita Ukur Panjang', icon: '📐', desc: '+10 Chips permanen tiap kata 6+ huruf.', kind: 'chips', t: ['Bertumbuh'] },
    { id: 'tumbuh', r: 2, name: 'Benang Tumbuh', icon: '🌱', desc: '+2 Chips permanen untuk tiap kartu yang dimainkan.', kind: 'chips', t: ['Bertumbuh'] },
    { id: 'bintang', r: 2, name: 'Huruf Bintang', icon: '⭐', desc: 'Kartu pertama berisi J, Q, X, Z, atau K: ×2 Mult.', kind: 'x', t: ['Saat dimainkan'] },
    { id: 'kancing', r: 2, name: 'Kancing Emas', icon: '🟡', desc: 'Tiap kartu Gold yang dimainkan: +1 koin.', kind: 'eco', t: ['Saat dimainkan'] },
    { id: 'imbuhan', r: 2, name: 'Imbuhan Emas', icon: '🔖', desc: 'Kartu imbuhan di posisi benar memberi +8 Mult (biasanya +3).', kind: 'add' },
    { id: 'bersarang', r: 2, name: 'Kata Bersarang', icon: '🪆', desc: '+8 Mult bila kata berisi kata lain 3+ huruf (CARTOON berisi CAR).', kind: 'add', t: ['Berisi'] },
    { id: 'kantong', r: 2, name: 'Kantong Emas', icon: '👛', desc: '×0,2 Mult untuk tiap kartu Gold di semua kartu run.', kind: 'x', t: ['Di semua kartu'] },
    { id: 'penenun', r: 2, name: 'Penenun', icon: '🧑‍🔧', desc: 'Awal tiap ronde: 1 kartu huruf acak masuk supply permanen.', kind: 'util', t: ['Tambah'] },
    { id: 'rakbuku', r: 2, name: 'Rak Buku', icon: '📚', desc: 'Tiap kata Adverb: 1 dari 3 peluang level Adverb naik.', kind: 'util', t: ['Buat'] },
    { id: 'pola', r: 3, name: 'Pola Salin', icon: '📐', desc: 'Menyalin efek Fabric tepat di KANANNYA (geser urutan di popup Fabric).', kind: 'copy', t: ['Salin'] },
    { id: 'cermin', r: 3, name: 'Cermin', icon: '🪞', desc: 'Menyalin efek Fabric PALING KIRI.', kind: 'copy', t: ['Salin'] },
    { id: 'lemariku', r: 3, name: 'Lemariku', icon: '🚪', desc: '×2 Mult untuk kata yang sudah ada di Lemarimu.', kind: 'x', locked: true },
    { id: 'polaulang', r: 3, name: 'Pola Ulang', icon: '🔂', desc: '×3 Mult bila jenis kata yang sama sudah dimainkan di ronde ini.', kind: 'x' },
    { id: 'brankas', r: 3, name: 'Brankas Emas', icon: '🏦', desc: 'Tiap kartu Gold yang tetap di tangan: ×1,5 Mult.', kind: 'x' },
    { id: 'penutup', r: 3, name: 'Jahitan Penutup', icon: '🪡', desc: 'Saat supply tinggal 5 atau kurang, semua kartu yang dimainkan terpicu 2×.', kind: 'rt', t: ['Ulang'] },
    { id: 'abadi', r: 3, name: 'Kain Abadi', icon: '♾️', desc: '+×0,1 Mult permanen tiap boss dikalahkan.', kind: 'x', t: ['Bertumbuh'] },
    { id: 'cetakan', r: 3, name: 'Cetakan', icon: '🖨️', desc: 'Kata pertama ronde 3 huruf: 1 kartunya disalin permanen ke supply.', kind: 'util', t: ['Tambah'] },
    { id: 'gunting', r: 3, name: 'Gunting Tajam', icon: '✂️', desc: 'Awal ronde: hancurkan Fabric di kanannya, +2× harga jualnya ke Mult permanen.', kind: 'add', t: ['Hancurkan', 'Bertumbuh'] },
    { id: 'mahkotan', r: 3, name: 'Mahkota Noun', icon: '👑', desc: '×2 Mult bila kata adalah Noun.', kind: 'x', t: ['Adalah'], locked: true },
    { id: 'mahkotav', r: 3, name: 'Mahkota Verb', icon: '👑', desc: '×2 Mult bila kata adalah Verb.', kind: 'x', t: ['Adalah'], locked: true },
    { id: 'mahkotaa', r: 3, name: 'Mahkota Adjective', icon: '👑', desc: '×2 Mult bila kata adalah Adjective.', kind: 'x', t: ['Adalah'], locked: true },
    { id: 'mahkotar', r: 3, name: 'Mahkota Adverb', icon: '👑', desc: '×2 Mult bila kata adalah Adverb.', kind: 'x', t: ['Adalah'], locked: true },
    { id: 'mesin', r: 4, name: 'Mesin Jahit Bibo', icon: '🧵', desc: 'Semua kartu yang dimainkan terpicu 2×.', kind: 'rt', t: ['Ulang'], locked: true },
    { id: 'lemariajaib', r: 4, name: 'Lemari Ajaib', icon: '🪄', desc: '×3 Mult untuk kata yang ada di Lemarimu.', kind: 'x', locked: true },
    { id: 'guntingemas', r: 4, name: 'Gunting Emas', icon: '✂️', desc: 'Mematikan semua aturan boss.', kind: 'util', locked: true }
  ];
  // rarity: shop chance (weight), price; Legendaris never in the shop (achievement + boss reward)
  const RAR = [null, { n: 'Umum', w: 70, p: 5 }, { n: 'Langka', w: 25, p: 7 }, { n: 'Epik', w: 5, p: 9 }, { n: 'Legendaris', w: 0, p: 10 }];
  // editions (Balatro Foil/Holographic/Polychrome/Negative), higher odds than Balatro because runs are short
  const ED = { foil: { n: 'Sulam Emas', icon: '✨', d: '+50 Chips', p: 2, odds: 0.04 }, holo: { n: 'Bordir', icon: '🌸', d: '+10 Mult', p: 3, odds: 0.03 },
    poly: { n: 'Pelangi', icon: '🌈', d: '×1,5 Mult', p: 5, odds: 0.01 }, neg: { n: 'Tembus', icon: '👻', d: 'Tidak memakan slot (+1 slot)', p: 5, odds: 0.01 } };
  const TERMS = { 'Saat dimainkan': 'Bekerja untuk tiap kartu yang dimainkan, dan ikut terulang bila kartu terpicu lagi.', 'Berisi': 'Kata mengandung huruf atau kata tertentu.',
    'Adalah': 'Jenis kata utama (Noun, Verb, Adjective, Adverb).', 'Di supply': 'Hanya kartu yang belum ditarik.', 'Di semua kartu': 'Semua kartu run: supply, tangan, dan upgrade.',
    'Tambah': 'Kartu baru masuk supply permanen.', 'Hancurkan': 'Fabric atau kartu hilang tanpa uang jual.', 'Buat': 'Memberi sesuatu gratis, mis. naik level jenis kata.',
    'Bertumbuh': 'Efeknya bertambah permanen selama run.', 'Ulang': 'Kartu dihitung lagi, termasuk semua efek "Saat dimainkan".', 'Salin': 'Meniru efek Fabric lain (tanpa edisinya).' };
  // Label (owner 26 Nov: Balatro's Vouchers, one level each for casual players): 1 per shop, permanent for the run
  const LABELS = [
    { id: 'rak', name: 'Rak Tambahan', icon: '🗄️', desc: '+1 kartu di shop.' },
    { id: 'diskon', name: 'Diskon', icon: '🏷️', desc: 'Semua harga di shop −25%.' },
    { id: 'jarum', name: 'Jarum Halus', icon: '🪡', desc: 'Edisi Fabric 3× lebih sering muncul.' },
    { id: 'reroll', name: 'Reroll Hemat', icon: '🔁', desc: 'Reroll −1 koin.' },
    { id: 'guntingc', name: 'Gunting Cadangan', icon: '✂️', desc: '+1 Buang tiap ronde.' },
    { id: 'tas', name: 'Tas Lebar', icon: '👜', desc: '+1 kartu di tangan.' },
    { id: 'celengan', name: 'Celengan', icon: '🐖', desc: 'Akhir tiap ronde: +1 koin per 5 koin yang kamu punya (maks +5).' },
    { id: 'gantungan', name: 'Gantungan Ekstra', icon: '🧷', desc: '+1 slot Fabric.', price: 15 },
    { id: 'rakgantung', name: 'Rak Gantung', icon: '🪝', desc: 'Fabric Langka dan Epik lebih sering muncul.' },
    { id: 'bukularis', name: 'Buku Laris', icon: '📖', desc: 'Tiap Buku menaikkan level jenis kata 2 sekaligus.' },
    { id: 'gantilawan', name: 'Ganti Lawan', icon: '🔀', desc: 'Sekali per stage, boss boleh diganti dengan boss lain.' },
    { id: 'mundur', name: 'Mundur Sejahit', icon: '⏪', desc: 'Target skor turun setara 1 stage, tapi Buang −1 tiap ronde.' },
    { id: 'ajaib', name: 'Kartu Ajaib', icon: '🃏', desc: 'Kartu ber-upgrade dan kartu imbuhan lebih sering di shop.' }
  ];
  const LABEL = {}; LABELS.forEach(l => LABEL[l.id] = l);
  const hasLabel = (G, id) => !!(G && G.labels && G.labels.includes(id));
  // a locked Fabric shows up in starters, rewards and the shop only after its achievement (G.unlocked)
  const avail = (G, f) => !f.locked || (G.unlocked || []).includes(f.id);
  const FAB = {}; FABRICS.forEach(f => FAB[f.id] = f);
  const BOSSES = [
    { id: 'minimal', name: 'The Minimalist', desc: 'Kata di bawah 5 huruf hanya dapat 50% skor.' },
    { id: 'silent', name: 'The Silent One', desc: 'Satu huruf terkunci dan tidak bisa dipakai.', pick: 'dlnrst' },
    { id: 'repeater', name: 'The Repeater', desc: 'Kata tanpa huruf kembar hanya dapat 50% skor.' },
    { id: 'short', name: 'The Short Cutter', desc: 'Kata lebih dari 5 huruf tidak dapat bonus panjang.' },
    { id: 'vthief', name: 'The Vowel Thief', desc: 'Satu huruf vokal terkunci dan tidak bisa dipakai.', pick: 'aeiou' },
    { id: 'cutter', name: 'Si Pemotong Benang', desc: 'Satu Fabric acak dilemahkan (tidak bekerja) selama ronde ini.' }
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
    glass: { name: 'Glass', icon: '🔮', desc: '×1,5 Mult saat dimainkan.' }, steel: { name: 'Besi', icon: '🔩', desc: '×1,25 Mult selama tetap di tangan (tidak dimainkan).' },
    dbl: { name: 'Jahitan Ganda', icon: '🔁', desc: 'Kartu ini terpicu 2× saat dimainkan (nilai huruf + bonus imbuhan dihitung dua kali).' } };
  const AFFIX_ADD = 3;
  const LEMARI_ADD = 4;   // Wordrobe Quest (owner 25 Nov): a word from the player's own Lemari is a power word, +4 Mult
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
  // tile retrigger total: Jahitan Ganda card +1, Mesin Jahit Bibo +1 each, Jahitan Penutup +1 when the supply is low
  function score(tiles, fab, ctx, boss, rng) {
    if (boss && boss.off) boss = null;   // Gunting Emas switches the boss rules off
    const w = tiles.map(txt).join(''), n = w.length, fx = ctx.fx || {}, fv = id => (fx[id] && fx[id].v) || 0;
    const vow = [...w].filter(c => VOW.includes(c)), con = n - vow.length, rep = new Set(w).size < n, pos = posOf(w);
    const steps = []; let chips = 0, mult = 0, coins = 0;
    const step = o => { if (o.c) chips += o.c; if (o.m) mult += o.m; if (o.x) mult *= o.x; steps.push(o); };
    const fmt = o => o.c ? '+' + o.c : o.m ? '+' + o.m + ' Mult' : '×' + String(Math.round(o.x * 100) / 100).replace('.', ',');
    // which Fabric each slot acts as (a copy resolves to its target; a weakened Fabric acts as nothing)
    const rid = (at, depth) => {
      const id = fab[at];
      if (depth > 3 || id == null || id === ctx.debuff) return null;
      if (id === 'pola') return rid(at + 1, depth + 1);
      if (id === 'cermin') return at === 0 ? null : rid(0, depth + 1);
      return id;
    };
    const act = fab.map((id, at) => rid(at, 0)), cnt = id => act.filter(x => x === id).length;
    const hand = handInfo(pos, ctx.lv ? ctx.lv[pos] : 1);
    step({ c: hand.chips, m: hand.mult, label: hand.icon + ' ' + hand.name, hand: true });
    let lenBonus = (LB[n] || 0) * CFG.lenMul;
    if (boss && boss.id === 'short' && n > 5) lenBonus = 0;
    if (lenBonus) step({ c: lenBonus, label: '+' + lenBonus + ' panjang' });
    if (ctx.inLemari) step({ m: LEMARI_ADD, lemari: true, label: '👕 Lemari +' + LEMARI_ADD + ' Mult' });
    const lv = tiles.map(t => val(t)), affix = [], affixAdd = cnt('imbuhan') ? 8 : AFFIX_ADD;
    const lowSup = (ctx.supplyLeft != null ? ctx.supplyLeft : 99) <= 5;
    const extraRt = cnt('mesin') + (lowSup ? cnt('penutup') : 0);
    const starAt = tiles.findIndex(t => /[jqxzk]/.test(txt(t)));
    tiles.forEach((t, i) => {
      const times = 1 + (t.up === 'dbl' ? 1 : 0) + extraRt, tx = txt(t);
      for (let rep2 = 0; rep2 < times; rep2++) {   // a retriggered card fires again with every on-card effect
        step(rep2 ? { c: lv[i], tile: i, label: '🔁 +' + lv[i] } : { c: lv[i], tile: i });
        if (t.up === 'gold') step({ c: 30, tile: i, label: '+30' });
        if (t.up === 'ruby') step({ m: 4, tile: i, label: '+4 Mult' });
        if (t.up === 'glass') step({ x: 1.5, tile: i, label: '×1,5' });
        const k = kindOf(t.ch);
        if ((k === 'pre' && i === 0) || (k === 'suf' && i === tiles.length - 1)) { if (!rep2) affix.push(t.ch); step({ m: affixAdd, tile: i, label: '+' + affixAdd + ' Mult' }); }
        // "Saat dimainkan" Fabrics, in slot order
        act.forEach((id, at) => {
          let o = null;
          const nv = [...tx].filter(c => VOW.includes(c)).length, nc = tx.length - nv;
          if (id === 'vokal' && nv) o = { m: 3 * nv };
          else if (id === 'kokoh' && nc) o = { c: 12 * nc };
          else if (id === 'mahal' && /[jqxz]/.test(tx)) o = { c: 30 };
          else if (id === 'bintang' && i === starAt) o = { x: 2 };
          else if (id === 'kancing' && t.up === 'gold') { coins++; o = { coin: 1, label: '+1 🪙' }; }
          if (o) step(Object.assign(o, { tile: i, slot: fab[at], src: id, label: o.label || fmt(o) }));
        });
      }
    });
    const heldTimes = 1 + cnt('twin');   // Jarum Kembar retriggers the held cards
    (ctx.held || []).forEach(t => { if (t.up === 'steel') for (let k = 0; k < heldTimes; k++) step({ x: 1.25, held: t.id, label: k ? '🔁 ×1,25' : '×1,25' }); });
    const k5 = (ctx.chain || 0) + 1;
    const heldGold = (ctx.held || []).filter(t => t.up === 'gold').length;
    // one Fabric's scoring effect (null = nothing)
    const eff = id => {
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
      else if (id === 'lemariajaib' && ctx.inLemari) o = { x: 3 };
      else if (id === 'sisa' && ctx.discLeft > 0) o = { c: 30 * ctx.discLeft };
      else if (id === 'kusut') { const m = Math.floor(rng() * 24); if (m) o = { m }; }
      else if (id === 'mungil' && n <= 4) o = { m: 15 };
      else if (id === 'gulung' && ctx.supplyLeft > 0) o = { c: 2 * ctx.supplyLeft };
      else if (id === 'kainbaru' && fv(id) > 0) o = { c: fv(id) };
      else if (/^pita[nvar]$/.test(id) && pos === id[4]) o = { m: 10 };
      else if (/^mahkota[nvar]$/.test(id) && pos === id[7]) o = { x: 2 };
      else if (id === 'kosong' && ctx.discLeft === 0) o = { m: 15 };
      else if ((id === 'rapi' || id === 'gunting') && fv(id) > 0) o = { m: fv(id) };
      else if ((id === 'pitaukur' || id === 'tumbuh') && fv(id) > 0) o = { c: fv(id) };
      else if (id === 'bersarang' && nested(w)) o = { m: 8 };
      else if (id === 'kantong' && ctx.goldAll > 0) o = { x: Math.round((1 + 0.2 * ctx.goldAll) * 100) / 100 };
      else if (id === 'polaulang' && ctx.posSeen && ctx.posSeen.includes(pos)) o = { x: 3 };
      else if (id === 'brankas' && heldGold) o = { x: Math.round(Math.pow(1.5, heldGold) * 1000) / 1000 };
      else if (id === 'abadi' && ctx.bosses > 0) o = { x: Math.round((1 + 0.1 * ctx.bosses) * 100) / 100 };
      return o ? Object.assign(o, { src: id }) : null;
    };
    fab.forEach((id, at) => {
      if (id === ctx.debuff) { steps.push({ slot: id, weak: true, label: '✂️ Dilemahkan' }); return; }
      const ed = fx[id] && fx[id].ed;   // edition: Sulam Emas / Bordir before the effect, Pelangi after (copies do not copy editions)
      if (ed === 'foil') step({ c: 50, slot: id, ed: ed, label: '+50' });
      if (ed === 'holo') step({ m: 10, slot: id, ed: ed, label: '+10 Mult' });
      const o = act[at] && eff(act[at]);
      if (o) step(Object.assign(o, { slot: id, label: fmt(o) }));
      if (ed === 'poly') step({ x: 1.5, slot: id, ed: ed, label: '×1,5' });
    });
    const bossHalf = !!(boss && ((boss.id === 'repeater' && !rep) || (boss.id === 'minimal' && n < 5)));
    if (bossHalf) step({ x: 0.5, label: 'Boss ×0,5', boss: true });
    const jackpot = act.includes('jackpot') ? steps.some(x => x.src === 'jackpot') : null;
    const letters = lv.reduce((a, b) => a + b, 0);
    return { word: w, lv, letters, lenBonus, hand, affix, bossHalf, jackpot, coins, steps, chips, mult, subtotal: chips, final: Math.round(chips * mult) };
  }
  // Kata Bersarang: the word holds another dictionary word of 3+ letters (CARTOON holds CAR)
  function nested(w) {
    for (let L = 3; L < w.length; L++) for (let i = 0; i + L <= w.length; i++) if (isWord(w.slice(i, i + L))) return true;
    return false;
  }
  // growing Fabrics count this word before it scores (Balatro's Ride the Bus / Square Joker); a copy, so the preview can use it too
  function grownFx(G, R, tl) {
    const fx = JSON.parse(JSON.stringify(G.fx || {})), n = tl.map(txt).join('').length;
    const grow = (id, d) => { if (fx[id] && G.fabrics.includes(id) && !(R.boss && !R.boss.off && R.boss.fab === id)) fx[id].v = (fx[id].v || 0) + d; };
    grow('rapi', 1); if (n >= 6) grow('pitaukur', 10); grow('tumbuh', 2 * tl.length);
    return fx;
  }
  // the score context of a round: what the Fabrics need to know besides the word
  function ctxFor(G, R, held, extra) {
    return Object.assign({ first: !R.firstDone, chain: R.chain, lv: G.handLv, held: held, fx: G.fx || {}, debuff: R.boss && !R.boss.off ? R.boss.fab || null : null,
      discLeft: R.discards, supplyLeft: R.supply.length, goldAll: G.upgrades.filter(t => t.up === 'gold').length, bosses: (G.stats && G.stats.bosses) || 0, posSeen: R.posSeen || [] }, extra || {});
  }

  // a card is locked when the boss locks a letter it contains; a wild card is never locked but may not play as that letter
  const blocked = (R, t) => !!(R.boss && !R.boss.off && R.boss.block && t.ch !== '?' && t.ch.includes(R.boss.block));
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
    { id: 'boss10', name: 'Penjahit Tangguh', desc: 'Kalahkan 10 boss (total semua run).', total: 'bosses', need: 10, open: ['fabric', 'measure'], also: ['bg', 'weave'] },
    { id: 'noun150', name: 'Kolektor Benda', desc: 'Mainkan 150 noun (total semua run).', total: 'nouns', need: 150, open: ['deck', 'noun'] },
    { id: 'verb100', name: 'Banyak Gerak', desc: 'Mainkan 100 verb (total semua run).', total: 'verbs', need: 100, open: ['deck', 'verb'] },
    { id: 'adj60', name: 'Tukang Warna', desc: 'Mainkan 60 adjective (total semua run).', total: 'adjs', need: 60, open: ['deck', 'adj'] },
    { id: 'adv25', name: 'Si Paling Adverb', desc: 'Mainkan 25 adverb (total semua run).', total: 'advs', need: 25, open: ['deck', 'adv'] },
    { id: 'affix10', name: 'Tukang Imbuhan', desc: 'Mainkan 10 kata dengan prefiks dan sufiks sekaligus (total).', total: 'affix_words', need: 10, open: ['deck', 'wild'] },
    { id: 'giant5', name: 'Kata Raksasa', desc: 'Mainkan 5 kata 10 huruf atau lebih (total).', total: 'giant_words', need: 5, open: ['deck', 'long'] },
    { id: 'minimal5', name: 'Penakluk Minimalist', desc: 'Kalahkan The Minimalist 5 kali (total).', total: 'minimals', need: 5, open: ['deck', 'vowel'] },
    { id: 'calm', name: 'Tangan Tenang', desc: 'Selesaikan satu stage penuh (Ronde Kecil, Ronde Besar, Boss) tanpa Buang sama sekali.', run: true, open: ['fabric', 'steady'] },
    { id: 'champ', name: 'Juara', desc: 'Menangkan satu run: kalahkan boss Stage 8.', run: true, open: ['deck', 'gold'], also: ['fabric', 'mesin'] },
    { id: 'power50', name: 'Kata Kekuatan', desc: 'Mainkan 50 kata dari Lemarimu di Quest (total semua run).', total: 'lemari_words', need: 50, open: ['bg', 'thread'] },
    { id: 'lemari50', name: 'Pengumpul', desc: 'Simpan 50 kata dari game ke Lemari (total).', total: 'lemari', need: 50, open: ['fabric', 'lemariku'] },
    // owner 26 Nov: Mahkota achievements (win without playing a part of speech) and Legendaris Fabrics
    { id: 'crownn', name: 'Tanpa Benda', desc: 'Menangkan run tanpa memainkan satu Noun pun.', run: true, open: ['fabric', 'mahkotan'] },
    { id: 'crownv', name: 'Tanpa Gerak', desc: 'Menangkan run tanpa memainkan satu Verb pun.', run: true, open: ['fabric', 'mahkotav'] },
    { id: 'crowna', name: 'Tanpa Warna', desc: 'Menangkan run tanpa memainkan satu Adjective pun.', run: true, open: ['fabric', 'mahkotaa'] },
    { id: 'crownr', name: 'Tanpa Cara', desc: 'Menangkan run tanpa memainkan satu Adverb pun.', run: true, open: ['fabric', 'mahkotar'] },
    { id: 'power200', name: 'Lemari Bertuah', desc: 'Mainkan 200 kata dari Lemarimu di Quest (total semua run).', total: 'lemari_words', need: 200, open: ['fabric', 'lemariajaib'] },
    { id: 'boss30', name: 'Pemburu Boss', desc: 'Kalahkan 30 boss (total semua run).', total: 'bosses', need: 30, open: ['fabric', 'guntingemas'] }
  ];
  // moving backgrounds of the Quest screens: Gelombang is open from the start, the others come from achievements
  const BGS = [{ id: 'wave', name: 'Gelombang kain', icon: '🌊' }, { id: 'weave', name: 'Anyaman', icon: '🧶' }, { id: 'thread', name: 'Benang', icon: '🪡' }];
  // owned achievements; the old "Sampai Stage 8" (stage8) counts as Juara so nobody loses Kain Emas
  const hasAch = (achIds, id) => (achIds || []).includes(id) || (id === 'champ' && (achIds || []).includes('stage8'));
  // what an achievement list opens: { fabrics: [...], decks: [...], bgs: [...] }
  function opened(achIds) {
    const o = { fabrics: [], decks: ['base'], bgs: ['wave'] }, put = w => (w[0] === 'deck' ? o.decks : w[0] === 'bg' ? o.bgs : o.fabrics).push(w[1]);
    ACH.forEach(a => { if (hasAch(achIds, a.id)) { put(a.open); if (a.also) put(a.also); } });
    return o;
  }
  // "run" achievements earned inside this run
  function earned(G) {
    const out = [];
    if (G.stats.calm) out.push('calm');
    if (G.won) { out.push('champ'); const pc = G.winPos || G.stats.pos || {};   // counted at the win, so endless words do not undo a Mahkota
      'nvar'.split('').forEach(p => { if (!pc[p]) out.push('crown' + p); }); }
    return out;
  }
  // this run's counts, sent with the result; the server adds them up for the "total" achievements
  function runCounts(G) {
    const st = G.stats, pc = st.pos || {};
    return { nouns: pc.n || 0, verbs: pc.v || 0, adjs: pc.a || 0, advs: pc.r || 0, bosses: st.bosses || 0, minimals: st.minimals || 0, affix_words: st.affixWords || 0, giant_words: st.giantWords || 0, lemari_words: st.lemariWords || 0 };
  }

  function newGame(starterId, deckId, unlocked) {
    const G = { stage: 0, rnd: 0, fabrics: starterId ? [starterId] : [], upgrades: [], coins: 0, extra: 0, letterAdds: [], handBonus: 0, discardBonus: 0, bosses: [],
      handLv: { o: 1, n: 1, v: 1, a: 1, r: 1 }, deck: DECK[deckId] ? deckId : 'base', unlocked: (unlocked || []).slice(), fx: {}, labels: [],
      stats: { words: 0, longest: '', best: { w: '', s: 0 }, total: 0, list: [], pos: { o: 0, n: 0, v: 0, a: 0, r: 0 }, bosses: 0 } };
    const d = DECK[G.deck];
    (d.cards || []).forEach(c => G.letterAdds.push(c));
    if (d.lv) G.handLv[d.lv] = 2;
    if (d.hand) G.handBonus = d.hand;
    if (d.extra) G.extra = d.extra;
    (d.gold || []).forEach(c => G.upgrades.push(mk(c, 'gold')));
    if (starterId) addFabric(G, starterId, null, 0);
    return G;
  }
  // per-Fabric state: ed = edition, paid = price paid (sell value is half), v = growing value
  function addFabric(G, id, ed, paid) {
    G.fx = G.fx || {};
    if (!G.fabrics.includes(id)) G.fabrics.push(id);
    G.fx[id] = { ed: ed || null, paid: paid || 0, v: id === 'kainbaru' ? 100 : 0 };
  }
  // Fabric slots: 5, +1 Gantungan Ekstra, +1 for each Tembus Fabric (it takes no slot)
  const slotsOf = G => CFG.slots + (hasLabel(G, 'gantungan') ? 1 : 0) + G.fabrics.filter(id => G.fx && G.fx[id] && G.fx[id].ed === 'neg').length;
  const edOf = (G, id) => (G.fx && G.fx[id] && G.fx[id].ed) || null;
  function sellValue(G, id) {
    const f = FAB[id], x = (G.fx && G.fx[id]) || {}, base = x.paid || (RAR[f.r || 1].p + (x.ed ? ED[x.ed].p : 0));
    return Math.max(1, Math.floor(base / 2));
  }
  function sellFabric(G, id) {
    const i = G.fabrics.indexOf(id); if (i === -1) return 0;
    // a Tembus Fabric gives back its own slot; selling it with every slot full would leave one Fabric without a slot
    if (edOf(G, id) === 'neg' && G.fabrics.length > slotsOf(G) - 1) return 0;
    const v = sellValue(G, id); G.fabrics.splice(i, 1); if (G.fx) delete G.fx[id]; G.coins += v; return v;
  }
  function destroyFabric(G, id) { const i = G.fabrics.indexOf(id); if (i !== -1) G.fabrics.splice(i, 1); if (G.fx) delete G.fx[id]; }
  function rollEd(G, rng, legend) {
    const k = hasLabel(G, 'jarum') ? 3 : 1, u = rng();
    let acc = 0;
    for (const e of legend ? ['foil', 'holo'] : ['poly', 'neg', 'holo', 'foil']) { acc += ED[e].odds * k; if (u < acc) return e; }
    return null;
  }
  const disc = (G, p) => hasLabel(G, 'diskon') ? Math.max(1, Math.round(p * 0.75)) : p;
  const fabPrice = (G, id, ed) => disc(G, RAR[FAB[id].r || 1].p + (ed ? ED[ed].p : 0));
  // the Fabric offer: rarity first (70/25/5, Rak Gantung 50/38/12), then a Fabric of that rarity, then an edition
  function pickFabric(G, rng, exclude) {
    const pool = FABRICS.filter(f => !G.fabrics.includes(f.id) && avail(G, f) && (f.r || 1) < 4 && !exclude.includes(f.id));
    if (!pool.length) return null;
    const w = hasLabel(G, 'rakgantung') ? [0, 50, 38, 12] : [0, RAR[1].w, RAR[2].w, RAR[3].w], u = rng() * 100;
    const want = u < w[1] ? 1 : u < w[1] + w[2] ? 2 : 3;
    const of = pool.filter(f => (f.r || 1) === want), from = of.length ? of : pool;
    return from[Math.floor(rng() * from.length)];
  }
  const roundIndex = G => G.stage * 3 + G.rnd;
  // endless (owner 26 Nov): after stage 8 the target climbs faster each stage, k = stages past the 8th
  function targetFor(stage, rnd, G) {
    const s = hasLabel(G, 'mundur') ? stage - 1 : stage, k = Math.max(0, stage - CFG.stages + 1);
    let b = CFG.base * Math.pow(CFG.growth, s) * (1 + CFG.ramp * Math.max(0, s)) * CFG.roundMul[rnd];
    if (k) b *= Math.pow(1.4, k) * Math.pow(1.1, k * (k - 1) / 2);
    return Math.round(b / 10) * 10 || 10;
  }
  function pickBoss(G, rng) {
    let left = BOSSES.filter(b => !G.bosses.includes(b.id));
    if (!left.length) { G.bosses = []; left = BOSSES.slice(); }
    const b = left[Math.floor(rng() * left.length)];
    G.bosses.push(b.id);
    const o = { id: b.id, name: b.name, desc: b.desc };
    if (b.pick) o.block = b.pick[Math.floor(rng() * b.pick.length)];
    if (b.id === 'cutter' && G.fabrics.length) o.fab = G.fabrics[Math.floor(rng() * G.fabrics.length)];
    if (G.fabrics.includes('guntingemas')) { o.off = true; delete o.block; delete o.fab; }
    return o;
  }
  // Ganti Lawan: once per stage the boss may be swapped for another one
  function swapBoss(G, R, rng) {
    if (!R.boss || !hasLabel(G, 'gantilawan') || G.swapped === G.stage || R.words || R.discards < R.maxDiscards) return false;
    const old = R.boss.id; let b = pickBoss(G, rng), guard = 0;
    while (b.id === old && guard++ < 10) b = pickBoss(G, rng);
    R.boss = b; G.swapped = G.stage; return true;
  }
  const handSize = G => CFG.hand + G.handBonus + (hasLabel(G, 'tas') ? 1 : 0);
  const discardsOf = G => Math.max(0, CFG.discards + G.discardBonus + (hasLabel(G, 'guntingc') ? 1 : 0) - (hasLabel(G, 'mundur') ? 1 : 0));
  function makeRound(G, rng) {
    G.fx = G.fx || {}; G.labels = G.labels || [];
    // round-start Fabrics: Penenun adds a letter; Gunting Tajam cuts the Fabric on its right and keeps 2x its sell value as Mult
    let woven = null, cut = null;
    if (G.fabrics.includes('penenun')) { woven = randLetter(rng); G.letterAdds.push(woven); }
    const gi = G.fabrics.indexOf('gunting'), right = gi !== -1 ? G.fabrics[gi + 1] : null;
    if (right) { const v = 2 * sellValue(G, right); destroyFabric(G, right); G.fx.gunting.v = (G.fx.gunting.v || 0) + v; cut = { id: right, v }; }
    const hs = handSize(G);
    const total = hs + CFG.supply + G.extra + G.letterAdds.length;
    const bag = []; for (const c in BAG) for (let i = 0; i < BAG[c]; i++) bag.push(c);
    shuffle(bag, rng);
    const tiles = bag.slice(0, Math.max(0, total - G.upgrades.length - G.letterAdds.length)).map(c => mk(c));
    G.letterAdds.forEach(c => tiles.push(mk(c)));
    G.upgrades.forEach(u => tiles.push(u));
    shuffle(tiles, rng);
    const isBoss = G.rnd === 2;
    const nd = discardsOf(G);
    return { target: targetFor(G.stage, G.rnd, G), score: 0, handSize: hs, hand: tiles.slice(0, hs), supply: tiles.slice(hs), posSeen: [], woven, cut,
      words: 0, firstDone: false, chain: 0, refillUsed: false, discards: nd, maxDiscards: nd, boss: isBoss ? pickBoss(G, rng) : null };
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
    const on = id => G.fabrics.includes(id) && !(R.boss && !R.boss.off && R.boss.fab === id);
    G.fx = grownFx(G, R, tl);
    const wasFirst = !R.firstDone;
    const res = score(tl, G.fabrics, ctxFor(G, R, held, ctxExtra), R.boss, rng);
    R.score += res.final; R.words++; R.firstDone = true;
    if (res.coins) G.coins += res.coins;
    R.posSeen = (R.posSeen || []).concat(res.hand.pos);
    if (on('kainbaru') && G.fx.kainbaru) { G.fx.kainbaru.v -= 5; if (G.fx.kainbaru.v <= 0) { destroyFabric(G, 'kainbaru'); res.destroyed = 'kainbaru'; } }
    if (on('rakbuku') && res.hand.pos === 'r' && rng() < 1 / 3) { G.handLv.r = lvOf(G, 'r') + 1; res.book = 'r'; }
    if (on('cetakan') && wasFirst && tl.length === 3) { const t = tl[Math.floor(rng() * tl.length)]; if (t.up) G.upgrades.push(mk(t.ch, t.up)); else G.letterAdds.push(t.ch); res.copied = t.ch; }
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
    if (ctxExtra && ctxExtra.inLemari) st.lemariWords = (st.lemariWords || 0) + 1;
    let recycled = null;
    if (on('recycler') && rng() < 0.2) {
      const t = tl[Math.floor(rng() * tl.length)];
      R.supply.splice(Math.floor(rng() * (R.supply.length + 1)), 0, mk(t.ch)); recycled = t.ch;
    }
    draw(R, R.handSize);
    let extra = false;
    if (on('refill') && !R.refillUsed && w.length >= 5 && R.supply.length) {
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
    if (G.fx && G.fx.rapi) G.fx.rapi.v = 0;
    draw(R, R.handSize); return true;
  }
  function finishRound(G, R) {
    const on = id => G.fabrics.includes(id) && !(R.boss && !R.boss.off && R.boss.fab === id);
    let coins = CFG.coinRound + G.stage, saver = 0, steady = 0;
    const piggy = on('celengan') ? 3 : 0, interest = hasLabel(G, 'celengan') ? Math.min(5, Math.floor(G.coins / 5)) : 0;
    if (on('saver')) saver = Math.floor((R.hand.length + R.supply.length) / 3);
    const st = G.stats, noDisc = R.discards === R.maxDiscards;
    if (noDisc) { if (on('steady')) steady = 2; } else st.stageDisc = true;
    if (R.boss) {
      st.bosses = (st.bosses || 0) + 1; if (R.boss.id === 'minimal') st.minimals = (st.minimals || 0) + 1;
      if (!st.stageDisc) st.calm = true;   // a whole stage (2 rounds + boss) won without a discard
      st.stageDisc = false;
    }
    G.coins += coins + saver + steady + piggy + interest; return { coins, saver, steady, piggy, interest };
  }
  // after a boss: a Legendaris Fabric that an achievement opened may be offered (15%)
  function rewardOptions(G, rng, afterBoss) {
    const opts = [];
    const kinds = shuffle(['fabric', 'fabric', 'up', 'coin', 'book', 'multi'], rng);
    for (const k of kinds) {
      if (opts.length >= 3) break;
      if (k === 'fabric') { const f = pickFabric(G, rng, opts.map(o => o.id)); if (f) opts.push({ type: 'fabric', id: f.id, ed: rollEd(G, rng) }); }
      else if (k === 'up') opts.push(upItem(rng));
      else if (k === 'book') opts.push(bookItem(rng));
      else if (k === 'multi') opts.push(multiItem(rng));
      else opts.push({ type: 'coin', n: 6 });
    }
    while (opts.length < 3) opts.push(rng() < 0.6 ? upItem(rng) : { type: 'coin', n: 6 + G.stage });
    if (!opts.some(o => ['up', 'multi', 'wild', 'book', 'letter'].includes(o.type))) opts[2] = rng() < 0.5 ? upItem(rng) : multiItem(rng);   // a card upgrade is always on offer
    if (afterBoss) {
      const leg = FABRICS.filter(f => f.r === 4 && avail(G, f) && !G.fabrics.includes(f.id));
      if (leg.length && rng() < 0.15) { const f = leg[Math.floor(rng() * leg.length)]; opts[0] = { type: 'fabric', id: f.id, ed: rollEd(G, rng, true) }; }
    }
    return opts;
  }
  const upItem = rng => ({ type: 'up', kind: ['gold', 'ruby', 'glass', 'steel', 'dbl'][Math.floor(rng() * 5)], ch: randLetter(rng) });
  const priced = (G, o) => Object.assign(o, { price: disc(G, CFG.price[o.type === 'up' ? o.kind : o.type]) });
  // card section: 2 upgraded letters, 1 letter, 2 multi-letter (or wild) cards, 1 grammar book; Rak Tambahan +1 card, Kartu Ajaib more upgrades and affixes
  function shopCards(G, rng) {
    const aj = hasLabel(G, 'ajaib');
    const affix = () => ({ type: 'multi', ch: PRE.concat(SUF)[Math.floor(rng() * (PRE.length + SUF.length))] });
    const list = [upItem(rng), upItem(rng), aj ? upItem(rng) : { type: 'letter', ch: randLetter(rng) }, aj ? affix() : multiItem(rng), multiItem(rng), bookItem(rng)];
    if (hasLabel(G, 'rak')) list.splice(2, 0, aj ? upItem(rng) : rng() < 0.5 ? upItem(rng) : multiItem(rng));
    return list.map(o => Object.assign(priced(G, o), { sec: 'card' }));
  }
  function shopFabrics(G, rng) {
    const out = [];
    for (let k = 0; k < 3; k++) { const f = pickFabric(G, rng, out.map(o => o.id)); if (!f) break; const ed = rollEd(G, rng); out.push({ type: 'fabric', id: f.id, ed, price: fabPrice(G, f.id, ed), sec: 'fabric' }); }
    return out;
  }
  // one Label per shop (Balatro's Voucher), bought once per run
  function shopLabel(G, rng) {
    const left = LABELS.filter(l => !(G.labels || []).includes(l.id));
    if (!left.length) return [];
    const l = left[Math.floor(rng() * left.length)];
    return [{ type: 'label', id: l.id, price: disc(G, l.price || 10), sec: 'label' }];
  }
  function shopItems(G, rng) { return shopCards(G, rng).concat(shopFabrics(G, rng), shopLabel(G, rng)); }
  const rerollPrice = G => Math.max(1, CFG.price.reroll - (hasLabel(G, 'reroll') ? 1 : 0));
  // reroll one section only; the other sections keep their offers (and what was already bought)
  function rerollShop(G, shop, sec, rng) { return shop.filter(o => (o.sec || (o.type === 'fabric' ? 'fabric' : 'card')) !== sec).concat(sec === 'fabric' ? shopFabrics(G, rng) : shopCards(G, rng)); }
  const bookItem = rng => ({ type: 'book', pos: 'nvar'[Math.floor(rng() * 4)] });
  // a multi-letter card, or (1 in 5) a wild card; both join the supply of every later round
  const multiItem = rng => rng() < 0.2 ? { type: 'wild', ch: '?' } : { type: 'multi', ch: MULTI[Math.floor(rng() * MULTI.length)] };
  // always-available permanent upgrade (owner 26 Nov: +1 Buang and +1 tangan moved to the Labels Gunting Cadangan and Tas Lebar)
  function permItems(G) {
    return [{ type: 'supply', n: CFG.supplyPack, price: disc(G, CFG.price.supply + Math.floor(Math.max(0, G.extra) / CFG.supplyPack)) }];
  }
  const bookStep = G => hasLabel(G, 'bukularis') ? 2 : 1;
  function addUpgrade(G, kind, ch) { G.upgrades.push(mk(ch, kind)); }
  // after restoring a saved run: new tile ids must not collide with the restored ones
  function resumeIds(G, R) { let m = 0; const see = t => { if (t.id > m) m = t.id; }; G.upgrades.forEach(see); if (R) { R.hand.forEach(see); R.supply.forEach(see); } if (m >= UID) UID = m + 1; }
  return { RAR, ED, TERMS, LABELS, LABEL, hasLabel, addFabric, slotsOf, edOf, sellValue, sellFabric, destroyFabric, rollEd, fabPrice, pickFabric, swapBoss, discardsOf, ctxFor, grownFx, nested, shopLabel, rerollPrice, bookStep,
    UPS, HAND_STEP, LEMARI_ADD, BGS, hasAch, DECKS, DECK, ACH, opened, earned, runCounts, avail, val, txt, kindOf, HANDS, MULTI, PRE, SUF, PAIRS, posOf, lvOf, handInfo, spell, V, LB, CFG, FABRICS, FAB, BOSSES, setDict, isWord, rngFrom, shuffle, mk, score, blocked, candidates, tilesFor, best, newGame,
    roundIndex, targetFor, handSize, permItems, makeRound, draw, submit, stuck, failed, discard, canDiscard, finishRound, rewardOptions, shopItems, shopCards, shopFabrics, rerollShop, addUpgrade, resumeIds, randLetter, get ARR() { return ARR; } };
})();

/* ---------- UI (only runs in the browser, after the host page calls WRGame.init) ---------- */
const UI = (function () {
  const E = Engine, F = id => E.FAB[id];
  const KEY = 'wr_game', BEST = 'wr_game_best', ENDKEY = 'wr_game_endless';
  const endlessBest = () => +store.get(ENDKEY) || 0;
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
.bq-hole{position:fixed;pointer-events:none;border-radius:14px;box-shadow:0 0 0 4px #ffd23f,0 0 0 9999px rgba(0,0,0,.55);z-index:80;transition:left .25s,top .25s,width .25s,height .25s}
.bq-hole.none{box-shadow:0 0 0 0 transparent,0 0 0 9999px rgba(0,0,0,.45);width:0;height:0;left:50%;top:50%}
.bq-tut{position:fixed;left:10px;right:10px;z-index:81;pointer-events:none;display:flex;gap:10px;align-items:flex-end;max-width:560px;margin:0 auto}.bq-tut.top{top:10px;align-items:flex-start}.bq-tut.bot{bottom:calc(10px + env(safe-area-inset-bottom))}
.bq-tut img{width:72px;height:auto;flex:none;filter:drop-shadow(0 4px 8px #0006)}
.bq-bub{flex:1;pointer-events:auto;background:var(--card);color:var(--text);border:2px solid var(--yellow);border-radius:16px;padding:10px 12px;box-shadow:0 8px 24px #0008;font-size:14px;line-height:1.4}
.bq-bub p{margin:4px 0 8px}.bq-bub .bq-btns{margin:0}.bq-bub small{color:var(--muted)}
.bq-win3{flex-wrap:wrap}.bq-win3 .bq-btn{flex:1 1 30%;min-width:120px}
.bq-fab{position:relative;overflow:hidden}.bq-fab>*{position:relative}.bq-fab.rr1,.bq-fab.rr2,.bq-fab.rr3,.bq-fab.rr4{--fill:color-mix(in srgb,var(--rc) 16%,var(--card));background:var(--knit) 0 0/10px 7px repeat-x,var(--knit) 5px 7px/10px 7px repeat-x,var(--fill);border-color:var(--rc);padding-top:22px}.bq-fab.rr1::before,.bq-fab.rr2::before,.bq-fab.rr3::before,.bq-fab.rr4::before{content:'';position:absolute;inset:18px 5px 5px;border:1.5px dashed var(--rc);border-radius:10px;pointer-events:none}button.bq-slot.bq-fab{padding:12px 6px 6px;background-size:10px 7px,0 0,auto}button.bq-slot.bq-fab::before{inset:9px 3px 3px;border-radius:7px}.bq-fab.rr1{--rc:#888780;--knit:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Crect width='10' height='7' fill='%235F5E5A'/%3E%3Cellipse cx='2.7' cy='3.8' rx='2.1' ry='3.9' transform='rotate(-24 2.7 3.8)' fill='%23888780'/%3E%3Cellipse cx='7.3' cy='3.8' rx='2.1' ry='3.9' transform='rotate(24 7.3 3.8)' fill='%23888780'/%3E%3Cellipse cx='2.4' cy='3' rx='0.9' ry='2.3' transform='rotate(-24 2.4 3)' fill='%23B4B2A9'/%3E%3Cellipse cx='7.6' cy='3' rx='0.9' ry='2.3' transform='rotate(24 7.6 3)' fill='%23B4B2A9'/%3E%3C/svg%3E")}.bq-fab.rr2{--rc:#3fae5a;--knit:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Crect width='10' height='7' fill='%2327633b'/%3E%3Cellipse cx='2.7' cy='3.8' rx='2.1' ry='3.9' transform='rotate(-24 2.7 3.8)' fill='%233fae5a'/%3E%3Cellipse cx='7.3' cy='3.8' rx='2.1' ry='3.9' transform='rotate(24 7.3 3.8)' fill='%233fae5a'/%3E%3Cellipse cx='2.4' cy='3' rx='0.9' ry='2.3' transform='rotate(-24 2.4 3)' fill='%237fd492'/%3E%3Cellipse cx='7.6' cy='3' rx='0.9' ry='2.3' transform='rotate(24 7.6 3)' fill='%237fd492'/%3E%3C/svg%3E")}.bq-fab.rr3{--rc:#D4537E;--knit:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Crect width='10' height='7' fill='%2372243E'/%3E%3Cellipse cx='2.7' cy='3.8' rx='2.1' ry='3.9' transform='rotate(-24 2.7 3.8)' fill='%23993556'/%3E%3Cellipse cx='7.3' cy='3.8' rx='2.1' ry='3.9' transform='rotate(24 7.3 3.8)' fill='%23993556'/%3E%3Cellipse cx='2.4' cy='3' rx='0.9' ry='2.3' transform='rotate(-24 2.4 3)' fill='%23D4537E'/%3E%3Cellipse cx='7.6' cy='3' rx='0.9' ry='2.3' transform='rotate(24 7.6 3)' fill='%23D4537E'/%3E%3C/svg%3E")}.bq-fab.rr4{--rc:#e3b23c;--knit:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7'%3E%3Crect width='10' height='7' fill='%23854F0B'/%3E%3Cellipse cx='2.7' cy='3.8' rx='2.1' ry='3.9' transform='rotate(-24 2.7 3.8)' fill='%23BA7517'/%3E%3Cellipse cx='7.3' cy='3.8' rx='2.1' ry='3.9' transform='rotate(24 7.3 3.8)' fill='%23BA7517'/%3E%3Cellipse cx='2.4' cy='3' rx='0.9' ry='2.3' transform='rotate(-24 2.4 3)' fill='%23FAC775'/%3E%3Cellipse cx='7.6' cy='3' rx='0.9' ry='2.3' transform='rotate(24 7.6 3)' fill='%23FAC775'/%3E%3C/svg%3E")}.bq-fab.ed-foil::after,.bq-fab.ed-holo::after,.bq-fab.ed-poly::after{content:'';position:absolute;inset:0;pointer-events:none;mix-blend-mode:screen;opacity:.55;border-radius:inherit}.bq-fab.ed-foil::after{background:linear-gradient(115deg,transparent 30%,#fff6c8 45%,transparent 60%);background-size:250% 100%;animation:bq-gl 3s linear infinite}.bq-fab.ed-holo::after{background:repeating-radial-gradient(circle at 30% 40%,#ff9ad560 0 4px,transparent 4px 10px)}.bq-fab.ed-poly::after{background:linear-gradient(90deg,#ff5e5e,#ffd35e,#5eff8a,#5ec8ff,#c45eff);opacity:.35;animation:bq-hue 4s linear infinite}.bq-fab.ed-neg{filter:invert(.88) hue-rotate(180deg)}@keyframes bq-gl{from{background-position:150% 0}to{background-position:-100% 0}}@keyframes bq-hue{to{filter:hue-rotate(360deg)}}@media(prefers-reduced-motion:reduce){.bq-fab::after{animation:none!important}}.bq-rar{font-size:10px;font-weight:800;border-radius:6px;padding:1px 5px;color:#fff;background:var(--rc,#888780);vertical-align:middle;margin-left:3px}.bq-edt{font-size:10px;font-weight:800;border-radius:6px;padding:1px 5px;background:#fff3;border:1px solid currentColor;vertical-align:middle;margin-left:3px}.bq-terms{display:flex;flex-wrap:wrap;gap:4px;margin-top:8px}.bq-terms span{font-size:11.5px;border-radius:8px;padding:3px 7px;background:var(--card-2)}.bq-terms b{font-size:11.5px!important}.bq-slot .weak{position:absolute;top:2px;right:3px;font-size:13px}.bq-slot.weak{opacity:.55;filter:grayscale(.8)}.bq-slot .edb{position:absolute;top:2px;left:3px;font-size:11px}.bq-labels{display:flex;flex-wrap:wrap;gap:4px}.bq-labels span{font-size:12px;border-radius:8px;padding:2px 7px;background:var(--card-2)}.bq-gi.lab{border-color:#c59bff}.bq-cgrid .bq-ci.bq-fab .d{color:var(--text)}
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
.bq-k{font-size:10.5px;font-weight:800;border-radius:6px;padding:1px 5px;background:var(--card-2);color:var(--muted);vertical-align:middle}.bq-k.c{background:#2f7fd1;color:#fff}.bq-k.m{background:#e0475f;color:#fff}.bq-k.x{background:#8a2be2;color:#fff}.bq-k.u{background:#1f9d6b;color:#fff}
.bq-tile.ruby{background:linear-gradient(135deg,#ffb3c0,#ff5f7e);box-shadow:0 3px 0 #b8324f}.bq-tile.steel{background:linear-gradient(135deg,#e3e7ee,#9aa4b2);box-shadow:0 3px 0 #626b78}.bq-tile.dbl{background:linear-gradient(135deg,#c9f5dc,#5fcf98);box-shadow:0 3px 0 #2c8a5c;outline:2px dashed rgba(255,255,255,.8);outline-offset:-5px}
.bq-hp{height:11px;background:var(--card-2);border-radius:999px;overflow:hidden;margin:4px 0 0}.bq-hp i{display:block;height:100%;background:linear-gradient(90deg,#ff6b6b,#ff9a6b);transition:width .5s}
.bq-vs{align-self:center;font:800 18px var(--display);color:var(--line)}
.bq-atk{animation:bq-atk .5s}@keyframes bq-atk{35%{transform:translateX(64px) rotate(6deg)}}
.bq-ehit{animation:bq-ehit .5s .18s}@keyframes bq-ehit{20%{transform:translateX(9px);filter:brightness(2)}55%{transform:translateX(-9px)}}
.bq-dead{animation:bq-dead .9s .3s forwards}@keyframes bq-dead{to{transform:translateY(24px) rotate(28deg) scale(.5);opacity:0}}
.bq-dmg{position:absolute;right:16%;top:8px;font:800 28px var(--display);color:var(--yellow);animation:bq-dmg 1s .2s both;text-shadow:0 2px 0 #0008}@keyframes bq-dmg{from{transform:translateY(14px);opacity:0}30%{opacity:1}to{transform:translateY(-16px);opacity:0}}
.bq-say{position:absolute;left:12px;top:8px;background:#fff;color:#111;font:800 12px var(--ui);padding:3px 9px;border-radius:10px;animation:bq-dmg 1.6s both}
.bq-bar{display:flex;justify-content:space-between;font-size:13px;color:var(--muted)}.bq-bar b{color:var(--text)}
.bq-boss{background:var(--card);border-radius:16px;padding:10px 12px;font-size:13px;box-shadow:inset 0 0 0 1.5px var(--pink)}.bq-boss b{color:var(--pink)}
.bq-slots{display:grid;grid-template-columns:repeat(var(--ns,5),minmax(0,1fr));gap:6px}
.bq-slot{background:var(--card);border:1.5px dashed var(--line);border-radius:12px;min-height:58px;padding:4px;text-align:center;font:inherit;font-size:10.5px;line-height:1.15;display:flex;flex-direction:column;justify-content:center;align-items:center;color:var(--muted)}
button.bq-slot{cursor:pointer;border:1.5px solid var(--yellow);color:var(--text)}
.bq-slot[data-a="showFab"]{touch-action:pan-y;user-select:none;-webkit-user-select:none}.bq-slot.drag{position:relative;z-index:5;cursor:grabbing;box-shadow:0 8px 20px #0007;transition:none;background:var(--card-2)}.bq-slot.drop{box-shadow:0 0 0 2px var(--yellow);background:var(--card-2)}.bq-slot .ic{font-size:20px}
.bq-info{display:flex;gap:6px;font-size:12px;color:var(--muted);flex-wrap:wrap}.bq-info span,.bq-info .bq-sv{background:var(--card);padding:4px 10px;border-radius:999px}
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
.bq-gu{position:absolute;top:8px;left:8px;z-index:3;border:0;border-radius:999px;background:#e0475f;color:#fff;font:800 12px var(--ui);padding:6px 11px;cursor:pointer;box-shadow:0 2px 0 #0004}
.bq-r>.bq-R>.bq-giveup{display:none}
.bq-sv{border:1.5px solid var(--yellow)!important;font-weight:800!important}
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
/* the round screen fits one phone screen: smaller art, one-line chips, a hand that never wraps */
.bq-r{gap:8px;--bq-art:100px}
.bq-r .bq-name{white-space:normal;line-height:1.2}
.bq-r .bq-top{gap:8px}.bq-r .bq-top .t b{display:inline;font-size:14px;color:var(--text)}.bq-r .bq-coin{padding:3px 10px;font-size:14px}
.bq-r .bq-bar{font-size:12px}
.bq-r .bq-boss{padding:6px 10px;font-size:12px;line-height:1.3}
.bq-r .bq-slot{min-height:40px;font-size:9.5px;border-radius:10px}.bq-r .bq-slot .ic{font-size:16px}
.bq-r .bq-info{flex-wrap:nowrap;overflow:hidden;font-size:11.5px}.bq-r .bq-info span,.bq-info .bq-sv{padding:3px 8px;white-space:nowrap}
.bq-r .bq-prev{min-height:84px;max-height:118px;padding:8px 10px;overflow:hidden}.bq-r .bq-prev .bq-chips{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.bq-r .bq-prev .bq-chips::-webkit-scrollbar{display:none}.bq-r .bq-prev .bq-chip{flex:none}
.bq-r .bq-sel{min-height:38px;margin-bottom:4px;flex-wrap:nowrap;gap:4px}.bq-r .bq-sel .bq-tile{width:32px;height:38px;font-size:17px}
.bq-r .bq-last{background:none;padding:0;border-radius:0}
.bq-r .bq-msg{min-height:16px;font-size:12px;line-height:16px;margin:-2px 0}
.bq-r .bq-hand{display:grid;grid-template-columns:repeat(var(--bq-n,8),minmax(0,48px));gap:5px;justify-content:center}
.bq-r .bq-hand .bq-tile{width:auto;height:50px;font-size:22px}.bq-tile.multi.m3{font-size:14px!important;letter-spacing:-.8px}.bq-tile.multi.m4{font-size:11px!important;letter-spacing:-.8px}
.bq-r .bq-btn{min-height:46px;min-width:0;padding:0 8px;white-space:nowrap}
.bq-r .bq-kb{font-size:12px}
@media(hover:none){.bq-kb{display:none}}
@media(max-height:740px){.bq-r{--bq-art:84px}}
@media(max-height:680px){.bq-r{--bq-art:44px;gap:5px}.bq-r .bq-sel{min-height:34px}.bq-r .bq-sel .bq-tile{width:30px;height:34px;font-size:16px}.bq-r .bq-btn{min-height:38px}.bq-r .bq-slot{min-height:32px}.bq-r .bq-giveup{padding:0}.bq-r .bq-bar,.bq-r .bq-boss{font-size:11px}.bq-r .bq-boss{padding:4px 8px}.bq-r .bq-hand .bq-tile{height:40px}.bq-r .bq-prev{min-height:66px}}
.bq-L,.bq-R{display:contents}
.bq-host>:not(.bq-bgc){position:relative;z-index:1}
.bq-bgc{position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:0;pointer-events:none}
.bq-bgon .bq-mut{color:var(--text);opacity:.8}
.bq-hn,.bq-pile,.bq-rs,.bq-hudg,.bq-bh,.bq-tg{display:none}
.bq-handrow{display:flex;align-items:flex-end;justify-content:center;gap:10px}
.bq-hand.fan .bq-tile{transform:rotate(var(--fr));transition:transform .15s}
.bq-hand.fan .bq-tile.used{transform:translateY(6px) rotate(var(--fr))}
.bq-hand.fan .bq-tile.hit{transform:translateY(-8px) scale(1.08)}
@media(hover:hover){.bq-hand.fan .bq-tile:not(.used):not(.lock):hover{transform:translateY(-6px) rotate(var(--fr))}}
button.bq-slot.k-chips{border-top:4px solid #2f7fd1}button.bq-slot.k-add{border-top:4px solid #e0475f}button.bq-slot.k-x{border-top:4px solid #8a2be2}button.bq-slot.k-rt,button.bq-slot.k-copy{border-top:4px solid #1f9d6b}
.bq-pile{flex:none;flex-direction:column;align-items:center;justify-content:center;width:52px;height:68px;border-radius:10px;background:repeating-linear-gradient(45deg,#6c5ce7 0 6px,#5a4bd1 6px 12px);color:#fff;box-shadow:3px 3px 0 #3c3489,6px 6px 0 #2a2470}
.bq-pile{border:0;font:inherit;cursor:pointer}.bq-pile b{font:800 18px var(--display)}
.bq-sv{border:0;color:inherit;font:inherit;cursor:pointer;text-decoration:underline dotted}
.bq-sup{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:8px 6px;margin-top:8px}.bq-sup .it{display:flex;flex-direction:column;align-items:center;gap:2px}.bq-sup .bq-tile{width:40px;height:46px;font-size:20px;pointer-events:none}.bq-sup .bq-tile.multi{font-size:13px}.bq-sup i{font-style:normal;font-size:12px;font-weight:800;color:var(--muted)}.bq-sup .it.none{opacity:.3}.bq-pile small{font-size:10px;font-weight:700;opacity:.9}
.bq-orow{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--line)}
.bq-bgpick{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0 4px}.bq-bgpick .bq-btn{flex:1 1 40%}
.bq-stages{display:flex;gap:4px;flex-wrap:wrap;margin-top:8px}.bq-stages span{width:30px;height:30px;border-radius:8px;display:grid;place-items:center;background:var(--card-2);font-weight:800;font-size:13px;color:var(--muted)}
.bq-stages .done{background:var(--mint);color:var(--on-accent)}.bq-stages .now{background:var(--yellow);color:var(--on-accent)}
.bq-cgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px}
.bq-ci{background:var(--card);border-radius:16px;padding:10px;display:flex;flex-direction:column;gap:3px;font-size:13px}.bq-ci .ic{font-size:24px}.bq-ci .d{font-size:12px;color:var(--muted);line-height:1.3}.bq-ci.lock{opacity:.65}.bq-ci .bq-btn{margin-top:4px}
.bq-win{background:var(--card);border-radius:24px;padding:18px}.bq-win img{height:150px;width:auto}
.bq-intro{min-height:calc(100dvh - 90px);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:18px;text-align:center;padding:10px 0}
.bq-title{display:flex;flex-direction:column;align-items:center}
.bq-hero .bq-logo{width:min(92vw,680px);max-height:52vh;height:auto;object-fit:contain;filter:drop-shadow(0 6px 0 #0005);animation:bq-bob 4s ease-in-out infinite}@keyframes bq-bob{50%{transform:translateY(-6px) rotate(-1deg)}}
.bq-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
.bq-hero{display:flex;flex-direction:column;align-items:center;line-height:.9}
.bq-menu{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;align-items:stretch}
.bq-mbox{background:#1c1a26e8;border-radius:18px;padding:8px;display:flex;gap:8px;box-shadow:0 4px 0 #0006}
.bq-mbox.rec{flex-direction:column;justify-content:center;align-items:center;min-width:96px;color:#d3d1c7;padding:8px 12px}.bq-mbox.rec b{background:#5f5e5a;color:#fff;border-radius:10px;padding:4px 10px;font-size:15px;margin:3px 0}.bq-mbox.rec small{font-size:12px;font-weight:700}
.bq-mbox.side{flex-direction:column}
.bq-mb{border:0;border-radius:12px;color:#fff;font:800 22px var(--display);letter-spacing:.5px;padding:0 22px;min-height:64px;cursor:pointer;box-shadow:0 4px 0 #0005}
.bq-mb:active{transform:translateY(2px);box-shadow:0 2px 0 #0005}
.bq-mb.blue{background:#2f7fd1;min-width:150px}.bq-mb.green{background:#1f9d6b;min-width:150px}.bq-mbox.side .bq-mb{min-height:28px;font-size:14px;padding:0 16px}.bq-mb.orange{background:#e8901a}.bq-mb.red{background:#e0475f}
.bq-pills{display:flex;gap:8px;flex-wrap:wrap;justify-content:center}
@media(hover:hover) and (pointer:fine){.bq-orient{display:none}}
.bq-pill{border:0;background:#1c1a26e0;color:#e8e6f0;border-radius:999px;padding:7px 14px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}
@media(max-width:560px){.bq-mbox.main{order:-1;width:100%}.bq-mbox.main .bq-mb{flex:1;min-width:0}.bq-mb{font-size:20px}}
@media(prefers-reduced-motion:reduce){.bq-logo{animation:none}}
@media(min-width:600px) and (orientation:portrait){.bq-r{--bq-art:150px}.bq-r .bq-hand{grid-template-columns:repeat(var(--bq-n,8),minmax(0,62px));gap:7px}.bq-r .bq-hand .bq-tile{height:64px;font-size:28px}.bq-r .bq-slot{min-height:56px;font-size:12px}.bq-r .bq-slot .ic{font-size:22px}.bq-r .bq-sel .bq-tile{width:40px;height:48px;font-size:21px}.bq-r .bq-btn{min-height:54px;font-size:16px}.bq-r .bq-prev{max-height:140px}.bq-cm b{font-size:21px}.bq-r .bq-info{font-size:13px}}
@media((orientation:landscape) and (min-width:900px) and (min-height:540px)) or ((orientation:landscape) and (max-height:539.98px) and (min-width:560px)){
.bq-r{display:grid;grid-template-columns:var(--hudw,300px) minmax(0,1fr);gap:14px 18px;align-items:stretch;min-height:calc(100dvh - 90px)}
.bq-r .bq-L{display:flex;flex-direction:column;gap:8px;align-self:stretch;background:#16141fe0;border-radius:20px;padding:10px;color:#f1eff8;box-shadow:0 4px 0 #0005}
.bq-r .bq-L .bq-coin,.bq-r .bq-L .bq-mute{background:#2a2737;color:#fff}
.bq-r .bq-L .bq-mut,.bq-r .bq-L .bq-sc,.bq-r .bq-L .bq-gt{color:#c9c6d6}
.bq-r .bq-R{display:flex;flex-direction:column;gap:10px;min-width:0}
.bq-r .bq-top .t b{color:#f1eff8}
.bq-r .bq-arena{flex-direction:row;align-items:flex-end;background:#26233380;box-shadow:none}
.bq-r .bq-arena .bq-fig.me{width:34%}.bq-r .bq-arena .bq-fig.en{width:62%}.bq-r .bq-vs{display:none}
.bq-r .bq-arena .bq-fig.me .bq-img{height:calc(var(--bq-art) * .55)}.bq-r .bq-arena .bq-fig.me img{max-height:calc(var(--bq-art) * .55)}
.bq-r .bq-L .bq-top,.bq-r .bq-L .bq-info,.bq-r .bq-bar .bq-sc,.bq-r .bq-arena .bq-name,.bq-r .bq-arena .bq-gt{display:none}
.bq-r .bq-arena{flex:1;flex-wrap:wrap;align-items:center;align-content:space-between;padding:0 0 8px;overflow:hidden;border-radius:14px}
.bq-r .bq-bh{display:flex;justify-content:space-between;align-items:baseline;flex-basis:100%;font:800 16px var(--display);color:#fff;background:#2f7fd1;padding:6px 10px;margin-bottom:4px}.bq-r .bq-bh small{font:700 11px var(--ui);opacity:.9}.bq-r .bq-bh.r1{background:#d9822b}.bq-r .bq-bh.r2{background:#c0392b}
.bq-r .bq-tg{display:flex;justify-content:space-between;align-items:center;flex-basis:100%;margin:6px 8px 0;background:#0e0d14;border-radius:10px;padding:5px 10px;font-size:12px;color:#c9c6d6}.bq-r .bq-tg b{font:800 20px var(--display);color:#ff6b6b;margin-left:4px;flex:1}.bq-r .bq-tg span{color:#ffd23f;font-weight:800}
.bq-r .bq-rs{display:flex;align-items:center;gap:8px;background:#26233380;border-radius:12px;padding:6px 8px}.bq-r .bq-rs span{font-size:12px;line-height:1.1;font-weight:700;color:#c9c6d6;text-align:center}.bq-r .bq-rs b{flex:1;text-align:center;font:800 24px var(--display);background:#0e0d14;border-radius:10px;padding:3px 6px;color:#fff}
.bq-r .bq-hn{background:#26233380;border-radius:12px 12px 0 0;padding:6px 6px 0;margin-bottom:-8px}.bq-r .bq-bar.cm{background:#26233380;border-radius:0 0 12px 12px;padding:6px 6px 8px}
.bq-r .bq-hudg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.bq-hb{grid-row:span 2;border:0;border-radius:12px;color:#fff;font:800 16px/1.1 var(--display);cursor:pointer;box-shadow:0 3px 0 #0005;min-height:44px}.bq-hb.red{background:#e0475f}.bq-hb.orange{background:#e8901a;grid-row:span 1}
.bq-hx{background:#26233380;border:0;border-radius:10px;padding:4px 2px;text-align:center;display:flex;flex-direction:column;justify-content:center;color:#e8e6f0;font:inherit;min-width:0}.bq-hx small{font-size:11px;color:#c9c6d6;font-weight:700}.bq-hx b{font:800 19px var(--display)}.bq-hx.wide{grid-column:span 2}.bq-hx.coin b{color:#ffd23f;font-size:22px}button.bq-hx{cursor:pointer;text-decoration:underline dotted #c9c6d6}
.bq-r .bq-hn{display:block;text-align:center;font-size:15px}.bq-r .bq-hn b{font-family:var(--display);font-size:18px}
.bq-r .bq-bar.cm{flex-direction:column;align-items:stretch;gap:6px}.bq-r .bq-cm{justify-content:center}.bq-r .bq-cm b{font-size:24px;min-width:70px;padding:6px 12px}
.bq-r .bq-sc{margin:0;text-align:center;display:flex;justify-content:space-around;gap:6px;background:#26233380;border-radius:12px;padding:6px}.bq-r .bq-sc br{display:none}.bq-r .bq-sc b{color:#fff;display:block;font-size:16px}
.bq-r .bq-info{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}.bq-r .bq-info span,.bq-info .bq-sv{text-align:center;background:#26233380;color:#e8e6f0;border-radius:10px;padding:6px 4px;white-space:normal}
.bq-r .bq-slots{gap:10px}.bq-r button.bq-slot,.bq-r .bq-slot{min-height:96px;border-radius:12px;font-size:12px}.bq-r .bq-slot .ic{font-size:28px}
.bq-r .bq-prev{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;max-height:none;min-height:120px;background:#16141fb8;color:#f1eff8;border-radius:20px}
.bq-r .bq-prev .bq-pl,.bq-r .bq-prev .bq-last{color:#d9d6e6}.bq-r .bq-prev .bq-pl b,.bq-r .bq-prev .bq-last b{color:#ffd23f}.bq-r .bq-sel{justify-content:center;min-height:62px}.bq-r .bq-sel .bq-tile{width:52px;height:60px;font-size:28px}.bq-r .bq-prev .bq-chips{justify-content:center;max-width:100%}
.bq-r .bq-pile{display:flex}.bq-r .bq-hand.fan{padding-bottom:8px}.bq-r .bq-hand.fan .bq-tile{transform:translateY(var(--fy)) rotate(var(--fr))}.bq-r .bq-hand.fan .bq-tile.used{transform:translateY(calc(var(--fy) + 10px)) rotate(var(--fr))}.bq-r .bq-hand.fan .bq-tile.hit{transform:translateY(-10px) scale(1.08)}
.bq-r .bq-hand{grid-template-columns:repeat(var(--bq-n,8),minmax(0,68px));gap:8px}.bq-r .bq-hand .bq-tile{height:80px;font-size:34px}.bq-r .bq-hand .bq-tile small{font-size:13px}
.bq-r .bq-btns{max-width:640px;width:100%;align-self:center}.bq-r .bq-btn{min-height:54px;font-size:17px}
.bq-r .bq-kb{align-self:center}.bq-r .bq-arena .bq-gu{display:none}.bq-r>.bq-R>.bq-giveup{display:inline-block;align-self:flex-end;background:#e0475f;color:#fff;border-radius:999px;padding:6px 14px;font-weight:800;box-shadow:0 2px 0 #0004}
.bq-grid{grid-template-columns:repeat(4,minmax(0,1fr))}.bq-hands{grid-template-columns:repeat(3,minmax(0,1fr))}
}
@media(orientation:landscape) and (min-width:900px) and (min-height:540px){.bq-r{--hudw:300px;--bq-art:min(150px,18vh)}}
@media(orientation:landscape) and (min-width:1280px) and (min-height:860px){.bq-r{--hudw:340px;--bq-art:180px}.bq-r .bq-hand{grid-template-columns:repeat(var(--bq-n,8),minmax(0,84px))}.bq-r .bq-hand .bq-tile{height:98px;font-size:42px}.bq-r button.bq-slot,.bq-r .bq-slot{min-height:120px;font-size:14px}.bq-r .bq-slot .ic{font-size:34px}.bq-r .bq-sel .bq-tile{width:60px;height:70px;font-size:32px}.bq-r .bq-btn{min-height:62px;font-size:19px}}
@media(orientation:landscape) and (max-height:539.98px) and (min-width:560px){
.bq{padding-bottom:6px}.bq>h2:first-child,.bq-top{padding-left:42px}.bq-r .bq-top{padding-left:40px}
.bq-r{--hudw:224px;--bq-art:38px;gap:6px 10px;min-height:calc(100dvh - 24px)}.bq-r .bq-top .bq-speed{display:none}.bq-r .bq-top{flex-wrap:wrap;justify-content:flex-end}.bq-r .bq-top .t{order:2;flex-basis:100%;margin-left:-40px}.bq-r .bq-top .t b{white-space:nowrap}
.bq-r .bq-L{gap:5px;padding:6px;border-radius:14px}.bq-r .bq-top{gap:4px}.bq-r .bq-top .t b{font-size:11px}.bq-r .bq-speed,.bq-r .bq-mute{height:24px;width:auto;padding:0 6px;font-size:11px}.bq-r .bq-coin{font-size:12px;padding:2px 6px}
.bq-r .bq-arena{padding:4px 6px}.bq-r .bq-name{font-size:10px}.bq-r .bq-gt{font-size:10px}.bq-r .bq-goal{height:7px}
.bq-r .bq-boss{font-size:9.5px;padding:3px 6px;line-height:1.15}.bq-r .bq-bh{font-size:12px;padding:3px 6px 3px 42px;margin-bottom:2px}.bq-r .bq-bh small{font-size:9px}.bq-r .bq-tg{margin:3px 4px 0;padding:2px 6px;font-size:10px}.bq-r .bq-tg b{font-size:14px}.bq-r .bq-arena{padding-bottom:4px}.bq-r .bq-rs{padding:3px 6px}.bq-r .bq-rs span{font-size:9px}.bq-r .bq-rs b{font-size:15px;padding:1px 4px}.bq-r .bq-hn{padding:3px 4px 0;margin-bottom:-5px}.bq-r .bq-bar.cm{padding:3px 4px 4px}.bq-r .bq-hudg{gap:3px}.bq-hb{font-size:11px;min-height:28px;border-radius:8px}.bq-hx{padding:1px}.bq-hx small{font-size:8.5px}.bq-hx b{font-size:12px}.bq-hx.coin b{font-size:13px}
.bq-r .bq-hn{font-size:11px}.bq-r .bq-hn b{font-size:13px}.bq-r .bq-cm b{font-size:15px;min-width:44px;padding:2px 6px}.bq-r .bq-sc{font-size:10px;padding:3px}.bq-r .bq-sc b{font-size:12px}
.bq-r .bq-info{gap:3px}.bq-r .bq-info span,.bq-info .bq-sv{font-size:9.5px;padding:3px 2px}
.bq-r .bq-R{gap:5px}.bq-r .bq-slots{gap:5px}.bq-r button.bq-slot,.bq-r .bq-slot{min-height:40px;font-size:9px;border-radius:8px}.bq-r .bq-slot .ic{font-size:15px}
.bq-r .bq-prev{min-height:58px;padding:4px 8px;border-radius:14px}.bq-r .bq-sel{min-height:32px;margin-bottom:2px}.bq-r .bq-sel .bq-tile{width:28px;height:32px;font-size:16px}.bq-r .bq-pl{font-size:11px}.bq-r .bq-pl b{font-size:13px}.bq-r .bq-chip{font-size:10px}
.bq-r .bq-msg{min-height:12px;font-size:11px;line-height:12px}
.bq-r .bq-hand{grid-template-columns:repeat(var(--bq-n,8),minmax(0,42px));gap:4px}.bq-r .bq-hand .bq-tile{height:44px;font-size:21px}.bq-r .bq-hand .bq-tile small{font-size:9px}
.bq-r .bq-pile{width:38px;height:46px}.bq-r .bq-pile b{font-size:14px}.bq-r .bq-pile small{font-size:8px}
.bq-r .bq-btn{min-height:34px;font-size:13px}.bq-r .bq-giveup{font-size:10px;padding:0}.bq-r .bq-kb{display:none}
.bq-intro{min-height:calc(100dvh - 30px);gap:8px}.bq-hero .bq-logo{max-height:46vh}.bq-mb{min-height:44px;font-size:17px}.bq-mbox.side .bq-mb{min-height:18px;font-size:12px}
}
@media(prefers-reduced-motion:reduce){.bq-atk,.bq-ehit,.bq-dead,.bq-dmg,.bq-say,.bq-pop,.bq-shake{animation:none}}`;

  /* ---------- persistence ---------- */
  function save() {
    if (!G || modal || G.tut) return;   // the tutorial run is never stored, so it cannot overwrite a saved run
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
    G.handLv = G.handLv || { o: 1, n: 1, v: 1, a: 1, r: 1 }; G.unlocked = G.unlocked || []; G.labels = G.labels || [];
    if (!G.fx) { G.fx = {}; G.fabrics.forEach(id => { G.fx[id] = { ed: null, paid: 0, v: 0 }; }); } G.newAch = G.newAch || []; G.deck = G.deck || 'base';
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
    const KEYM = 'wr_game_music';
    // calm: C, Am, F, G at 84 bpm. boss (owner 25 Nov: tenser): A minor, Am F E Am at 120 bpm, a pulsing bass on every eighth note
    const MODES = {
      calm: { step: 60 / 84 / 2, chords: [[60, 64, 67], [57, 60, 64], [53, 57, 60], [55, 59, 62]],
        mel: [72, null, 76, 74, null, 72, 69, null, 72, null, 69, 67, null, 64, 67, null, 69, null, 72, 69, null, 65, 67, null, 67, null, 71, 74, null, 72, null, null] },
      boss: { step: 60 / 120 / 2, chords: [[57, 60, 64], [53, 57, 60], [52, 56, 59], [57, 60, 64]],
        mel: [69, null, 72, null, 71, 69, 68, null, 69, null, 72, 76, null, 75, 76, null, 77, null, 76, 74, null, 72, 71, null, 68, null, 71, null, 74, 71, 68, null] }
    };
    let timer = null, step = 0, next = 0, on = store.get(KEYM) !== '0', cur = 'calm';
    function tick() {
      const M = MODES[cur];
      while (next < ac.currentTime + 0.25) {
        const ch = M.chords[Math.floor(step / 8) % 4], i = step % 8, mel = M.mel[step % 32];
        if (cur === 'boss') {
          tone(musicOut, hz(ch[0] - 24), next, M.step * 0.8, 'sawtooth', 0.22);   // pulsing bass
          if (i % 2 === 0) tone(musicOut, hz(ch[[0, 1, 2, 1][(i / 2) % 4]] + 12), next, M.step * 1.2, 'triangle', 0.12);
          if (i === 0 || i === 4) noise(musicOut, next, 0.08, 0.25, 3000, 1500);   // a soft tick on the beat
        } else {
          if (i === 0) tone(musicOut, hz(ch[0] - 24), next, M.step * 7, 'triangle', 0.5);
          tone(musicOut, hz(ch[[0, 1, 2, 1][i % 4]] + (i >= 4 ? 12 : 0)), next, M.step * 1.6, 'sine', 0.16);
        }
        if (mel) tone(musicOut, hz(mel), next, M.step * 2.4, cur === 'boss' ? 'square' : 'sine', cur === 'boss' ? 0.07 : 0.22);
        next += M.step; step++;
      }
    }
    function start() {
      if (!on || timer) return;
      try { if (!audio()) return; ac.resume(); next = ac.currentTime + 0.1; timer = setInterval(tick, 60); tick(); } catch (e) { timer = null; /* no audio: play silently */ }
    }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    function toggle() { on = !on; store.set(KEYM, on ? '1' : '0'); if (on) start(); else stop(); }
    // switch calm <-> boss with a short fade, restarting the bar
    function mode(m) {
      if (m === cur || !MODES[m]) return;
      cur = m; step = 0;
      if (!timer || !ac) return;
      try { const g = musicOut.gain, t = ac.currentTime; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0.0001, t + 0.25); g.linearRampToValueAtTime(0.09, t + 0.9); next = t + 0.3; } catch (e) { /* keep playing */ }
    }
    return { start, stop, toggle, mode, get on() { return on; }, get playing() { return !!timer; }, get current() { return cur; } };
  })();
  /* moving background behind the Quest screens (owner 25 Nov): Gelombang kain (open), Anyaman and Benang (achievements), or off.
     One colour set per stage, dark red for a boss; still when the device asks for less motion; paused when the screen is hidden. */
  const Bg = (function () {
    const KEYB = 'wr_game_bg';
    const DARK = [['#26215C', '#3C3489', '#534AB7', '#7F77DD'], ['#04342C', '#085041', '#0F6E56', '#1D9E75'], ['#042C53', '#0C447C', '#185FA5', '#378ADD'], ['#4A1B0C', '#712B13', '#993C1D', '#D85A30'],
      ['#4B1528', '#72243E', '#993556', '#D4537E'], ['#173404', '#27500A', '#3B6D11', '#639922'], ['#412402', '#633806', '#854F0B', '#BA7517'], ['#2C2C2A', '#444441', '#5F5E5A', '#888780']];
    const LIGHT = [['#EEEDFE', '#CECBF6', '#AFA9EC', '#7F77DD'], ['#E1F5EE', '#9FE1CB', '#5DCAA5', '#1D9E75'], ['#E6F1FB', '#B5D4F4', '#85B7EB', '#378ADD'], ['#FAECE7', '#F5C4B3', '#F0997B', '#D85A30'],
      ['#FBEAF0', '#F4C0D1', '#ED93B1', '#D4537E'], ['#EAF3DE', '#C0DD97', '#97C459', '#639922'], ['#FAEEDA', '#FAC775', '#EF9F27', '#BA7517'], ['#F1EFE8', '#D3D1C7', '#B4B2A9', '#888780']];
    const BOSSD = ['#2C0B0B', '#501313', '#791F1F', '#A32D2D'], BOSSL = ['#FCEBEB', '#F7C1C1', '#F09595', '#E24B4A'];
    let cv = null, cx = null, raf = 0, t = 0, last = 0, style = 'wave', pal = 0, boss = false;
    const choice = () => store.get(KEYB) || 'wave';
    const still = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
    function light() { const c = (getComputedStyle(document.body).backgroundColor.match(/\d+/g) || [0, 0, 0]).map(Number); return c[0] + c[1] + c[2] > 382; }
    function size() { if (!cv) return; const d = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(innerWidth * d); cv.height = Math.round(innerHeight * d); cx.setTransform(d, 0, 0, d, 0, 0); if (style !== 'off') draw(); }
    function ensure() {
      if (cv) return;
      cv = document.createElement('canvas'); cv.className = 'bq-bgc'; cv.setAttribute('aria-hidden', 'true'); root.insertBefore(cv, root.firstChild);
      cx = cv.getContext('2d'); root.classList.add('bq-host'); window.addEventListener('resize', size); size();
    }
    function draw() {
      if (!cx) return;
      const W = innerWidth, H = innerHeight, p = boss ? (light() ? BOSSL : BOSSD) : (light() ? LIGHT : DARK)[pal % 8];
      cx.globalAlpha = 1; cx.fillStyle = p[0]; cx.fillRect(0, 0, W, H);
      if (style === 'wave') {
        for (let b = 0; b < 7; b++) { cx.fillStyle = p[1 + (b % 3)]; cx.globalAlpha = 0.5; cx.beginPath(); const base = H * (b / 6) - 20; cx.moveTo(0, H);
          for (let i = 0; i <= W; i += 10) cx.lineTo(i, base + Math.sin(i / 110 + t * 0.5 + b * 1.3) * 30 + Math.sin(i / 43 - t * 0.35 + b) * 10);
          cx.lineTo(W, H); cx.closePath(); cx.fill(); }
      } else if (style === 'weave') {
        const sz = 26, o = (t * 7) % (sz * 2);
        for (let y = -sz * 2; y < H + sz * 2; y += sz) for (let x = -sz * 2; x < W + sz * 2; x += sz) {
          const k = ((x + y) / sz) & 1; cx.fillStyle = k ? p[1] : p[2]; cx.globalAlpha = 0.6;
          if (k) cx.fillRect(x + o + 2, y + o + 7, sz - 4, sz - 14); else cx.fillRect(x + o + 7, y + o + 2, sz - 14, sz - 4); }
      } else {
        for (let b = 0; b < 7; b++) { const y0 = H * (b + 0.5) / 7;
          cx.beginPath(); cx.moveTo(-20, y0); cx.bezierCurveTo(W * 0.3, y0 + Math.sin(t * 0.45 + b) * 60, W * 0.6, y0 - Math.cos(t * 0.35 + b) * 60, W + 20, y0 + Math.sin(t * 0.3 + b * 2) * 24);
          cx.globalAlpha = 0.8; cx.lineWidth = 3; cx.strokeStyle = p[1 + (b % 3)]; cx.setLineDash([]); cx.stroke();
          cx.globalAlpha = 0.5; cx.lineWidth = 1.5; cx.strokeStyle = p[3]; cx.setLineDash([7, 9]); cx.stroke(); }
        cx.setLineDash([]);
      }
      cx.globalAlpha = 1;
    }
    const running = () => style !== 'off' && !still() && !root.hidden && !document.hidden;
    function frame(ts) {
      raf = 0; if (!running()) return;
      if (ts - last >= 33) { t += Math.min(0.1, (ts - last) / 1000); last = ts; draw(); }
      raf = requestAnimationFrame(frame);
    }
    function update(stage, isBoss) {
      ensure();
      const c = choice(), open = E.opened(achOwned).bgs;
      style = c === 'off' ? 'off' : open.includes(c) ? c : 'wave'; pal = stage || 0; boss = !!isBoss;
      cv.hidden = style === 'off'; root.classList.toggle('bq-bgon', style !== 'off');
      if (style === 'off') return;
      draw();
      if (running() && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
    }
    function set(v) { store.set(KEYB, v); }
    function wake() { if (cv && running() && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); } }
    return { update, set, wake, get choice() { return choice(); }, get style() { return style; } };
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
  const RND = ['Ronde Kecil', 'Ronde Besar', 'Boss'];
  const stageTxt = () => 'Stage ' + (G.stage + 1) + (G.stage + 1 > E.CFG.stages ? ' · Endless' : '/' + E.CFG.stages);
  const label = () => stageTxt() + ' · ' + RND[G.rnd];
  const isBoss = () => G.rnd === 2;
  function chipsOf(s) {
    let h = s.hand ? handChip(s.hand) : '';
    (s.steps || []).forEach(x => {
      if (x.slot) h += `<span class="bq-chip ${x.x ? 'j' : x.m ? 'm' : 'a'}">${F(x.slot).icon}${x.src && x.src !== x.slot ? '→' + F(x.src).icon : ''} ${x.label}</span>`;
      else if (x.tile !== undefined && x.label) h += `<span class="bq-chip ${x.x ? 'j' : x.m ? 'm' : 'a'}">${x.label}</span>`;
      else if (x.held) h += `<span class="bq-chip j">🔩 ${x.label}</span>`;
      else if (x.lemari) h += `<span class="bq-chip m">${x.label}</span>`;
      else if (x.boss) h += `<span class="bq-chip j">${x.label}</span>`;
    });
    if (s.jackpot === false) h += '<span class="bq-chip">🎰 tidak kena</span>';
    return h;
  }

  const tileHtml = (t, cls, attrs) => { const k = E.kindOf(t.ch), face = k === 'wild' ? (t.as || '?') : t.ch;
    return `<button type="button" class="bq-tile ${t.up || ''} ${k === 'wild' ? 'wild' : k !== 'letter' ? 'multi m' + Math.min(t.ch.length, 4) : ''} ${cls || ''}" ${attrs || ''}>${k === 'wild' && t.as ? '<i>?</i>' : ''}${face}<small>${k === 'wild' && !t.as ? '½' : E.val(t)}</small></button>`; };
  const fmt = n => String(n).replace('.', ',');
  const handChip = h => `<span class="bq-chip h">${h.icon} ${h.name} Lv${h.lv} · ${h.chips} × ${h.mult}</span>`;
  const KINDTAG = { chips: '<span class="bq-k c">+Chips</span>', add: '<span class="bq-k m">+Mult</span>', x: '<span class="bq-k x">×Mult</span>', util: '<span class="bq-k">Utilitas</span>', eco: '<span class="bq-k">Koin</span>', rt: '<span class="bq-k u">Ulang</span>', copy: '<span class="bq-k u">Salin</span>' };
  // rarity (knit colour) and edition on any Fabric card (owner 26 Nov)
  const fabCls = (id, ed) => 'bq-fab rr' + (F(id).r || 1) + (ed ? ' ed-' + ed : '');
  const rarTag = id => `<span class="bq-rar">${E.RAR[F(id).r || 1].n}</span>`;
  const edTag = ed => ed ? `<span class="bq-edt">${E.ED[ed].icon} ${E.ED[ed].n} · ${E.ED[ed].d}</span>` : '';
  const fabVal = id => { const v = G && G.fx && G.fx[id] ? G.fx[id].v : 0; return v && ['rapi', 'gunting', 'pitaukur', 'tumbuh', 'kainbaru'].includes(id) ? ` <b style="display:inline">Sekarang: ${['pitaukur', 'tumbuh', 'kainbaru'].includes(id) ? '+' + v + ' Chips' : '+' + v + ' Mult'}</b>` : ''; };
  const fabricCard = (id, tag, ed) => { const f = F(id); return `<span class="ic">${f.icon}</span><b>${f.name}</b> ${KINDTAG[f.kind] || ''}${rarTag(id)}${tag || ''}${edTag(ed)}<span class="d">${f.desc}${fabVal(id)}</span>`; };
  function optHtml(o) {
    const U = o.ch ? o.ch.toUpperCase() : '';
    if (o.type === 'fabric') return fabricCard(o.id, '', o.ed);
    if (o.type === 'label') { const l = E.LABEL[o.id]; return `<span class="ic">${l.icon}</span><b>Label ${l.name}</b><span class="d">${l.desc} Permanen sampai run selesai.</span>`; }
    if (o.type === 'up') { const u = E.UPS[o.kind]; return `<span class="ic">${u.icon}</span><b>${u.name} · huruf ${U}</b><span class="d">${u.desc} Permanen: masuk supply tiap ronde sampai run selesai.</span>`; }
    if (o.type === 'letter') return `<span class="ic">🔤</span><b>Huruf ${U}</b><span class="d">Satu huruf ${U} ditambahkan ke supply di semua ronde berikutnya.</span>`;
    if (o.type === 'book') { const h = E.HANDS[o.pos], now = E.handInfo(o.pos, E.lvOf(G, o.pos)), nx = E.handInfo(o.pos, now.lv + E.bookStep(G));
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
    const n = Math.max(E.slotsOf(G), G.fabrics.length), weak = R && R.boss && !R.boss.off && !R.cleared && (phase === 'round' || phase === 'bosspre') ? R.boss.fab : null;
    let h = `<div class="bq-slots" style="--ns:${n}">`;
    for (let i = 0; i < n; i++) { const id = G.fabrics[i], ed = id && E.edOf(G, id);
      h += id ? `<button type="button" class="bq-slot k-${F(id).kind} ${fabCls(id, ed)}${id === weak ? ' weak' : ''}" data-a="showFab" data-i="${id}">${ed ? `<span class="edb">${E.ED[ed].icon}</span>` : ''}${id === weak ? '<span class="weak">✂️</span>' : ''}<span class="ic">${F(id).icon}</span>${F(id).name}</button>` : '<div class="bq-slot">kosong</div>'; }
    return h + '</div>';
  }
  // Si Pemotong Benang has no art yet: it borrows The Short Cutter's picture until the owner adds boss-cutter.webp
  const bossImg = id => 'img/game/boss-' + (id === 'cutter' ? 'short' : id) + '.webp';
  function enemyInfo() {
    if (R.boss) return { img: bossImg(R.boss.id), n: R.boss.name };
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
    return `<div class="bq-arena">${phase === 'round' && !R.cleared ? '<button type="button" class="bq-gu" data-a="giveUp">🏳️ Akhiri run</button>' : ''}<div class="bq-bh r${G.rnd}">${R.boss ? '👑 ' : ''}${en.n}<small>${RND[G.rnd]}</small></div>${say}${f ? `<div class="bq-dmg">+${fmtN(f.dmg)}</div>` : ''}
      <div class="bq-fig me"><div class="bq-img ${f ? 'bq-atk' : ''}"><img src="img/game/bibo-${pose()}.webp" alt="Bibo"></div><div class="bq-name">Bibo</div></div><div class="bq-vs">VS</div>
      <div class="bq-fig en"><div class="bq-img ${f ? 'bq-ehit' : ''} ${R.cleared && !anim ? 'bq-dead' : ''}">${art}</div><div class="bq-goal ${over ? 'over' : ''}"><i style="width:${pct}%"></i></div><div class="bq-name">${en.n}</div><div class="bq-gt">${fmtN(sc)} / ${fmtN(R.target)}${over ? ' 🔥' : ''}</div></div><div class="bq-tg">Capai <b>${fmtN(R.target)}</b><span>Hadiah 🪙 +${E.CFG.coinRound + G.stage}</span></div></div>`;
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
      cm = { c: 0, m: 0, h: anim.res.hand };
      pv = `<div class="bq-pl"><b>${anim.res.word.toUpperCase()}</b> · menghitung… <span class="bq-mut">(ketuk untuk lewati)</span></div>`;
    } else if (sel.length) {
      const w = sel.map(E.txt).join('');
      if (w.length >= 3 && E.isWord(w)) {
        const ids = new Set(sel.map(t => t.id)), s = E.score(sel, G.fabrics, E.ctxFor(G, R, R.hand.filter(t => !ids.has(t.id)), { inLemari: inLemari(w), fx: E.grownFx(G, R, sel) }), R.boss, () => 0.5);
        cm = { c: s.chips, m: s.mult, t: s.final, h: s.hand };
        pv = `<div class="bq-pl"><button type="button" class="bq-arti" data-a="artiSel">📖 Arti</button><b>${w.toUpperCase()}</b> → <b>${fmtN(s.final)}</b> poin</div><div class="bq-chips">${chipsOf(Object.assign({}, s, { jackpot: undefined }))}${G.fabrics.includes('jackpot') ? '<span class="bq-chip">🎰 bisa ×2</span>' : ''}${G.fabrics.includes('kusut') ? '<span class="bq-chip">🌀 Mult acak</span>' : ''}</div>`;
      } else pv = `<div class="bq-pl">${w.length < 3 ? 'Pilih minimal 3 huruf untuk kata, atau langsung Buang' : '<b>' + w.toUpperCase() + '</b> belum jadi kata valid (boleh Buang huruf ini)'}</div>`;
    } else pv = R.noWord ? '<div class="bq-pl" style="color:var(--error)"><b>Tidak ada kata</b> dari huruf di tanganmu. Pilih huruf lalu Buang untuk mengambil huruf baru dari supply.</div>' : '<div class="bq-pl">Ketuk huruf: susun kata untuk menyerang, atau buang huruf yang tidak berguna.</div>';
    const selIds = new Set(sel.map(t => t.id));
    const hud = `<div class="bq-rs"><span>Skor<br>ronde</span><b>${fmtN(shown)}</b></div>`;
    const head = `<div class="bq-top"><div class="t"><b>${label()}</b></div><button type="button" class="bq-mute" data-a="runInfo" aria-label="Info run">ℹ️</button><button type="button" class="bq-mute" data-a="opts" aria-label="Opsi">⚙️</button><span class="bq-coin">🪙 ${G.coins}</span></div>${arenaHtml()}
      ${R.boss ? `<div class="bq-boss"><b>${R.boss.name}:</b> ${R.boss.off ? 'aturan dimatikan Gunting Emas ✂️' : R.boss.desc}${R.boss.block ? ' Terkunci: <b>' + R.boss.block.toUpperCase() + '</b>' : ''}${R.boss.fab ? ' Lemah: <b>' + F(R.boss.fab).name + '</b>' : ''}</div>` : ''}${hud}<div class="bq-hn">${cm && cm.h ? `${cm.h.icon} <b>${cm.h.name}</b> Lv${cm.h.lv}` : '<span class="bq-mut">Susun kata…</span>'}</div>${cmHtml(cm, shown)}`;
    const lastHtml = last && last.res ? `<div class="bq-last bq-pop">Terakhir: <b>${last.res.word.toUpperCase()} +${fmtN(last.res.final)}</b> <button type="button" class="bq-arti" data-a="arti" data-i="${last.res.word}">📖 Arti</button> <span class="bq-mut"></span>${last.res.recycled ? ` ♻️ ${last.res.recycled.toUpperCase()}` : ''}${last.res.extraDraw ? ' 🔄 +1' : ''}${last.res.coins ? ` 🟡 +${last.res.coins} koin` : ''}${last.res.book ? ' 📚 Adverb naik level' : ''}${last.res.copied ? ` 🖨️ ${last.res.copied.toUpperCase()} disalin` : ''}${last.res.destroyed ? ` 🆕 ${F(last.res.destroyed).name} habis` : ''}<div class="bq-chips">${chipsOf(last.res)}</div></div>` : '';
    if (!sel.length && lastHtml && !anim) pv = lastHtml;
    if (R.cleared && !anim) return '<div class="bq-L">' + head + '</div><div class="bq-R">' + `<div class="bq-center bq-pop"><h2>${enemyInfo().n} kalah! 🎉</h2><div class="bq-mut">+${last.fin.coins} koin${last.fin.saver ? ` (+${last.fin.saver} Saver)` : ''}${last.fin.steady ? ` (+${last.fin.steady} Steady)` : ''}${last.fin.piggy ? ` (+${last.fin.piggy} Celengan Bibo)` : ''}${last.fin.interest ? ` (+${last.fin.interest} bunga)` : ''}</div><button type="button" class="bq-btn pri" style="width:100%;margin-top:10px" data-a="goNext">Ambil hadiah</button></div></div>`;
    const hudg = `<div class="bq-hudg"><button type="button" class="bq-hb red" data-a="runInfo">Info<br>run</button>
      <button type="button" class="bq-hx" data-a="supplyView"><small>Supply</small><b>${R.supply.length}</b></button><div class="bq-hx"><small>Buang</small><b>${R.discards}/${R.maxDiscards}</b></div>
      <div class="bq-hx wide coin"><b>🪙 ${G.coins}</b></div>
      <button type="button" class="bq-hb orange" data-a="opts">Opsi</button><div class="bq-hx"><small>Stage</small><b>${G.stage + 1}${G.stage + 1 > E.CFG.stages ? '' : '/' + E.CFG.stages}</b></div><div class="bq-hx"><small>Ronde</small><b>${G.rnd + 1}/3</b></div></div>`;
    const info = `<div class="bq-info"><button type="button" class="bq-sv" data-a="supplyView" aria-label="Lihat sisa supply">📦 Supply ${R.supply.length} ›</button><span>🗑️ Buang ${R.discards}/${R.maxDiscards}</span><span>📝 ${R.words} kata</span>${R.chain > 0 && G.fabrics.includes('chain') ? `<span>⛓️ chain ${R.chain}</span>` : ''}</div>`;
    return '<div class="bq-L">' + head + info + hudg + '</div><div class="bq-R">' + slotsHtml() + `
      <div class="bq-prev"><div class="bq-sel">${(anim ? anim.tiles : sel).map((t, i, a) => { const k = E.kindOf(t.ch), af = (k === 'pre' && i === 0) || (k === 'suf' && i === a.length - 1);
        return tileHtml(t, '', anim ? '' : `data-a="unsel" data-i="${i}"`).replace('</button>', af ? '<i class="af">+3</i></button>' : '</button>'); }).join('')}</div>${pv}</div>
      <div class="bq-msg" role="status">${msg}</div>
      <div class="bq-handrow"><div class="bq-hand ${R.hand.length <= 9 ? 'fan' : ''}" style="--bq-n:${R.handSize <= 9 ? R.handSize : Math.ceil(R.handSize / 2)}">${R.hand.map((t, i, a) => { const lk = E.blocked(R, t), us = selIds.has(t.id), off = i - (a.length - 1) / 2;
        return tileHtml(t, lk ? 'lock' : us ? 'used' : '', (lk ? 'disabled' : `data-a="pick" data-i="${t.id}"`) + ` style="--fr:${(off * 2.4).toFixed(1)}deg;--fy:${(off * off * 0.9).toFixed(1)}px"`); }).join('')}</div><button type="button" class="bq-pile" data-a="supplyView" aria-label="Lihat sisa supply: ${R.supply.length} huruf"><b>${R.supply.length}</b><small>supply</small></button></div>
      <div class="bq-btns"><button type="button" class="bq-btn" data-a="clr" ${sel.length ? '' : 'disabled'}>Hapus</button><button type="button" class="bq-btn mint" data-a="discard" ${sel.length && E.canDiscard(R) ? '' : 'disabled'}>🗑️ Buang${sel.length ? ' ' + sel.length : ''}</button><button type="button" class="bq-btn pri" data-a="send" ${sel.length >= 3 ? '' : 'disabled'}>⚔️ Serang</button></div>
      <button type="button" class="bq-giveup" data-a="giveUp">🏳️ Akhiri run</button>
      <div class="bq-mut bq-kb">Di laptop: ketik huruf untuk memilih, Backspace menghapus, Enter menyerang.</div></div>`;
  }
  // the Quest title screen (owner 25 Nov, after Balatro's menu): big title over the moving background, a menu bar below
  function introHtml() {
    const saved = load(), resumable = saved && saved.phase !== 'end', wins = achTotals.wins || 0;
    return `<div class="bq-intro">
      <div class="bq-title bq-hero"><img class="bq-logo" src="img/game/quest-logo.webp" width="900" height="481" alt="Wordrobe Quest"><span class="bq-sr">Wordrobe QUEST</span></div>
      <div class="bq-menu">
        <div class="bq-mbox rec"><small>Rekor</small><b>${best ? 'Stage ' + Math.min(best, E.CFG.stages) : '-'}</b>${wins ? `<small>Menang ${wins}×</small>` : ''}${endlessBest() ? `<small>Endless: Stage ${endlessBest()}</small>` : ''}</div>
        <div class="bq-mbox main">${resumable ? '<button type="button" class="bq-mb blue" data-a="resume">LANJUTKAN</button>' : '<button type="button" class="bq-mb blue" data-a="start">MAIN</button>'}<button type="button" class="bq-mb green" data-a="coll">KOLEKSI</button></div>
        <div class="bq-mbox side"><button type="button" class="bq-mb orange" data-a="opts">OPSI</button><button type="button" class="bq-mb red" data-go="home">KELUAR</button></div>
      </div>
      ${resumable ? '<button type="button" class="bq-pill" data-a="start">Mulai run baru</button>' : ''}
      <div class="bq-pills"><button type="button" class="bq-pill" data-a="tutorial">🎓 Tutorial</button><button type="button" class="bq-pill bq-orient" data-a="orient">${matchMedia('(orientation: landscape)').matches ? '📱 Tegak' : '↔️ Mendatar'}</button><button type="button" class="bq-pill" data-a="achList">🏆 Achievement ${E.ACH.filter(a => E.hasAch(achOwned, a.id)).length}/${E.ACH.length}</button></div></div>`;
  }
  // Koleksi: every background, Kain and Fabric, with what opens the locked ones
  function collHtml() {
    const o = E.opened(achOwned), bg = Bg.choice, by = w => { const a = E.ACH.find(x => x.open[0] === w[0] && x.open[1] === w[1] || (x.also && x.also[0] === w[0] && x.also[1] === w[1])); return a ? a.name + ': ' + a.desc : ''; };
    const bgs = E.BGS.map(b => { const ok = o.bgs.includes(b.id), on = bg === b.id || (bg !== 'off' && !o.bgs.includes(bg) && b.id === 'wave');
      return `<div class="bq-ci ${ok ? '' : 'lock'}"><span class="ic">${ok ? b.icon : '🔒'}</span><b>${b.name}</b><span class="d">${ok ? (on ? 'Sedang dipakai' : 'Terbuka') : by(['bg', b.id])}</span>${ok && !on ? `<button type="button" class="bq-btn sm" data-a="setBg" data-i="${b.id}">Pakai</button>` : ''}</div>`; }).join('');
    const decks = E.DECKS.map(d => { const ok = o.decks.includes(d.id); return `<div class="bq-ci ${ok ? '' : 'lock'}"><span class="ic">${ok ? d.icon : '🔒'}</span><b>${d.name}</b><span class="d">${ok ? d.desc : by(['deck', d.id])}</span></div>`; }).join('');
    const fabs = E.FABRICS.slice().sort((a, b) => (a.r || 1) - (b.r || 1)).map(f => { const ok = !f.locked || o.fabrics.includes(f.id); return `<div class="bq-ci ${ok ? fabCls(f.id) : 'lock'}"><span class="ic">${ok ? f.icon : '🔒'}</span><b>${f.name} ${KINDTAG[f.kind] || ''}${rarTag(f.id)}</b><span class="d">${ok ? f.desc : by(['fabric', f.id])}</span></div>`; }).join('');
    const seenEd = edSeen(), eds = Object.keys(E.ED).map(k => { const e = E.ED[k], ok = seenEd.includes(k);
      return `<div class="bq-ci ${ok ? 'bq-fab rr1 ed-' + k : 'lock'}"><span class="ic">${ok ? e.icon : '❔'}</span><b>${ok ? e.n : '???'}</b><span class="d">${ok ? e.d + '. Muncul acak pada Fabric di shop dan hadiah.' : 'Belum ditemukan. Cari Fabric berkilau di shop.'}</span></div>`; }).join('');
    const labs = E.LABELS.map(l => `<div class="bq-ci"><span class="ic">${l.icon}</span><b>${l.name}</b><span class="d">${l.desc}</span></div>`).join('');
    return `<div class="bq-top"><h2 style="flex:1">Koleksi</h2><button type="button" class="bq-btn sm" data-a="achBack">Kembali</button></div>
      <div class="bq-sec"><b>Latar</b><button type="button" class="bq-btn sm" data-a="setBg" data-i="off" ${bg === 'off' ? 'disabled' : ''}>${bg === 'off' ? 'Latar mati' : 'Matikan latar'}</button></div><div class="bq-cgrid">${bgs}</div>
      <div class="bq-sec"><b>Kain</b></div><div class="bq-cgrid">${decks}</div>
      <div class="bq-sec"><b>Fabric</b><span class="bq-mut">Umum · Langka · Epik · Legendaris</span></div><div class="bq-cgrid">${fabs}</div>
      <div class="bq-sec"><b>Edisi</b></div><div class="bq-cgrid">${eds}</div>
      <div class="bq-sec"><b>Label</b><span class="bq-mut">dijual 1 per shop</span></div><div class="bq-cgrid">${labs}</div>
      <button type="button" class="bq-btn" data-a="achList">🏆 Achievement (${E.ACH.filter(a => E.hasAch(achOwned, a.id)).length}/${E.ACH.length})</button>`;
  }
  function achHtml() {
    return `<div class="bq-top"><h2 style="flex:1">🏆 Achievement</h2><button type="button" class="bq-btn sm" data-a="achBack">Kembali</button></div>
      <div class="bq-mut">Tersimpan di akunmu. Tiap achievement membuka Kain (dek awal), Fabric, atau Latar baru.</div>
      ${E.ACH.map(a => { const got = E.hasAch(achOwned, a.id), have = Math.min(a.need || 0, achTotals[a.total] || 0);
        const prog = !got && a.total ? `<div class="bq-hp" style="margin-top:4px"><i style="width:${have / a.need * 100}%;background:var(--mint)"></i></div><div class="bq-mut" style="font-size:12px">${have}/${a.need}</div>` : '';
        return `<div class="bq-ach ${got ? '' : 'lock'}"><span class="ic">${got ? '🏆' : '🔒'}</span><div style="flex:1"><b>${a.name}</b><span class="bq-mut">${a.desc}</span><div style="font-size:13px">Membuka ${[a.open].concat(a.also ? [a.also] : []).map(w => openKind(w) + ': ' + openObj(w).icon + ' <b style="display:inline">' + openObj(w).name + '</b>').join(' · ')}</div>${prog}</div></div>`; }).join('')}
      <div class="bq-mut">Hitungan total bertambah saat run selesai (kalah atau Akhiri run).</div>`;
  }
  function toast(text) {
    let el = document.getElementById('bq-toast');
    if (!el) { el = document.createElement('div'); el.id = 'bq-toast'; el.className = 'bq-toast'; el.setAttribute('role', 'status'); document.body.appendChild(el); }
    el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200);
  }
  // new achievements of this run: shown at once, opened Fabrics join the pool at once, saved to the account with the run
  function checkAch() {
    if (!G || G.tut) return;
    G.newAch = G.newAch || [];
    const fresh = E.earned(G).filter(id => !E.hasAch(achOwned, id) && !G.newAch.includes(id));
    fresh.forEach(id => {
      const a = E.ACH.find(x => x.id === id); G.newAch.push(id);
      [a.open].concat(a.also ? [a.also] : []).forEach(w => { if (w[0] === 'fabric' && !G.unlocked.includes(w[1])) G.unlocked.push(w[1]); });
    });
    if (fresh.length) toast('🏆 ' + fresh.map(achText).join(' · '));
    if (fresh.length) {
      Sfx.play('unlock');
      if (host.claim) host.claim(fresh).then(r => { if (r && r.achievements) setAch(r.achievements, r.totals); }, () => { /* kept in G.newAch: sent again with the run */ });
    }
  }
  const EDKEY = 'wr_game_eds';
  const edSeen = () => { try { return JSON.parse(store.get(EDKEY) || '[]'); } catch (e) { return []; } };
  const edFound = ed => { if (ed && !edSeen().includes(ed)) store.set(EDKEY, JSON.stringify(edSeen().concat(ed))); };
  const inLemari = w => { try { return !!(host.lemariHas && host.lemariHas(w)); } catch (e) { return false; } };
  function setAch(list, totals) {
    achOwned = (list || []).slice(); if (totals) achTotals = totals;
    store.set(ACHKEY, JSON.stringify({ list: achOwned, totals: achTotals }));
  }
  const openObj = w => w[0] === 'deck' ? E.DECK[w[1]] : w[0] === 'bg' ? E.BGS.find(b => b.id === w[1]) : E.FAB[w[1]];
  const openKind = w => w[0] === 'deck' ? 'Kain' : w[0] === 'bg' ? 'Latar' : 'Fabric';
  const achText = id => { const a = E.ACH.find(x => x.id === id); return a.name + ' · terbuka: ' + [a.open].concat(a.also ? [a.also] : []).map(w => openObj(w).icon + ' ' + openObj(w).name).join(', '); };
  function endHtml() {
    const s = G.stats, uniq = []; const seen = {};
    s.list.slice().sort((a, b) => b.s - a.s).forEach(x => { if (!seen[x.w]) { seen[x.w] = 1; uniq.push(x); } });
    const POSN = { n: 'noun', v: 'verb', a: 'adjective', r: 'adverb' };
    const sendLine = sendState === 'ok' ? '<div class="bq-mut">Hasil tersimpan.</div>' : sendState === 'sending' ? '<div class="bq-mut">Menyimpan hasil…</div>' : sendState === 'fail' ? `<div class="bq-msg">Hasil belum tersimpan: ${sendErr} <button type="button" class="bq-btn sm" data-a="retry">Coba lagi</button></div>` : '';
    return `<div class="bq-top"><div class="t"><b>${label()}</b><h2>${G.won ? '🏆 Juara! Run dimenangkan' : 'Run berakhir'}</h2></div></div>${arenaHtml()}
      <div class="bq-card bq-center">${G.endReason === 'stuck' ? '<div style="font-weight:800">Tidak ada kata yang bisa disusun lagi, dan supply atau jatah Buang sudah habis.</div>' : ''}<div class="bq-mut">Skor ronde ${R.score} dari ${R.target}.</div><div style="margin-top:6px">${G.won ? 'Kamu menaklukkan ' + E.CFG.stages + ' stage' + (G.reached > E.CFG.stages ? ' + Endless sampai Stage ' + G.reached : '') + '. ' : ''}${G.reached >= best ? '🏅 Rekor baru!' : 'Rekor: Stage ' + best}</div>${sendLine}</div>
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
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><div class="bq-opt ${o.type === 'fabric' ? fabCls(o.id, o.ed) : ''}" style="cursor:default">${optHtml(o)}</div>${o.type === 'fabric' && F(o.id).t ? `<div class="bq-terms">${F(o.id).t.map(t => `<span><b>${t}</b>: ${E.TERMS[t] || ''}</span>`).join('')}</div>` : ''}
        <div class="bq-mut" style="margin:8px 0">Koinmu: 🪙 ${G.coins}${o.maxed ? ' · sudah maksimal' : !can ? ' · koin belum cukup' : ''}</div>
        <div class="bq-btns"><button type="button" class="bq-btn" data-a="closeModal">Batal</button><button type="button" class="bq-btn pri" data-a="confirmBuy" ${can ? '' : 'disabled'}>${o.maxed ? 'Maksimal' : 'Beli 🪙 ' + o.price}</button></div></div></div>`;
    }
    if (modal.t === 'opts') { const o = E.opened(achOwned), bg = Bg.choice;
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Opsi</h2>
        <div class="bq-orow"><span>Musik latar</span><button type="button" class="bq-mute ${Music.on ? '' : 'off'}" data-a="music" aria-label="Musik latar" aria-pressed="${Music.on}">🎵</button></div>
        <div class="bq-orow"><span>Tutorial bersama Bibo</span><button type="button" class="bq-btn sm" data-a="tutorial">🎓 Mulai</button></div>
        <div class="bq-orow"><span>Efek suara</span><button type="button" class="bq-mute ${Sfx.on ? '' : 'off'}" data-a="sfx" aria-label="Efek suara" aria-pressed="${Sfx.on}">🔔</button></div>
        <div class="bq-orow"><span>Tampilan layar</span><button type="button" class="bq-btn sm" data-a="orient">${matchMedia('(orientation: landscape)').matches ? '📱 Kembali tegak' : '↔️ Mode mendatar'}</button></div>
        <div class="bq-orow"><span>Kecepatan hitung skor</span><button type="button" class="bq-speed" data-a="speed" aria-label="Kecepatan hitung skor">${['⚡', '1×', '2×'][speed()]}</button></div>
        <div class="bq-orow" style="flex-direction:column;align-items:stretch"><span>Latar</span><div class="bq-bgpick">${E.BGS.map(b => { const ok = o.bgs.includes(b.id); return `<button type="button" class="bq-btn sm ${bg === b.id ? 'pri' : ''}" data-a="setBg" data-i="${b.id}" ${ok ? '' : 'disabled'}>${ok ? b.icon : '🔒'} ${b.name}</button>`; }).join('')}<button type="button" class="bq-btn sm ${bg === 'off' ? 'pri' : ''}" data-a="setBg" data-i="off">Mati</button></div>
          <span class="bq-mut">Anyaman dan Benang terbuka lewat achievement.</span></div>
        <button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Tutup</button></div></div>`; }
    if (modal.t === 'info') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Info run</h2>
        <div class="bq-stages">${Array.from({ length: Math.max(E.CFG.stages, G.stage + 1) }, (x, k) => `<span class="${k < G.stage ? 'done' : k === G.stage ? 'now' : ''}">${k + 1}</span>`).join('')}</div>
        <div class="bq-mut" style="margin:6px 0">${label()} · Kain ${E.DECK[G.deck || 'base'].icon} ${E.DECK[G.deck || 'base'].name}</div>
        <div class="bq-sec"><b>Hand (jenis kata)</b></div><div class="bq-hands">${Object.keys(E.HANDS).map(k => { const h = E.handInfo(k, E.lvOf(G, k)); return `<span>${h.icon} ${h.name} Lv${h.lv} · ${h.chips} × ${h.mult}</span>`; }).join('')}</div>
        <div class="bq-sec"><b>Fabric (kiri ke kanan)</b></div><div class="bq-chips">${G.fabrics.map(id => `<span class="bq-chip">${F(id).icon} ${F(id).name}${E.edOf(G, id) ? ' ' + E.ED[E.edOf(G, id)].icon : ''}</span>`).join('') || '-'}</div>
        <div class="bq-sec"><b>Label</b></div><div class="bq-labels">${(G.labels || []).map(id => `<span>${E.LABEL[id].icon} ${E.LABEL[id].name}: ${E.LABEL[id].desc}</span>`).join('') || '<span>Belum ada. Beli di shop.</span>'}</div>
        <button type="button" class="bq-btn" style="width:100%;margin-top:12px" data-a="closeModal">Tutup</button></div></div>`;
    if (modal.t === 'supply') {
      const rest = R.supply, plain = {}, special = {};
      rest.forEach(t => { if (!t.up && t.ch.length === 1 && t.ch !== '?') plain[t.ch] = (plain[t.ch] || 0) + 1; else { const k = t.ch + '|' + (t.up || ''); special[k] = special[k] || { t: t, n: 0 }; special[k].n++; } });
      const cell = (t, n) => `<span class="it ${n ? '' : 'none'}">${tileHtml(t, '', 'tabindex="-1"')}<i>${n ? '×' + n : '0'}</i></span>`;
      const sp = Object.keys(special).sort().map(k => cell(special[k].t, special[k].n)).join('');
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Sisa supply · ${rest.length} kartu</h2><div class="bq-mut">Kartu yang belum ditarik di ronde ini. Huruf di tanganmu tidak dihitung.</div>
        <div class="bq-sup">${'abcdefghijklmnopqrstuvwxyz'.split('').map(c => cell({ ch: c }, plain[c] || 0)).join('')}</div>
        ${sp ? `<div class="bq-sec"><b>Kartu spesial</b></div><div class="bq-sup">${sp}</div>` : ''}
        <button type="button" class="bq-btn" style="width:100%;margin-top:12px" data-a="closeModal">Tutup</button></div></div>`; }
    if (modal.t === 'howto') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Cara main</h2><ul class="bq-mut" style="margin:6px 0 0;padding-left:18px">
        <li>Satu run = ${E.CFG.stages} stage. Tiap stage: Ronde Kecil, Ronde Besar, lalu Boss (24 ronde). Kalahkan boss Stage ${E.CFG.stages} untuk menang, lalu boleh lanjut Endless.</li>
        <li>Tangan 8 kartu huruf, supply 32. Ketuk huruf berurutan untuk menyusun kata, lalu Serang. Capai target ronde untuk mengalahkan musuh.</li>
        <li>Huruf jelek? Pilih lalu Buang untuk mengambil huruf baru (3 kali per ronde).</li>
        <li>Skor = Chips × Mult. Jenis kata = hand: Noun 10 × 2, Verb 15 × 3, Adjective 20 × 4, Adverb 30 × 5. Naikkan levelnya dengan Buku di shop.</li>
        <li>Kata yang ada di Lemarimu = kata kekuatan: +4 Mult.</li>
        <li>Fabric bekerja dari kiri ke kanan: seret untuk mengatur urutannya.</li>
        <li>Di shop ada upgrade kartu, kartu imbuhan (UN, LY, ING…), gabungan huruf (TH, QU…), dan kartu wild ?.</li></ul>
        <button type="button" class="bq-btn" style="width:100%;margin-top:12px" data-a="closeModal">Tutup</button></div></div>`;
    if (modal.t === 'giveup') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Akhiri run?</h2><div class="bq-mut" style="margin:6px 0 12px">Run berhenti di ${label()}. Kata-katamu tetap bisa dilihat artinya dan disimpan ke Lemari.</div>
      <div class="bq-btns"><button type="button" class="bq-btn" data-a="closeModal">Lanjut main</button><button type="button" class="bq-btn pri" data-a="giveUpYes">Ya, akhiri</button></div></div></div>`;
    if (modal.t === 'wild') return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><h2>Kartu ? jadi huruf apa?</h2><div class="bq-mut">Nilainya setengah dari huruf aslinya.${R.boss && R.boss.block ? ' Huruf ' + R.boss.block.toUpperCase() + ' sedang dikunci.' : ''}</div>
      <div class="bq-abc">${'abcdefghijklmnopqrstuvwxyz'.split('').map(c => `<button type="button" class="bq-tile" data-a="wildAs" data-i="${c}" ${R.boss && R.boss.block === c ? 'disabled' : ''}>${c}<small>${Math.ceil(E.V[c] * E.CFG.letterMul / 2)}</small></button>`).join('')}</div>
      <button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Batal</button></div></div>`;
    if (modal.t === 'fab') { const i = G.fabrics.indexOf(modal.id), mv = (phase === 'round' || phase === 'shop') && i !== -1 && G.fabrics.length > 1, ed = E.edOf(G, modal.id);
      const terms = (F(modal.id).t || []).map(t => `<span><b>${t}</b>: ${E.TERMS[t] || ''}</span>`).join('');
      const canSell = i !== -1 && (phase === 'shop' || (phase === 'round' && !anim && R && !R.cleared)), sv = E.sellValue(G, modal.id);
      const weak = R && R.boss && !R.boss.off && R.boss.fab === modal.id && phase === 'round' ? '<div class="bq-mut" style="color:var(--error);margin-top:6px">✂️ Dilemahkan oleh Si Pemotong Benang selama ronde ini.</div>' : '';
      return `<div class="bq-modal" data-a="closeModal"><div class="bq-card" data-a="noop"><div class="bq-opt ${fabCls(modal.id, ed)}" style="cursor:default">${fabricCard(modal.id, '', ed)}</div>${terms ? `<div class="bq-terms">${terms}</div>` : ''}${weak}
        ${mv ? `<div class="bq-mut" style="margin-top:8px">Fabric dihitung dari kiri ke kanan. Taruh +Chips/+Mult di kiri dan ×Mult di kanan supaya skornya terbesar.</div>
        <div class="bq-btns" style="margin-top:8px"><button type="button" class="bq-btn" data-a="moveFab" data-i="-1" ${i === 0 ? 'disabled' : ''}>◀ Geser kiri</button><button type="button" class="bq-btn" data-a="moveFab" data-i="1" ${i === G.fabrics.length - 1 ? 'disabled' : ''}>Geser kanan ▶</button></div>` : ''}
        ${canSell ? `<button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="sellFab">💰 Jual 🪙 ${sv}</button>` : ''}
        <button type="button" class="bq-btn" style="width:100%;margin-top:10px" data-a="closeModal">Tutup</button></div></div>`; }
    return `<div class="bq-modal"><div class="bq-card"><h2>Slot penuh</h2><div class="bq-mut" style="margin:4px 0 8px">Ganti salah satu Fabric dengan:</div><div class="bq-opt ${fabCls(modal.id, modal.ed)}" style="margin-bottom:8px;cursor:default">${fabricCard(modal.id, '', modal.ed)}</div><div class="bq-mut">Ketuk Fabric yang diganti (yang lama dijual), atau lewati.</div><div class="bq-opts" style="margin-top:6px">${G.fabrics.map((id, i) => `<button type="button" class="bq-opt ${fabCls(id, E.edOf(G, id))}" data-a="doReplace" data-i="${i}" ${E.edOf(G, id) === 'neg' ? 'disabled' : ''}><span class="ic">${F(id).icon}</span><b>${F(id).name}</b> <span class="bq-mut">jual 🪙 ${E.sellValue(G, id)}</span></button>`).join('')}</div><button type="button" class="bq-btn" style="width:100%;margin-top:8px" data-a="skipReplace">Lewati Fabric baru</button></div></div>`;
  }
  function render() {
    let h = '';
    if (phase === 'intro') h = introHtml();
    else if (phase === 'coll') h = collHtml();
    else if (phase === 'win') h = `<div class="bq-center bq-pop bq-win"><img src="img/game/bibo-victory.webp" alt="Bibo menang"><h2 style="font-size:30px">Juara! 🏆</h2><div>Kamu menaklukkan ${E.CFG.stages} stage dan ${E.CFG.stages * 3} ronde.</div><div class="bq-mut">Mulai run baru, lihat hasil run ini, atau lanjut ke Endless: target naik makin curam tiap stage sampai kamu kalah.</div>${endlessBest() ? `<div class="bq-mut">Rekor Endless: Stage ${endlessBest()}</div>` : ''}</div>
      <div class="bq-btns bq-win3"><button type="button" class="bq-btn" data-a="newRun">🔄 Run baru</button><button type="button" class="bq-btn" data-a="finishWin">📋 Lihat hasil</button><button type="button" class="bq-btn pri" data-a="endless">♾️ Lanjut Endless</button></div>`;
    else if (phase === 'deck') h = `<h2>Pilih Kain</h2><div class="bq-mut">Kain menentukan isi supply-mu. Kain baru terbuka lewat achievement.</div><div class="bq-opts">${deckOpts.map(id => { const d = E.DECK[id]; return `<button type="button" class="bq-opt" data-a="pickDeck" data-i="${id}"><span class="ic">${d.icon}</span><b>${d.name}</b><span class="d">${d.desc}</span></button>`; }).join('')}</div>`;
    else if (phase === 'ach') h = achHtml();
    else if (phase === 'starter') h = `<h2>Pilih Fabric awal</h2><div class="bq-mut">Kamu mulai dengan 1 Fabric dari 3 pilihan.</div><div class="bq-opts">${starters.map((id, i) => `<button type="button" class="bq-opt ${fabCls(id)}" data-a="pickStarter" data-i="${i}">${fabricCard(id)}</button>`).join('')}</div>`;
    else if (phase === 'bosspre') h = `<div class="bq-card bq-center"><img src="${bossImg(R.boss.id)}" alt="" style="height:150px;width:auto"><h2>${R.boss.name}</h2><p>${R.boss.off ? '<b>✂️ Gunting Emas mematikan aturan boss ini.</b>' : R.boss.desc}${R.boss.block ? `<br><b style="color:var(--error);font-size:22px">Huruf terkunci: ${R.boss.block.toUpperCase()}</b>` : ''}${R.boss.fab ? `<br><b style="color:var(--error)">Fabric dilemahkan: ${F(R.boss.fab).icon} ${F(R.boss.fab).name}</b>` : ''}</p><div class="bq-mut">Capai skor <b>${fmtN(R.target)}</b> untuk mengalahkannya.</div></div>
      ${E.hasLabel(G, 'gantilawan') && G.swapped !== G.stage ? '<button type="button" class="bq-btn" data-a="swapBoss">🔀 Ganti lawan (sekali per stage)</button>' : ''}<button type="button" class="bq-btn pri" data-a="faceBoss">Hadapi boss</button>`;
    else if (phase === 'round') h = roundHtml();
    else if (phase === 'reward') { rewards.forEach(o => edFound(o.ed)); h = `<h2>Ronde selesai! 🎉</h2><div class="bq-mut">Pilih 1 hadiah.</div><div class="bq-opts">${rewards.map((o, i) => `<button type="button" class="bq-opt ${o.type === 'fabric' ? fabCls(o.id, o.ed) : ''}" data-a="takeReward" data-i="${i}">${optHtml(o)}</button>`).join('')}</div>`; }
    else if (phase === 'shop') {
      shop.forEach(o => edFound(o.ed));
      const perm = E.permItems(G), secOf = o => o.sec || (o.type === 'fabric' ? 'fabric' : 'card');
      const box = (o, key, priceTxt, off) => `<button type="button" class="bq-gi ${o.type === 'fabric' ? fabCls(o.id, o.ed) : o.type === 'label' ? 'lab' : ''} ${o.sold ? 'sold' : off ? 'poor' : ''}" data-a="item" data-i="${key}" ${o.sold ? 'disabled' : ''}>${optHtml(o)}<span class="pr">${o.sold ? 'Terjual' : priceTxt}</span></button>`;
      const rp = E.rerollPrice(G), labs = (G.labels || []).map(id => `<span>${E.LABEL[id].icon} ${E.LABEL[id].name}</span>`).join('');
      const sec = name => shop.map((o, i) => secOf(o) === name ? box(o, 's' + i, '🪙 ' + o.price, G.coins < o.price) : '').join('');
      const rr = name => `<button type="button" class="bq-btn sm" ${G.coins < rp ? 'disabled' : ''} data-a="reroll" data-i="${name}">🔁 Reroll (🪙 ${rp})</button>`;
      h = `<div class="bq-top"><h2 style="flex:1">🛍️ Shop</h2><span class="bq-coin">🪙 ${G.coins}</span></div><div class="bq-mut">Ketuk barang untuk melihat detail dan membeli. Boleh keluar tanpa beli.</div>
        <div class="bq-sec"><b>🧩 Kartu</b>${rr('card')}</div><div class="bq-grid">${sec('card')}</div>
        <div class="bq-sec"><b>🧵 Fabric</b>${rr('fabric')}</div><div class="bq-grid">${sec('fabric') || '<div class="bq-mut">Semua Fabric sudah kamu punya.</div>'}</div>
        <div class="bq-sec"><b>🏷️ Label</b><span class="bq-mut">permanen, 1 per kunjungan</span></div><div class="bq-grid">${sec('label') || '<div class="bq-mut">Semua Label sudah kamu punya.</div>'}</div>${labs ? `<div class="bq-labels">${labs}</div>` : ''}
        <div class="bq-sec"><b>🎒 Perlengkapan</b><span class="bq-mut">harga naik tiap beli</span></div><div class="bq-grid">${perm.map((o, i) => box(o, 'p' + i, o.maxed ? 'MAKS' : '🪙 ' + o.price, o.maxed || G.coins < o.price)).join('')}</div>
        <div><div class="bq-mut">Fabric kamu</div>${slotsHtml()}</div>
        <div><div class="bq-mut">Hand kamu</div><div class="bq-hands">${'nvar'.split('').map(p => { const h = E.handInfo(p, E.lvOf(G, p)); return `<span>${h.icon} <b>${h.name}</b> Lv${h.lv} · ${h.chips} × ${h.mult}</span>`; }).join('')}</div></div>
        <button type="button" class="bq-btn pri" data-a="leaveShop">Lanjut ke ${label()}</button>`;
    } else if (phase === 'end') h = endHtml();
    body.innerHTML = '<div class="bq' + (phase === 'round' ? ' bq-r' : '') + (phase === 'intro' ? ' bq-in' : '') + '">' + h + (modal ? modalHtml() : '') + '</div>';
    const bossOn = !!(R && R.boss && !R.cleared && (phase === 'bosspre' || phase === 'round'));
    Bg.update(G && phase !== 'intro' && phase !== 'coll' && phase !== 'ach' ? G.stage : 0, bossOn); Music.mode(bossOn ? 'boss' : 'calm');
    if (shake) { const p = body.querySelector('.bq-prev'); if (p) p.classList.add('bq-shake'); }
    shake = false;
    body.querySelectorAll('[data-add]').forEach(el => { try { const w = el.getAttribute('data-add'), m = means[w]; const b = host.addButton(w, m && m.r ? m.r.translation : ''); if (b) { b.addEventListener('click', ev => ev.stopPropagation()); el.replaceWith(b); } } catch (e) { /* host without Lemari: no add button */ } });
    Object.keys(means).forEach(showMeaning);
    save(); tutDraw();
  }

  /* ---------- tutorial (owner 26 Nov): a scripted run where Bibo points at each part of the screen; never saved or sent ---------- */
  const TUTKEY = 'wr_game_tut';
  let tut = null;
  const TUT = [
    { t: 'Halo, aku Bibo! Ayo belajar Wordrobe Quest sebentar. Kamu bisa lewati kapan saja.' },
    { at: '.bq-fig.en', t: 'Ini lawanmu. Capai <b>skor target</b> di bawahnya sebelum huruf dan jatah Buang habis untuk mengalahkannya.' },
    { at: '.bq-hand', wait: 'word', t: 'Ini tanganmu. Ketuk huruf untuk menyusun kata bahasa Inggris. Coba <b>J A C K E T</b>.' },
    { at: '.bq-bar.cm', t: 'Skor dihitung <b>Chips × Mult</b>. Chips (biru) dari nilai huruf dan panjang kata, Mult (merah) dari jenis kata dan Fabric.' },
    { at: '.bq-hn', t: 'Jenis kata (Noun, Verb, Adjective, Adverb) adalah <b>hand</b>-mu. Adverb paling kuat, dan Buku di shop menaikkan levelnya.' },
    { at: '[data-a="send"]', wait: 'send', t: 'Tekan <b>Serang</b> untuk memainkan kata. Lihat tiap kartu dan Fabric menambah skor satu per satu.' },
    { at: '[data-a="discard"]', t: 'Huruf tidak berguna? Pilih lalu <b>Buang</b> untuk menukarnya dengan huruf dari supply. Jatah Buang terbatas tiap ronde.' },
    { at: '.bq-pile, .bq-sv', t: 'Ini <b>supply</b>: sisa huruf ronde ini. Ketuk untuk melihat huruf apa saja yang masih ada.' },
    { at: '.bq-slots', t: '<b>Fabric</b> = kekuatan pasif. Dihitung dari kiri ke kanan, jadi taruh +Mult di kiri dan ×Mult di kanan. Seret untuk mengubah urutan, ketuk untuk detail atau menjual.' },
    { t: 'Kata yang sudah ada di <b>Lemari</b>-mu adalah kata kekuatan: +4 Mult. Simpan kata baru dari layar hasil supaya makin kuat.' },
    { t: 'Menang ronde? Pilih <b>1 hadiah</b>: Fabric, kartu ber-upgrade, Buku, atau koin.' },
    { t: 'Di <b>shop</b>, Fabric punya kelangkaan: Umum (abu), Langka (hijau), Epik (magenta), Legendaris (emas). Yang berkilau punya <b>edisi</b> bonus. Ada juga 1 <b>Label</b> permanen tiap kunjungan, dan Fabric bisa dijual setengah harga.' },
    { t: 'Tiap stage punya Ronde Kecil, Ronde Besar, lalu <b>Boss</b> dengan aturan khusus. Baca aturannya sebelum bertarung.' },
    { t: 'Kalahkan boss <b>Stage 8</b> untuk jadi Juara, lalu lanjut ke Endless kalau berani. Siap?', last: true }
  ];
  function tutStart() {
    G = E.newGame(null, 'base'); E.addFabric(G, 'long'); E.addFabric(G, 'golden'); G.tut = true; G.runId = 'tutorial'; G.newAch = [];
    R = E.makeRound(G, E.rngFrom(7)); R.hand = 'jacketso'.split('').map(c => E.mk(c)); R.target = 99999;
    tut = { i: 0 }; phase = 'round'; sel = []; msg = ''; last = null; modal = null; sendState = ''; render();
  }
  function tutEnd(go) {
    store.set(TUTKEY, '1'); tut = null; G = null; R = null; sel = []; anim = null; modal = null; phase = 'intro'; tutDraw();
    if (go) A.start(); else render();
  }
  const visible = q => [...body.querySelectorAll(q)].find(el => el.offsetParent !== null && el.getClientRects().length);
  function tutDone(st) {
    if (st.wait === 'word') { const w = sel.map(E.txt).join(''); return w.length >= 3 && E.isWord(w); }
    if (st.wait === 'send') return !!(R && R.words && !anim);
    return true;
  }
  // the dim with a hole over the element Bibo talks about, and Bibo's speech bubble on the other half of the screen
  function tutDraw() {
    let hole = document.getElementById('bq-hole'), box = document.getElementById('bq-tutbox');
    if (!tut || phase !== 'round' || modal) { if (hole) hole.remove(); if (box) box.remove(); return; }
    const st = TUT[tut.i];
    if (st.wait === 'send' && tutDone(st)) { tut.i++; tutDraw(); return; }
    if (!hole) { hole = document.createElement('div'); hole.id = 'bq-hole'; hole.className = 'bq-hole'; document.body.appendChild(hole); }
    if (!box) { box = document.createElement('div'); box.id = 'bq-tutbox'; document.body.appendChild(box); box.addEventListener('click', ev => { const b = ev.target.closest('[data-t]'); if (b) tutAct(b.getAttribute('data-t')); }); }
    const el = st.at ? visible(st.at) : null;
    let top = false;
    if (el) {
      const rc = el.getBoundingClientRect();
      if (rc.top < 0 || rc.bottom > innerHeight) { el.scrollIntoView({ block: 'center', behavior: 'instant' }); }
      const r2 = el.getBoundingClientRect(), pad = 6;
      hole.className = 'bq-hole'; Object.assign(hole.style, { left: r2.left - pad + 'px', top: r2.top - pad + 'px', width: r2.width + 2 * pad + 'px', height: r2.height + 2 * pad + 'px' });
      top = r2.top > innerHeight - r2.bottom;   // the bubble goes where there is more room
    } else { hole.className = 'bq-hole none'; hole.removeAttribute('style'); }
    const ok = tutDone(st);
    box.className = 'bq-tut ' + (top ? 'top' : 'bot');
    box.innerHTML = `<img src="img/game/bibo-${st.last ? 'victory' : st.wait ? 'thinking' : 'idle'}.webp" alt="Bibo"><div class="bq-bub" role="dialog" aria-label="Tutorial"><b>Bibo</b> <small>${tut.i + 1}/${TUT.length}</small><p>${st.t}</p>
      <div class="bq-btns"><button type="button" class="bq-btn" data-t="skip">Lewati tutorial</button>${st.last ? '<button type="button" class="bq-btn pri" data-t="go">Mulai run!</button>' : st.wait === 'send' ? '' : `<button type="button" class="bq-btn pri" data-t="next" ${ok ? '' : 'disabled'}>Lanjut</button>`}</div></div>`;
  }
  function tutAct(a) {
    if (!tut) return;
    if (a === 'skip') tutEnd(false);
    else if (a === 'go') tutEnd(true);
    else if (a === 'next' && tutDone(TUT[tut.i])) { tut.i = Math.min(TUT.length - 1, tut.i + 1); tutDraw(); }
  }
  let tutRaf = 0;
  const tutLater = () => { if (tut && !tutRaf) tutRaf = requestAnimationFrame(() => { tutRaf = 0; tutDraw(); }); };
  if (typeof window !== 'undefined') { window.addEventListener('resize', tutLater); window.addEventListener('scroll', tutLater, true); }

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
    host.submit({ run_id: g.runId, stage: g.reached, round: g.rnd + 1, words: s.words, longest: s.longest, best_word: s.best.w, best_score: s.best.s, total_score: s.total, fabrics: g.fabrics.slice(), deck: g.deck || 'base', won: !!g.won, win_pos: g.winPos ? { nouns: g.winPos.n || 0, verbs: g.winPos.v || 0, adjs: g.winPos.a || 0, advs: g.winPos.r || 0 } : undefined, achievements: (g.newAch || []).slice(), counts: E.runCounts(g) })
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
    if (G && G.tut) { tutEnd(false); return; }
    checkAch(); Sfx.play('over');
    phase = 'end'; G.reached = G.stage + 1;
    if (G.reached > best) { best = G.reached; store.set(BEST, String(best)); }
    if (G.won && G.reached > E.CFG.stages && G.reached > endlessBest()) store.set(ENDKEY, String(G.reached));   // separate Endless record (owner 26 Nov)
    achNew = []; sendState = ''; sendResult();
  }
  function gain(o, after) {
    if (o.type === 'coin') { G.coins += o.n; after(); }
    else if (o.type === 'up') { E.addUpgrade(G, o.kind, o.ch); after(); }
    else if (o.type === 'supply') { G.extra += o.n; after(); }
    else if (o.type === 'letter' || o.type === 'multi' || o.type === 'wild') { G.letterAdds.push(o.ch); after(); }
    else if (o.type === 'book') { G.handLv = G.handLv || { o: 1, n: 1, v: 1, a: 1, r: 1 }; G.handLv[o.pos] = E.lvOf(G, o.pos) + E.bookStep(G); after(); }
    else if (o.type === 'label') { G.labels = (G.labels || []).concat(o.id); after(); }
    else if (o.type === 'fabric') { if (G.fabrics.length < E.slotsOf(G) || o.ed === 'neg') { E.addFabric(G, o.id, o.ed, o.price || 0); after(); } else { modal = { t: 'replace', id: o.id, ed: o.ed, paid: o.price || 0, after: after }; render(); } }
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
          const fe = s0.slot && body.querySelector('.bq-slot[data-i="' + s0.slot + '"]');   // an on-card Fabric fires with the card
          if (fe) { fe.classList.remove('hit'); void fe.offsetWidth; fe.classList.add('hit'); }
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

  // daily missions live in the host page (the Beranda shows them without loading this file); the game only reports events and takes the reward
  const quest = (...ev) => { ev.filter(Boolean).forEach(e => { try { const t = host.quest ? host.quest(e) : ''; if (t) toast(t); } catch (x) { /* missions are a bonus: never break a round */ } }); };
  function applyBonus() {
    let b = null; try { b = host.takeBonus ? host.takeBonus() : null; } catch (e) { b = null; }
    if (!b || !(b.coins || b.fabrics)) return;
    G.coins += b.coins || 0; const got = [];
    for (let k = 0; k < (b.fabrics || 0) && G.fabrics.length < E.slotsOf(G); k++) {
      const pool = E.FABRICS.filter(f => E.avail(G, f) && !G.fabrics.includes(f.id) && (f.r || 1) <= 2 && ['chips', 'add', 'x'].includes(f.kind));
      if (!pool.length) break; const f = pool[Math.floor(rng() * pool.length)]; E.addFabric(G, f.id); got.push(f.icon + ' ' + f.name);
    }
    toast('Bekal misi harian: ' + [b.coins ? '+' + b.coins + ' koin' : '', got.join(', ')].filter(Boolean).join(' · '));
  }
  function beginRound() { R = E.makeRound(G, rng); sel = []; last = null;
    msg = [R.woven ? '🧑‍🔧 Penenun menambah huruf ' + R.woven.toUpperCase() + '.' : '', R.cut ? '✂️ Gunting Tajam memotong ' + F(R.cut.id).name + ': +' + R.cut.v + ' Mult.' : ''].filter(Boolean).join(' '); phase = R.boss ? 'bosspre' : 'round'; render(); }
  function toShop() { G.stage++; G.rnd = 0; checkAch(); shop = E.shopItems(G, rng); phase = 'shop'; render(); }
  // beating the stage-8 boss wins the run (owner 25 Nov); the player may stop there or go on endless
  function advance() {
    if (!isBoss()) { G.rnd++; beginRound(); return; }
    if (!G.won && G.stage + 1 >= E.CFG.stages) { G.won = true; G.winPos = Object.assign({}, G.stats.pos || {}); checkAch(); Sfx.play('win'); phase = 'win'; render(); return; }
    toShop();
  }
  const A = {
    start() {
      if (!store.get(TUTKEY) && !(achTotals.runs > 0) && !best && !load()) { tutStart(); return; }   // first play ever: Bibo's tutorial
      deckOpts = E.opened(achOwned).decks;
      if (deckOpts.length > 1) { G = null; phase = 'deck'; modal = null; render(); return; }
      A.pickDeck('base');
    },
    pickDeck(id) {
      means = {}; G = E.newGame(null, id, E.opened(achOwned).fabrics); G.runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); G.submitted = false; G.newAch = [];
      const ids = E.FABRICS.filter(f => E.avail(G, f) && (f.r || 1) <= 2 && ['chips', 'add', 'x'].includes(f.kind) && f.id !== 'kainbaru').map(f => f.id);
      starters = E.shuffle(ids.slice(), rng).slice(0, 3); phase = 'starter'; last = null; sel = []; modal = null; sendState = ''; render();
    },
    achList() { phase = 'ach'; render(); },
    achBack() { phase = 'intro'; render(); },
    coll() { phase = 'coll'; render(); },
    opts() { modal = { t: 'opts' }; render(); },
    runInfo() { modal = { t: 'info' }; render(); },
    howto() { modal = { t: 'howto' }; render(); },
    supplyView() { if (!anim && R) { modal = { t: 'supply' }; render(); } },
    setBg(v) { Bg.set(v); render(); },
    // landscape on demand (owner 25 Nov). An installed app may lock the screen itself; a browser tab needs fullscreen first.
    async orient() {
      const land = matchMedia('(orientation: landscape)').matches, want = land ? 'portrait' : 'landscape';
      const lock = () => Promise.race([screen.orientation.lock(want), new Promise((ok, no) => setTimeout(() => no(new Error('lock')), 1500))]);
      const app = matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: fullscreen)').matches;
      try { if (!app) throw new Error('tab'); await lock(); }   // a browser tab cannot lock without fullscreen: go straight to it
      catch (e) {
        try {
          if (land && document.fullscreenElement) { await document.exitFullscreen(); }
          else { await document.documentElement.requestFullscreen({ navigationUI: 'hide' }); await lock(); }
        } catch (e2) {
          try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (x) { /* ignore */ }
          toast('Layar belum bisa diputar dari app. Pastikan Rotasi otomatis menyala, tutup Wordrobe sepenuhnya lalu buka lagi, lalu miringkan HP.');
        }
      }
      setTimeout(render, 350);
    },
    giveUp() { modal = { t: 'giveup' }; render(); },
    giveUpYes() { modal = null; if (G && G.tut) { tutEnd(false); return; } endRun(); },
    tutorial() { tutStart(); },
    endless() { G.endless = true; toShop(); },
    finishWin() { endRun(); },
    newRun() { endRun(); A.start(); },   // the won run is still saved (endRun sends it), then a new one starts
    sfx() { Sfx.toggle(); render(); },
    resume() { const s = load(); if (!s) { A.start(); return; } restore(s); if (phase === 'round' && R && !R.cleared && E.failed(G, R)) { G.endReason = 'stuck'; endRun(); return; } if (phase === 'round' && R && !R.cleared) R.noWord = E.stuck(R); render(); },
    pickStarter(i) { G.fabrics = []; G.fx = {}; E.addFabric(G, starters[+i]); applyBonus(); beginRound(); },
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
      const inL = inLemari(w), r = E.submit(G, R, sel, rng, { inLemari: inL });
      if (!r.ok) { msg = r.msg; shake = true; Sfx.play('bad'); render(); return; }
      if (!G.tut) quest(inL ? 'lemari' : '', r.won ? 'win' : '');
      last = { res: r.res }; sel = []; msg = '';
      const lost = !r.won && E.failed(G, R); R.noWord = !r.won && !lost && E.stuck(R); if (lost) G.endReason = 'stuck';
      if (r.won) { last.fin = E.finishRound(G, R); rewards = E.rewardOptions(G, rng, !!R.boss); R.cleared = true; }
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
    discard() { sel.forEach(t => delete t.as); if (!E.discard(G, R, sel.slice())) return; Sfx.play('discard'); const n = sel.length; sel = []; msg = 'Buang ' + n + ' huruf, ambil dari supply.'; if (E.failed(G, R)) { G.endReason = 'stuck'; endRun(); return; } R.noWord = E.stuck(R); render(); },
    goNext() { phase = 'reward'; Sfx.play('coin'); render(); },
    takeReward(i) { if (rewards[+i] && rewards[+i].type === 'coin') Sfx.play('coin'); gain(rewards[+i], advance); },
    showFab(id) { modal = { t: 'fab', id: id }; render(); },
    closeModal() { modal = null; render(); },
    doReplace(i) { const m = modal, old = G.fabrics[+i]; if (!old || E.edOf(G, old) === 'neg') return; modal = null;
      const v = E.sellValue(G, old); G.coins += v; delete G.fx[old]; G.fabrics[+i] = m.id; G.fx[m.id] = { ed: m.ed || null, paid: m.paid || 0, v: m.id === 'kainbaru' ? 100 : 0 }; m.after(); },
    // sell a Fabric (owner 26 Nov, Balatro): half of what was paid, at least 1 coin; in the shop or between words
    sellFab() { const id = modal && modal.id; if (!id || anim) return; const v = E.sellFabric(G, id);
      if (!v) { msg = 'Fabric Tembus ini tidak bisa dijual selama semua slot terisi.'; modal = null; render(); return; }
      Sfx.play('coin'); modal = null; toast('💰 ' + F(id).name + ' terjual: +' + v + ' koin'); render(); },
    swapBoss() { if (E.swapBoss(G, R, rng)) { Sfx.play('discard'); render(); } },
    skipReplace() { const m = modal; modal = null; m.after(); },
    buy(i) {
      const o = shop[+i]; if (!o || o.sold || G.coins < o.price) return;
      if (o.type === 'fabric' && G.fabrics.length >= E.slotsOf(G) && o.ed !== 'neg') { modal = { t: 'replace', id: o.id, ed: o.ed, paid: o.price, after: () => { if (G.fabrics.includes(o.id)) { G.coins -= o.price; o.sold = true; Sfx.play('coin'); } render(); } }; render(); return; }
      G.coins -= o.price; o.sold = true; Sfx.play('coin'); gain(o, render);
    },
    buyPerm(i) {
      const o = E.permItems(G)[+i]; if (!o || o.maxed || G.coins < o.price) return; G.coins -= o.price; Sfx.play('coin');
      if (o.type === 'supply') G.extra += o.n;
      render();
    },
    reroll(sec) { const p = E.rerollPrice(G); if (G.coins < p) return; G.coins -= p; Sfx.play('coin'); shop = E.rerollShop(G, shop, sec === 'fabric' ? 'fabric' : 'card', rng); render(); },
    item(key) { modal = { t: 'item', key: key }; render(); },
    confirmBuy() { const k = modal && modal.key; modal = null; if (!k) return; if (k[0] === 'p') A.buyPerm(k.slice(1)); else A.buy(k.slice(1)); },
    leaveShop() { beginRound(); },
    retry() { sendResult(); },
    noop() { }
  };
  /* Drag a Fabric to reorder it (owner 25 Nov): mouse or finger, in a round or the shop, not while a score is counting.
     A move of 8px sideways (or a 250 ms hold) starts the drag; a plain tap still opens the Fabric popup. */
  let drag = null, dragEnded = 0;
  function dragStart(ev) {
    const el = ev.target.closest ? ev.target.closest('.bq-slot[data-a="showFab"]') : null;
    if (!el || anim || modal || (phase !== 'round' && phase !== 'shop') || !G || G.fabrics.length < 2 || (ev.button !== undefined && ev.button > 0)) return;
    drag = { el, id: el.getAttribute('data-i'), x0: ev.clientX, y0: ev.clientY, pid: ev.pointerId, on: false, t: Date.now(), to: -1,
      slots: [...body.querySelectorAll('.bq-slot[data-a="showFab"]')] };
    drag.hold = setTimeout(() => { if (drag && !drag.on) dragOn(); }, 250);
  }
  function dragOn() { drag.on = true; drag.el.classList.add('drag'); try { drag.el.setPointerCapture(drag.pid); } catch (e) { /* fine without */ } Sfx.play('tick'); }
  function dragMove(ev) {
    if (!drag || ev.pointerId !== drag.pid) return;
    const dx = ev.clientX - drag.x0, dy = ev.clientY - drag.y0;
    if (!drag.on) { if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) dragOn(); else { if (Math.abs(dy) > 10) dragEnd(); return; } }
    ev.preventDefault();
    drag.el.style.transform = 'translate(' + dx + 'px,' + dy * 0.2 + 'px) scale(1.06)';
    // the slot under the pointer is where the Fabric lands
    let to = drag.slots.length - 1;
    for (let i = 0; i < drag.slots.length; i++) { const b = drag.slots[i].getBoundingClientRect(); if (ev.clientX < b.left + b.width / 2) { to = i; break; } }
    const from = drag.slots.indexOf(drag.el); if (to > from && ev.clientX < drag.slots[to].getBoundingClientRect().left + drag.slots[to].getBoundingClientRect().width / 2) to--;
    drag.to = to; drag.slots.forEach((s, i) => s.classList.toggle('drop', drag.on && i === to && s !== drag.el));
  }
  function dragEnd() {
    if (!drag) return; clearTimeout(drag.hold);
    const d = drag; drag = null;
    if (!d.on) return;
    dragEnded = Date.now(); d.el.style.transform = ''; d.el.classList.remove('drag'); d.slots.forEach(s => s.classList.remove('drop'));
    const from = G.fabrics.indexOf(d.id);
    if (from < 0 || d.to < 0 || d.to === from) { render(); return; }
    G.fabrics.splice(from, 1); G.fabrics.splice(Math.min(d.to, G.fabrics.length), 0, d.id); Sfx.play('discard'); render();
  }
  function onClick(ev) {
    if (Date.now() - dragEnded < 80) { ev.stopPropagation(); return; }
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
      body.addEventListener('pointerdown', dragStart); body.addEventListener('pointermove', dragMove, { passive: false }); body.addEventListener('pointerup', dragEnd); body.addEventListener('pointercancel', dragEnd);
      document.addEventListener('visibilitychange', () => { if (document.hidden) Music.stop(); else Bg.wake(); });
      if (window.MutationObserver) new MutationObserver(() => { if (root.hidden) { Music.stop(); if (document.fullscreenElement) { try { screen.orientation.unlock(); } catch (e) { /* ok */ } document.exitFullscreen().catch(() => {}); } } }).observe(root, { attributes: true, attributeFilter: ['hidden'] });
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
