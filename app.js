(() => {
  const COMMON = new Set([
    "password","password1","password123","passw0rd","qwerty","qwerty123","qwertyuiop",
    "123456","1234567","12345678","123456789","1234567890","111111","000000","abc123",
    "iloveyou","admin","letmein","welcome","monkey","dragon","master","login","princess",
    "football","baseball","shadow","sunshine","trustno1","whatever","starwars","hello",
    "freedom","access","ranger","secret","hunter","buster","soccer","hockey","tigger",
    "charlie","andrew","michelle","jessica","michael","jennifer","superman","batman",
    "ninja","azerty","pass","pass123","pw123","root","toor","changeme","default",
    "p@ssw0rd","p@ssword","pass@123","admin123","welcome1","qwe123","1q2w3e4r","zaq12wsx",
    "asdfgh","zxcvbn","1qaz2wsx","qazwsx","lovely","pokemon","naruto","minecraft",
    "letmein1","passwort","contraseña","senha","azerty123"
  ]);

  const KEYBOARD_ROWS = ["qwertyuiop", "asdfghjkl", "zxcvbnm", "1234567890"];
  const SEQUENCES = ["abcdefghijklmnopqrstuvwxyz", "0123456789"];

  const $ = (id) => document.getElementById(id);
  const passwordEl = $("password");
  const toggleBtn = $("toggle-vis");
  const generateBtn = $("generate");
  const navGenerateBtn = $("nav-generate");
  const clearBtn = $("clear");

  function charsetInfo(pw) {
    const lower = /[a-z]/.test(pw);
    const upper = /[A-Z]/.test(pw);
    const digit = /\d/.test(pw);
    const space = /\s/.test(pw);
    const symbol = /[^A-Za-z0-9\s]/.test(pw);
    let size = 0;
    if (lower) size += 26;
    if (upper) size += 26;
    if (digit) size += 10;
    if (space) size += 1;
    if (symbol) size += 33;
    return { lower, upper, digit, space, symbol, size, classes: [lower, upper, digit, symbol].filter(Boolean).length };
  }

  function shannonEntropy(pw) {
    if (!pw.length) return 0;
    const freq = {};
    for (const ch of pw) freq[ch] = (freq[ch] || 0) + 1;
    let h = 0;
    const n = pw.length;
    for (const c of Object.values(freq)) {
      const p = c / n;
      h -= p * Math.log2(p);
    }
    return h * n;
  }

  function bruteforceBits(pw, size) {
    if (!pw.length || size < 2) return 0;
    return pw.length * Math.log2(size);
  }

  function hasSequence(pw, min = 4) {
    const s = pw.toLowerCase();
    const pools = [...SEQUENCES, ...KEYBOARD_ROWS, ...SEQUENCES.map((x) => [...x].reverse().join(""))];
    for (const row of KEYBOARD_ROWS) pools.push([...row].reverse().join(""));
    for (const pool of pools) {
      for (let i = 0; i <= pool.length - min; i++) {
        if (s.includes(pool.slice(i, i + min))) return true;
      }
    }
    return false;
  }

  function repeatRatio(pw) {
    if (!pw.length) return 0;
    const unique = new Set(pw).size;
    return 1 - unique / pw.length;
  }

  function looksLikeYear(pw) {
    return /(19|20)\d{2}/.test(pw);
  }

  function leetDecode(pw) {
    return pw
      .toLowerCase()
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      .replace(/@/g, "a")
      .replace(/\$/g, "s");
  }

  function isCommon(pw) {
    const raw = pw.toLowerCase();
    if (COMMON.has(raw)) return true;
    const decoded = leetDecode(pw);
    if (COMMON.has(decoded)) return true;
    for (const word of COMMON) {
      if (word.length >= 5 && (raw.includes(word) || decoded.includes(word))) return true;
    }
    return false;
  }

  function onlyDigitsOrLetters(pw) {
    return /^[A-Za-z]+$/.test(pw) || /^\d+$/.test(pw);
  }

  function formatGuesses(n) {
    if (!isFinite(n) || n <= 0) return "—";
    if (n < 1000) return String(Math.round(n));
    const units = ["", "K", "M", "B", "T", "Qa", "Qi"];
    let i = 0;
    let v = n;
    while (v >= 1000 && i < units.length - 1) {
      v /= 1000;
      i++;
    }
    return `${v.toFixed(v >= 10 ? 0 : 1)}${units[i]}`;
  }

  function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return "instant";
    if (seconds < 1) return "instant";
    const units = [
      ["century", 3155760000],
      ["year", 31557600],
      ["month", 2629800],
      ["day", 86400],
      ["hour", 3600],
      ["minute", 60],
      ["second", 1]
    ];
    for (const [name, size] of units) {
      if (seconds >= size) {
        const val = seconds / size;
        if (val > 1e12) return "> 1 trillion years";
        const shown = val >= 10 ? Math.round(val) : Number(val.toFixed(1));
        const label = shown === 1 ? name : name === "century" ? "centuries" : `${name}s`;
        return `${shown.toLocaleString()} ${label}`;
      }
    }
    return "instant";
  }

  function analyze(pw) {
    if (!pw) {
      return {
        empty: true,
        score: 0,
        verdict: "AWAITING SIGNAL",
        entropy: 0,
        bits: 0,
        shannon: 0,
        guesses: 0,
        composition: charsetInfo(""),
        findings: ["No payload in buffer. Enter a candidate secret to begin analysis."],
        recs: ["Use a password manager to generate unique secrets per account.", "Prefer a 4+ word passphrase or 16+ random characters.", "Enable phishing-resistant MFA (passkeys / hardware security keys)."]
      };
    }

    const comp = charsetInfo(pw);
    const shannon = shannonEntropy(pw);
    let bits = bruteforceBits(pw, Math.max(comp.size, 2));
    const findings = [];
    let penalty = 0;

    if (isCommon(pw)) {
      penalty += 28;
      bits = Math.min(bits, 20);
      findings.push({ t: "Common / wordlist hit", d: "This resembles passwords in public breach dictionaries. Assume it is guessed first." });
    }
    if (hasSequence(pw)) {
      penalty += 12;
      bits *= 0.55;
      findings.push({ t: "Sequential / keyboard walk", d: "Runs like qwerty or abcd collapse search space for rule-based crackers." });
    }
    if (repeatRatio(pw) > 0.35) {
      penalty += 10;
      bits *= 0.7;
      findings.push({ t: "Low uniqueness", d: "Repeated characters reduce Shannon entropy versus a fully random string of the same length." });
    }
    if (looksLikeYear(pw)) {
      penalty += 6;
      bits *= 0.85;
      findings.push({ t: "Embedded year", d: "Dates (birth years, 2024) are high-priority in targeted and untargeted attacks." });
    }
    if (onlyDigitsOrLetters(pw)) {
      penalty += 8;
      findings.push({ t: "Single character class", d: "Letters-only or digits-only secrets are cheaper to brute force than mixed charsets." });
    }
    if (pw.length < 8) {
      penalty += 20;
      findings.push({ t: "Below modern length floor", d: "Under 8 characters is trivial for offline attacks and fails most enterprise policy." });
    } else if (pw.length < 12) {
      penalty += 8;
      findings.push({ t: "Short for offline resistance", d: "12–16+ characters (or a long passphrase) is the practical floor against GPU cracking of weak hashes." });
    }
    if (comp.classes < 3 && pw.length < 16) {
      penalty += 6;
    }
    if (/^[A-Z][a-z]+[\d]{1,4}[!@#$%]?$/.test(pw)) {
      penalty += 10;
      bits *= 0.5;
      findings.push({ t: "Predictable template", d: "Capital + word + digits + optional symbol is a well-known human pattern." });
    }

    bits = Math.max(8, bits);
    const guesses = Math.pow(2, bits);
    const entropyScore = Math.min(100, (bits / 80) * 100);
    const complexityScore = Math.min(100, (comp.classes / 4) * 55 + Math.min(pw.length, 20) * 2.2);
    const uniqueScore = Math.min(100, (new Set(pw).size / pw.length) * 100);
    let score = Math.round(entropyScore * 0.5 + complexityScore * 0.28 + uniqueScore * 0.22 - penalty);
    score = Math.max(2, Math.min(100, score));

    let verdict = "CRITICAL";
    if (score >= 85) verdict = "HARDENED";
    else if (score >= 70) verdict = "RESISTANT";
    else if (score >= 50) verdict = "MODERATE";
    else if (score >= 30) verdict = "WEAK";
    else verdict = "CRITICAL";

    if (!findings.length) {
      findings.push({ t: "No cheap patterns detected", d: "Still treat reuse across sites as a critical failure — stuffing attacks ignore entropy." });
    }

    const recs = [];
    if (pw.length < 16) recs.push("Increase length: random 16+ chars or 4–6 uncommon words (diceware-style passphrase).");
    if (comp.classes < 3) recs.push("Mix character classes or, better, rely on length with a high-entropy generator.");
    if (isCommon(pw) || hasSequence(pw)) recs.push("Abandon memorable templates. Generate, do not invent.");
    recs.push("Never reuse this secret. Credential stuffing beats strong-but-recycled passwords.");
    recs.push("Store in a manager; unlock with a long master passphrase + MFA.");
    recs.push("Prefer passkeys where available — they remove shared secrets from the phishing path.");

    return {
      empty: false,
      score,
      verdict,
      entropy: entropyScore,
      complexity: complexityScore,
      uniqueness: uniqueScore,
      bits,
      shannon,
      guesses,
      composition: comp,
      findings,
      recs,
      length: pw.length
    };
  }

  const ATTACKS = [
    { id: "online-slow", name: "Online · throttled", rate: 100 / 3600, hint: "~100 guesses/hour" },
    { id: "online-fast", name: "Online · unthrottled", rate: 10, hint: "~10 guesses/sec" },
    { id: "offline-slow", name: "Offline · slow hash", rate: 1e4, hint: "bcrypt/argon2 class" },
    { id: "offline-fast", name: "Offline · fast hash / GPU", rate: 1e10, hint: "unsalted SHA/MD5 class" }
  ];

  function renderEmpty() {
    $("gauge-score").textContent = "--";
    $("gauge-fill").style.strokeDashoffset = "251.2";
    $("score-label").textContent = "STANDBY";
    $("verdict").textContent = "AWAITING SIGNAL";
    $("bar-entropy").style.width = "0%";
    $("bar-complex").style.width = "0%";
    $("bar-unique").style.width = "0%";
    render(analyze(""));
  }

  function tag(ok, warn) {
    if (ok) return { cls: "ok", label: "PASS" };
    if (warn) return { cls: "warn", label: "WARN" };
    return { cls: "bad", label: "FAIL" };
  }

  function render(r) {
    $("composition").innerHTML = [
      row("Length ≥ 12", r.empty ? tag(false) : tag(r.length >= 12, r.length >= 8), r.empty ? "—" : `${r.length} chars`),
      row("Lowercase", r.empty ? tag(false) : tag(r.composition.lower), r.composition.lower ? "detected" : "missing"),
      row("Uppercase", r.empty ? tag(false) : tag(r.composition.upper), r.composition.upper ? "detected" : "missing"),
      row("Digits", r.empty ? tag(false) : tag(r.composition.digit), r.composition.digit ? "detected" : "missing"),
      row("Symbols", r.empty ? tag(false) : tag(r.composition.symbol), r.composition.symbol ? "detected" : "missing"),
      row("Charset size", r.empty ? tag(false) : tag(r.composition.size >= 62, r.composition.size >= 36), r.empty ? "—" : String(r.composition.size))
    ].join("");

    $("attacks").innerHTML = ATTACKS.map((a) => {
      const seconds = r.empty ? 0 : r.guesses / 2 / a.rate;
      const t = r.empty ? "—" : formatTime(seconds);
      const cls = r.empty ? "neutral" : seconds > 31557600 * 100 ? "ok" : seconds > 86400 * 30 ? "warn" : "bad";
      return `<li><span>${a.name}<br><small class="mono">${a.hint}</small></span><span class="tag ${cls}">${t}</span></li>`;
    }).join("");

    $("findings").innerHTML = r.findings
      .map((f) => (typeof f === "string" ? `<li>${f}</li>` : `<li><strong>${f.t}</strong><br>${f.d}</li>`))
      .join("");

    $("recs").innerHTML = r.recs.map((x) => `<li>${x}</li>`).join("");

    $("metrics").innerHTML = [
      metric("EFFECTIVE BITS", r.empty ? "—" : r.bits.toFixed(1)),
      metric("SHANNON ENTROPY", r.empty ? "—" : `${r.shannon.toFixed(1)} bits`),
      metric("SEARCH SPACE", r.empty ? "—" : `~2^${Math.round(r.bits)}`),
      metric("GUESSES (ORDER)", r.empty ? "—" : formatGuesses(r.guesses))
    ].join("");

    if (!r.empty) {
      $("gauge-score").textContent = String(r.score);
      $("gauge-fill").style.strokeDashoffset = String(251.2 * (1 - r.score / 100));
      $("score-label").textContent = r.verdict;
      $("verdict").textContent = r.verdict;
      $("bar-entropy").style.width = `${Math.max(4, r.entropy)}%`;
      $("bar-complex").style.width = `${Math.max(4, r.complexity)}%`;
      $("bar-unique").style.width = `${Math.max(4, r.uniqueness)}%`;
      const color =
        r.score >= 70 ? "var(--mint)" : r.score >= 50 ? "var(--amber)" : "var(--red)";
      $("verdict").style.color = color;
    }
  }

  function row(label, t, value) {
    return `<li><span>${label}</span><span><span class="tag ${t.cls}">${t.label}</span> <span class="mono">${value}</span></span></li>`;
  }
  function metric(k, v) {
    return `<div class="metric"><div class="k">${k}</div><div class="v">${v}</div></div>`;
  }

  function generatePassword(len = 20) {
    const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*()-_=+[]{}";
    const bytes = new Uint32Array(len);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (n) => alphabet[n % alphabet.length]).join("");
  }

  passwordEl.addEventListener("input", () => {
    const r = analyze(passwordEl.value);
    if (r.empty) renderEmpty();
    else render(r);
  });

  toggleBtn.addEventListener("click", () => {
    const show = passwordEl.type === "password";
    passwordEl.type = show ? "text" : "password";
    toggleBtn.setAttribute("aria-pressed", String(show));
    toggleBtn.setAttribute("aria-label", show ? "Hide password" : "Show password");
    toggleBtn.querySelector("span").textContent = show ? "Hide" : "Show";
  });

  function fillGenerated() {
    passwordEl.type = "text";
    toggleBtn.setAttribute("aria-pressed", "true");
    toggleBtn.setAttribute("aria-label", "Hide password");
    toggleBtn.querySelector("span").textContent = "Hide";
    passwordEl.value = generatePassword();
    passwordEl.dispatchEvent(new Event("input"));
    passwordEl.focus();
  }

  generateBtn.addEventListener("click", fillGenerated);
  if (navGenerateBtn) navGenerateBtn.addEventListener("click", fillGenerated);

  clearBtn.addEventListener("click", () => {
    passwordEl.value = "";
    passwordEl.type = "password";
    toggleBtn.querySelector("span").textContent = "Show";
    renderEmpty();
    passwordEl.focus();
  });

  renderEmpty();
})();
