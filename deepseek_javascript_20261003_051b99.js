const fs = require('fs');
const path = require('path');

// ============================================================
// src/index.js
// ============================================================
const SRC_INDEX = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.includes('/api/') && request.method === 'POST') {
      return handleApi(request, env, url);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' }
  });
}

async function handleApi(request, env, url) {
  const path = url.pathname.replace(/\\/$/, '');

  if (!path.endsWith('/api/generate')) {
    return json({ error: 'Not found' }, 404);
  }

  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const { success } = await env.AI_RATE_LIMITER.limit({ key: 'creative:' + ip });

  if (!success) {
    return json({
      error: 'Too many requests. Please wait a minute and try again.',
      code: 'RATE_LIMITED'
    }, 429);
  }

  return handleGenerate(request, env);
}

const PRESETS = {
  tattoo: {
    geometric: 'Generate a black and white geometric lion tattoo design, fine line style, clean symmetry, on the specified body part. Tattoo art, high contrast, minimalist.',
    watercolor: 'Generate a watercolor-style tattoo design, soft color gradients, artistic brush strokes, on the specified body part. Tattoo art, expressive.',
    minimalist: 'Generate a minimalist single-line tattoo design, elegant, simple black ink, on the specified body part. Fine line tattoo.',
    traditional: 'Generate an American traditional tattoo design, bold outlines, classic color palette of red, yellow, and black, on the specified body part.',
    japanese: 'Generate a Japanese irezumi-style tattoo design, wave and koi elements, bold black outlines with colored fill, on the specified body part.',
    script: 'Generate a delicate script lettering tattoo design, elegant cursive, fine line black ink, on the specified body part.'
  },
  hairstyle: {
    short_messy: 'Change the hairstyle to a short, messy textured cut, dark brown color, natural lighting. Keep the same face and identity.',
    medium_wavy: 'Change the hairstyle to medium-length wavy hair, caramel brown, soft layers, natural lighting. Keep the same face and identity.',
    long_straight: 'Change the hairstyle to long, straight sleek hair, jet black, glossy finish, natural lighting. Keep the same face and identity.',
    buzz_cut: 'Change the hairstyle to a buzz cut, very short, dark color. Keep the same face and identity.',
    bob: 'Change the hairstyle to a chin-length bob, chestnut brown, blunt ends, natural lighting. Keep the same face and identity.',
    curly: 'Change the hairstyle to voluminous curly hair, natural afro texture, dark brown. Keep the same face and identity.',
    pixie: 'Change the hairstyle to a short pixie cut, light brown, textured, natural lighting. Keep the same face and identity.',
    ponytail: 'Change the hairstyle to a sleek high ponytail, dark brown, natural lighting. Keep the same face and identity.'
  }
};

async function handleGenerate(request, env) {
  try {
    const formData = await request.formData();
    const mode = formData.get('mode') || 'tattoo';
    const presetKey = formData.get('preset') || '';
    const customPrompt = (formData.get('prompt') || '').trim();
    const image0 = formData.get('image_0');
    const image1 = formData.get('image_1');

    let finalPrompt = '';

    if (mode === 'tattoo') {
      const preset = PRESETS.tattoo[presetKey] || PRESETS.tattoo.minimalist;
      finalPrompt = customPrompt ? customPrompt + '. ' + preset : preset;
    } else if (mode === 'hairstyle') {
      const preset = PRESETS.hairstyle[presetKey] || PRESETS.hairstyle.short_messy;
      finalPrompt = preset;
    } else if (mode === 'baby') {
      finalPrompt = 'Blend the facial features of the two people in the input images to generate a realistic baby portrait. Soft natural lighting, gentle expression, front-facing. Keep the baby looking like a natural blend of both parents.';
    } else {
      return json({ error: 'Invalid mode.' }, 400);
    }

    if (mode !== 'baby' && !image0 && !customPrompt) {
      return json({ error: 'Please provide a prompt or an image.' }, 400);
    }

    if (mode === 'baby' && (!image0 || !image1)) {
      return json({ error: 'Both parent photos are required for baby mode.' }, 400);
    }

    // 组装 multipart body
    const apiForm = new FormData();
    apiForm.append('prompt', finalPrompt);
    apiForm.append('width', '1024');
    apiForm.append('height', '1024');

    if (image0 && image0 instanceof File) {
      const buf0 = await image0.arrayBuffer();
      apiForm.append('input_image_0', new File([buf0], 'input_0.png', { type: 'image/png' }));
    }
    if (image1 && image1 instanceof File) {
      const buf1 = await image1.arrayBuffer();
      apiForm.append('input_image_1', new File([buf1], 'input_1.png', { type: 'image/png' }));
    }

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-klein-9b', {
      multipart: {
        body: new Response(apiForm).body,
        contentType: new Response(apiForm).headers.get('content-type')
      }
    });

    if (!response || !response.image) {
      console.error('No image in response:', response);
      return json({ error: 'Generation failed. Please try again.' }, 500);
    }

    return json({ image: response.image });
  } catch (err) {
    console.error('Generate error:', err);
    return json({ error: 'Processing failed. Please try again in a moment.' }, 500);
  }
}
`;

// ============================================================
// public/index.html
// ============================================================
const INDEX_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AI Creative Generator — Tattoo, Baby & Hairstyle Preview (Free)</title>
<meta name="description" content="Free AI creative generator. Preview tattoos, imagine your future baby, or try on new hairstyles — all from a single upload. Powered by Cloudflare Workers AI.">
<meta name="keywords" content="ai tattoo generator, ai baby generator, hairstyle changer, ai face editor, virtual makeover">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="theme-color" content="#7c3aed">

<link rel="canonical" href="https://toolara.dev/ai-creative-generator/">
<link rel="alternate" hreflang="en" href="https://toolara.dev/ai-creative-generator/">
<link rel="alternate" hreflang="zh-Hans" href="https://toolara.dev/ai-creative-generator/zh/">
<link rel="alternate" hreflang="x-default" href="https://toolara.dev/ai-creative-generator/">

<meta property="og:type" content="website">
<meta property="og:title" content="AI Creative Generator — Tattoo, Baby & Hairstyle Preview">
<meta property="og:description" content="Preview tattoos, imagine your future baby, or try on new hairstyles.">
<meta property="og:url" content="https://toolara.dev/ai-creative-generator/">

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "AI Creative Generator",
  "url": "https://toolara.dev/ai-creative-generator/",
  "applicationCategory": "UtilityApplication",
  "operatingSystem": "Any",
  "description": "Free AI tool for tattoo preview, baby prediction, and hairstyle simulation.",
  "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" }
}
<\/script>

<link rel="stylesheet" href="css/style.css">
</head>
<body>

<header class="hero">
  <div class="lang-switch">
    <select id="langSelect" onchange="setLang(this.value)" aria-label="Language">
      <option value="en">English</option>
      <option value="zh">简体中文</option>
    </select>
  </div>
  <div class="hero-inner">
    <div class="hero-badge">🎨 AI-powered</div>
    <h1 data-i18n="title">AI Creative Generator</h1>
    <p data-i18n="subtitle">Preview tattoos, imagine your future baby, or try on new hairstyles — all from one upload.</p>
  </div>
</header>

<main class="wrap">
  <section class="card">
    <h2 class="visually-hidden" data-i18n="calcHeading">Creative generator</h2>

    <div class="mode-tabs">
      <button class="mode-tab active" data-mode="tattoo" onclick="switchMode('tattoo')" data-i18n="modeTattoo">🎨 Tattoo</button>
      <button class="mode-tab" data-mode="baby" onclick="switchMode('baby')" data-i18n="modeBaby">👶 Baby</button>
      <button class="mode-tab" data-mode="hairstyle" onclick="switchMode('hairstyle')" data-i18n="modeHair">💇 Hairstyle</button>
    </div>

    <!-- Tattoo -->
    <div id="mode-tattoo" class="mode-panel">
      <p class="mode-desc" data-i18n="descTattoo">Upload a body photo (optional) and pick a tattoo style.</p>

      <label data-i18n="uploadOptional">Body photo (optional)</label>
      <div class="upload-zone" id="uploadZoneTattoo">
        <input type="file" id="fileTattoo" accept="image/*" style="display:none;">
        <div class="upload-content">
          <div class="upload-icon">📁</div>
          <div class="upload-text" data-i18n="uploadClick">Click to upload or drag here</div>
          <div class="upload-hint" data-i18n="uploadHint">JPG or PNG · Max 5MB</div>
        </div>
      </div>
      <div class="preview" id="previewTattoo" style="display:none;">
        <img id="previewImgTattoo" alt="Preview">
        <button class="remove-btn" onclick="clearImage('tattoo')">✕</button>
      </div>

      <label data-i18n="styleLabel">Tattoo style</label>
      <div class="preset-grid" id="tattooPresets">
        <button class="preset-btn active" data-preset="minimalist">Minimalist</button>
        <button class="preset-btn" data-preset="geometric">Geometric</button>
        <button class="preset-btn" data-preset="watercolor">Watercolor</button>
        <button class="preset-btn" data-preset="traditional">Traditional</button>
        <button class="preset-btn" data-preset="japanese">Japanese</button>
        <button class="preset-btn" data-preset="script">Script</button>
      </div>

      <label for="promptTattoo" data-i18n="promptOptional">Custom description (optional)</label>
      <input type="text" id="promptTattoo" placeholder="e.g. A lion with geometric shapes">
    </div>

    <!-- Baby -->
    <div id="mode-baby" class="mode-panel" style="display:none;">
      <p class="mode-desc" data-i18n="descBaby">Upload photos of both parents to imagine a future baby.</p>

      <label data-i18n="parent1">Parent 1 photo</label>
      <div class="upload-zone" id="uploadZoneBaby1">
        <input type="file" id="fileBaby1" accept="image/*" style="display:none;">
        <div class="upload-content">
          <div class="upload-icon">👤</div>
          <div class="upload-text" data-i18n="uploadClick">Click to upload</div>
        </div>
      </div>
      <div class="preview" id="previewBaby1" style="display:none;">
        <img id="previewImgBaby1" alt="Parent 1">
        <button class="remove-btn" onclick="clearImage('baby1')">✕</button>
      </div>

      <label data-i18n="parent2">Parent 2 photo</label>
      <div class="upload-zone" id="uploadZoneBaby2">
        <input type="file" id="fileBaby2" accept="image/*" style="display:none;">
        <div class="upload-content">
          <div class="upload-icon">👤</div>
          <div class="upload-text" data-i18n="uploadClick">Click to upload</div>
        </div>
      </div>
      <div class="preview" id="previewBaby2" style="display:none;">
        <img id="previewImgBaby2" alt="Parent 2">
        <button class="remove-btn" onclick="clearImage('baby2')">✕</button>
      </div>
    </div>

    <!-- Hairstyle -->
    <div id="mode-hairstyle" class="mode-panel" style="display:none;">
      <p class="mode-desc" data-i18n="descHair">Upload a selfie and pick a hairstyle to try on.</p>

      <label data-i18n="selfieLabel">Your photo</label>
      <div class="upload-zone" id="uploadZoneHair">
        <input type="file" id="fileHair" accept="image/*" style="display:none;">
        <div class="upload-content">
          <div class="upload-icon">📁</div>
          <div class="upload-text" data-i18n="uploadClick">Click to upload or drag here</div>
          <div class="upload-hint" data-i18n="uploadHint">Front-facing portrait works best</div>
        </div>
      </div>
      <div class="preview" id="previewHair" style="display:none;">
        <img id="previewImgHair" alt="Preview">
        <button class="remove-btn" onclick="clearImage('hair')">✕</button>
      </div>

      <label data-i18n="hairStyleLabel">Choose a hairstyle</label>
      <div class="preset-grid" id="hairPresets">
        <button class="preset-btn active" data-preset="short_messy">Short messy</button>
        <button class="preset-btn" data-preset="medium_wavy">Medium wavy</button>
        <button class="preset-btn" data-preset="long_straight">Long straight</button>
        <button class="preset-btn" data-preset="buzz_cut">Buzz cut</button>
        <button class="preset-btn" data-preset="bob">Bob</button>
        <button class="preset-btn" data-preset="curly">Curly</button>
        <button class="preset-btn" data-preset="pixie">Pixie</button>
        <button class="preset-btn" data-preset="ponytail">Ponytail</button>
      </div>
    </div>

    <button class="calc" type="button" id="generateBtn" onclick="generate()" data-i18n="calcBtn">Generate</button>

    <div id="loading" class="loading" style="display:none;">
      <div class="spinner"></div>
      <div data-i18n="loadingText">Generating your image... (10-30 seconds)</div>
    </div>

    <div id="error" class="error" style="display:none;"></div>

    <div id="result" role="region" aria-live="polite">
      <div class="result-header">
        <div class="result-label" data-i18n="resultLabel">Result</div>
        <button class="copy-btn" type="button" onclick="downloadResult()" data-i18n="downloadBtn">Download</button>
      </div>
      <div class="result-preview">
        <img id="resultImg" alt="Result">
      </div>
      <div class="result-disclaimer" data-i18n="resultDisclaimer">AI-generated image. Results are for entertainment only. Baby predictions have no medical or genetic basis.</div>
    </div>
  </section>

  <section>
    <h2 data-i18n="whatIsTitle">What can you create?</h2>
    <ul>
      <li data-i18n="use1"><strong>Tattoo preview</strong> — Upload a body photo or start from scratch, pick a style, and see how a tattoo would look.</li>
      <li data-i18n="use2"><strong>Baby prediction</strong> — Upload two parent photos and get an AI-imagined baby portrait. For fun only.</li>
      <li data-i18n="use3"><strong>Hairstyle try-on</strong> — Upload a selfie and preview 8 different hairstyles before committing.</li>
    </ul>
  </section>

  <section>
    <h2 data-i18n="faqTitle">Frequently asked questions</h2>
    <h3 data-i18n="faq1q">Is this tool free?</h3>
    <p data-i18n="faq1a">Yes. It runs on Cloudflare Workers AI with a free daily quota. Normal use won't hit limits.</p>

    <h3 data-i18n="faq2q">Are my photos stored?</h3>
    <p data-i18n="faq2a">No. Photos are processed in memory and discarded immediately after the result is generated. Nothing is stored, logged, or used for training.</p>

    <h3 data-i18n="faq3q">Is the baby prediction accurate?</h3>
    <p data-i18n="faq3a">No. Baby prediction is purely for entertainment. It does not use genetics and has no medical or scientific basis. It simply blends facial features in a visually plausible way.</p>

    <h3 data-i18n="faq4q">Why does generation take 10-30 seconds?</h3>
    <p data-i18n="faq4a">Image generation is computationally intensive. The model runs on Cloudflare's GPU infrastructure, and the time depends on load. Most generations complete in 10-20 seconds.</p>

    <h3 data-i18n="faq5q">What image format works best?</h3>
    <p data-i18n="faq5a">Clear, well-lit photos with the face or body part clearly visible. Front-facing portraits work best for hairstyle and baby modes. Avoid blurry, low-light, or heavily filtered images.</p>

    <div class="disclaimer" data-i18n="disclaimer"><strong>Note:</strong> AI-generated images are for entertainment purposes only. Do not use them to make medical, cosmetic, or personal decisions.</div>
  </section>
</main>

<footer class="footer" data-i18n="footer">Runs on Cloudflare Workers AI. Your photos are not stored.</footer>

<script src="js/i18n.js"><\/script>
<script src="js/app.js"><\/script>
</body>
</html>`;

// ============================================================
// public/css/style.css
// ============================================================
const STYLE_CSS = `:root {
  --bg: #faf7fc; --card: #ffffff; --text: #1a1625; --muted: #6b6478;
  --accent: #7c3aed; --accent-dark: #6d28d9; --navy: #4c1d95;
  --border: #ebe3f5; --radius: 14px;
  --shadow: 0 1px 3px rgba(26,22,37,0.05), 0 8px 24px rgba(124,58,237,0.08);
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; }
body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", Roboto, sans-serif; background: var(--bg); color: var(--text); line-height: 1.65; -webkit-font-smoothing: antialiased; }
.visually-hidden { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }

.hero {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 64px 20px 96px;
  background:
    radial-gradient(circle at 20% 20%, rgba(244,114,182,0.35) 0%, transparent 50%),
    radial-gradient(circle at 80% 80%, rgba(124,58,237,0.40) 0%, transparent 55%),
    linear-gradient(135deg, #2e1065 0%, #4c1d95 50%, #7c3aed 100%);
}
.hero::before {
  content: "";
  position: absolute; inset: 0;
  background-image: radial-gradient(rgba(255,255,255,0.07) 1.5px, transparent 1.5px);
  background-size: 30px 30px;
  opacity: 0.6;
  pointer-events: none;
}
.hero-inner { max-width: 720px; margin: 0 auto; position: relative; z-index: 2; text-align: center; }
.hero-badge {
  display: inline-block;
  background: rgba(244,114,182,0.20);
  border: 1px solid rgba(244,114,182,0.45);
  color: #fbcfe8;
  padding: 5px 14px;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  margin-bottom: 18px;
}
.hero h1 { font-size: 2.1rem; margin: 0 0 12px; font-weight: 800; letter-spacing: -0.02em; }
.hero p { margin: 0 auto; opacity: 0.92; font-size: 1rem; max-width: 560px; }

.lang-switch { position: absolute; top: 16px; right: 16px; z-index: 3; }
.lang-switch select {
  appearance: none; -webkit-appearance: none;
  background-color: rgba(255,255,255,0.15);
  background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
  background-repeat: no-repeat; background-position: right 10px center; background-size: 14px;
  border: 1px solid rgba(255,255,255,0.3);
  color: #fff; padding: 7px 32px 7px 12px; border-radius: 8px;
  font-size: 0.85rem; font-family: inherit; cursor: pointer;
}
.lang-switch select:hover { background-color: rgba(255,255,255,0.28); }
.lang-switch select option { color: #1a1625; background: #fff; }

.wrap { max-width: 720px; margin: -56px auto 0; padding: 0 20px 64px; position: relative; z-index: 2; }
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; margin-bottom: 22px; box-shadow: var(--shadow); }

/* Mode tabs */
.mode-tabs { display: flex; gap: 8px; margin-bottom: 22px; background: #f3e8ff; padding: 4px; border-radius: 10px; }
.mode-tab { flex: 1; padding: 12px 8px; border: none; background: transparent; color: var(--muted); border-radius: 8px; font-size: 0.88rem; font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit; }
.mode-tab.active { background: #fff; color: var(--navy); box-shadow: 0 1px 3px rgba(26,22,37,0.08); }
.mode-tab:hover:not(.active) { color: var(--navy); }

.mode-panel { margin-bottom: 18px; }
.mode-desc { font-size: 0.88rem; color: var(--muted); margin: 0 0 16px; }

label { display: block; font-weight: 600; font-size: 0.85rem; margin-bottom: 6px; }
input[type="text"], input[type="number"], select, textarea { width: 100%; padding: 11px 13px; border: 1px solid #cbd5e1; border-radius: 9px; font-size: 1rem; margin-bottom: 18px; background: #fff; color: var(--text); transition: border-color 0.15s, box-shadow 0.15s; font-family: inherit; }
input:focus, select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(124,58,237,0.15); }

/* Upload zone */
.upload-zone {
  border: 2px dashed #c4b5fd;
  border-radius: 12px;
  padding: 28px 20px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  background: #faf7fc;
  margin-bottom: 18px;
}
.upload-zone:hover, .upload-zone.dragover {
  border-color: var(--accent);
  background: #f3e8ff;
}
.upload-icon { font-size: 1.8rem; margin-bottom: 6px; }
.upload-text { font-weight: 600; color: var(--navy); font-size: 0.92rem; margin-bottom: 4px; }
.upload-hint { font-size: 0.78rem; color: var(--muted); }

/* Preview */
.preview { position: relative; margin-bottom: 18px; }
.preview img { width: 100%; max-height: 240px; object-fit: contain; border-radius: 10px; border: 1px solid var(--border); background: #f8fafc; }
.remove-btn { position: absolute; top: 8px; right: 8px; width: 28px; height: 28px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #fff; border: none; cursor: pointer; font-size: 0.9rem; line-height: 1; }
.remove-btn:hover { background: #dc2626; }

/* Preset grid */
.preset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 8px; margin-bottom: 18px; }
.preset-btn {
  padding: 10px 8px;
  border: 1px solid var(--border);
  background: #fff;
  color: var(--text);
  border-radius: 9px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.preset-btn:hover { border-color: var(--accent); color: var(--navy); }
.preset-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

button.calc { width: 100%; padding: 15px; background: var(--accent); color: #fff; border: none; border-radius: 9px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: background 0.15s; font-family: inherit; }
button.calc:hover:not(:disabled) { background: var(--accent-dark); }
button.calc:disabled { opacity: 0.6; cursor: not-allowed; }

.loading { display: flex; align-items: center; gap: 12px; padding: 16px; margin-top: 20px; font-size: 0.9rem; color: var(--accent); font-weight: 500; }
.spinner { width: 20px; height: 20px; border: 2.5px solid rgba(124,58,237,0.2); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.error { margin-top: 20px; padding: 14px 16px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; color: #b91c1c; font-size: 0.9rem; }

#result { margin-top: 24px; padding: 24px; border-radius: 14px; background: linear-gradient(135deg, #f3e8ff 0%, #faf7fc 100%); border: 2px solid var(--accent); display: none; animation: fadeIn 0.35s ease; }
#result.show { display: block; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

.result-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
.result-label { font-size: 0.78rem; text-transform: uppercase; letter-spacing: 0.07em; font-weight: 700; color: var(--accent); }
.copy-btn { padding: 8px 16px; background: var(--accent); border: none; color: #fff; border-radius: 8px; font-size: 0.82rem; font-weight: 600; cursor: pointer; font-family: inherit; }
.copy-btn:hover { background: var(--accent-dark); }

.result-preview { text-align: center; background: #fff; border: 1px solid var(--border); border-radius: 10px; padding: 12px; }
.result-preview img { max-width: 100%; border-radius: 8px; }

.result-disclaimer { margin-top: 14px; padding-top: 12px; border-top: 1px solid rgba(124,58,237,0.15); font-size: 0.78rem; color: var(--muted); }

h2 { font-size: 1.25rem; margin: 36px 0 12px; letter-spacing: -0.01em; }
h3 { font-size: 1rem; margin: 22px 0 6px; }
p { margin: 0 0 14px; }
ul, ol { margin: 0 0 16px; padding-left: 22px; }
li { margin-bottom: 8px; line-height: 1.65; }
.disclaimer { font-size: 0.85rem; color: var(--muted); border-left: 3px solid var(--accent); padding: 4px 0 4px 14px; margin-top: 18px; }
.footer { text-align: center; font-size: 0.8rem; color: var(--muted); padding: 24px 20px 48px; }

@media (max-width: 560px) {
  .hero { padding: 48px 16px 80px; }
  .hero h1 { font-size: 1.5rem; }
  .lang-switch { position: static; display: flex; justify-content: center; margin-bottom: 16px; }
  .wrap { padding: 0 14px 48px; }
  .card { padding: 20px; }
  .mode-tabs { flex-direction: column; }
  .preset-grid { grid-template-columns: repeat(2, 1fr); }
}`;

// ============================================================
// public/js/i18n.js
// ============================================================
const I18N_JS = `const SUPPORTED_LANGS = ['en','zh'];
const DEFAULT_LANG = 'en';
const MARKER = '/ai-creative-generator';

const LANG_TO_PATH = { 'en':'/', 'zh':'/zh/' };
const SEG_TO_LANG = { 'zh':'zh' };

let currentLang = DEFAULT_LANG;
let translations = {};
const cache = {};

function getBase() {
  const p = window.location.pathname;
  const idx = p.indexOf(MARKER);
  if (idx !== -1) return p.slice(0, idx + MARKER.length);
  return '';
}

function detectPageLang() {
  if (window.__FORCE_LANG__ && SUPPORTED_LANGS.includes(window.__FORCE_LANG__)) return window.__FORCE_LANG__;
  const p = window.location.pathname;
  const base = getBase();
  const rest = base ? p.slice(base.length) : p;
  const segs = rest.split('/').filter(Boolean);
  if (segs.length > 0) {
    const first = segs[0].toLowerCase();
    if (SEG_TO_LANG[first]) return SEG_TO_LANG[first];
  }
  return DEFAULT_LANG;
}

async function loadLocale(lang) {
  if (cache[lang]) return cache[lang];
  const base = getBase();
  const res = await fetch(base + '/locales/' + lang + '.json');
  if (!res.ok) throw new Error('Failed to load locale: ' + lang);
  const data = await res.json();
  cache[lang] = data;
  return data;
}

function applyTranslations(t) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (t[key] === undefined) return;
    if (key === 'disclaimer') el.innerHTML = t[key];
    else el.textContent = t[key];
  });
}

async function initPage() {
  const lang = detectPageLang();
  try { translations = await loadLocale(lang); }
  catch (err) { console.error(err); return; }
  currentLang = lang;
  document.documentElement.lang = lang === 'zh' ? 'zh-Hans' : lang;
  applyTranslations(translations);
  const select = document.getElementById('langSelect');
  if (select) select.value = lang;
  window.__i18n = { t: translations, lang: currentLang, base: getBase() };
}

function setLang(lang) {
  if (!SUPPORTED_LANGS.includes(lang)) lang = DEFAULT_LANG;
  const base = getBase();
  window.location.href = base + (LANG_TO_PATH[lang] || '/');
}

document.addEventListener('DOMContentLoaded', initPage);`;

// ============================================================
// public/js/app.js
// ============================================================
const APP_JS = `let currentMode = 'tattoo';
let files = { tattoo: null, baby1: null, baby2: null, hair: null };
let presets = { tattoo: 'minimalist', hair: 'short_messy' };

function t() { return (window.__i18n && window.__i18n.t) || {}; }
function base() { return (window.__i18n && window.__i18n.base) || ''; }

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-tab').forEach(t => t.classList.toggle('active', t.dataset.mode === mode));
  document.querySelectorAll('.mode-panel').forEach(p => p.style.display = 'none');
  document.getElementById('mode-' + mode).style.display = 'block';
  document.getElementById('result').classList.remove('show');
  document.getElementById('error').style.display = 'none';
}

// 通用上传绑定
function setupUpload(zoneId, inputId, fileKey, previewId, imgId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  const img = document.getElementById(imgId);

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f, fileKey, preview, img);
  });
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (f) handleFile(f, fileKey, preview, img);
  });
}

async function handleFile(file, key, previewEl, imgEl) {
  const tr = t();
  if (!file.type.startsWith('image/')) {
    showError(tr.errType || 'Please upload an image.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError(tr.errSize || 'Image must be under 5MB.');
    return;
  }

  // 压缩到 512x512 以内
  const compressed = await compressImage(file, 512);
  files[key] = compressed;
  imgEl.src = URL.createObjectURL(compressed);
  previewEl.style.display = 'block';
}

function compressImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = (height / width) * maxSize; width = maxSize; }
          else { width = (width / height) * maxSize; height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          resolve(new File([blob], 'image.png', { type: 'image/png' }));
        }, 'image/png');
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function clearImage(key) {
  files[key] = null;
  const map = {
    tattoo: ['previewTattoo'],
    baby1: ['previewBaby1'],
    baby2: ['previewBaby2'],
    hair: ['previewHair']
  };
  const previewId = map[key][0];
  document.getElementById(previewId).style.display = 'none';
}

// 预设按钮绑定
document.addEventListener('DOMContentLoaded', () => {
  setupUpload('uploadZoneTattoo', 'fileTattoo', 'tattoo', 'previewTattoo', 'previewImgTattoo');
  setupUpload('uploadZoneBaby1', 'fileBaby1', 'baby1', 'previewBaby1', 'previewImgBaby1');
  setupUpload('uploadZoneBaby2', 'fileBaby2', 'baby2', 'previewBaby2', 'previewImgBaby2');
  setupUpload('uploadZoneHair', 'fileHair', 'hair', 'previewHair', 'previewImgHair');

  document.querySelectorAll('#tattooPresets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#tattooPresets .preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      presets.tattoo = btn.dataset.preset;
    });
  });
  document.querySelectorAll('#hairPresets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#hairPresets .preset-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      presets.hair = btn.dataset.preset;
    });
  });
});

async function generate() {
  const tr = t();
  const btn = document.getElementById('generateBtn');
  const loadingEl = document.getElementById('loading');
  const errorEl = document.getElementById('error');
  const resultEl = document.getElementById('result');

  errorEl.style.display = 'none';
  resultEl.classList.remove('show');

  const formData = new FormData();
  formData.append('mode', currentMode);

  if (currentMode === 'tattoo') {
    if (!files.tattoo && !document.getElementById('promptTattoo').value.trim()) {
      showError(tr.errTattoo || 'Please upload a photo or enter a description.');
      return;
    }
    if (files.tattoo) formData.append('image_0', files.tattoo);
    formData.append('preset', presets.tattoo);
    formData.append('prompt', document.getElementById('promptTattoo').value.trim());
  } else if (currentMode === 'baby') {
    if (!files.baby1 || !files.baby2) {
      showError(tr.errBaby || 'Please upload both parent photos.');
      return;
    }
    formData.append('image_0', files.baby1);
    formData.append('image_1', files.baby2);
  } else if (currentMode === 'hairstyle') {
    if (!files.hair) {
      showError(tr.errHair || 'Please upload a selfie.');
      return;
    }
    formData.append('image_0', files.hair);
    formData.append('preset', presets.hair);
  }

  btn.disabled = true;
  loadingEl.style.display = 'flex';

  try {
    const res = await fetch(base() + '/api/generate', {
      method: 'POST',
      body: formData
    });

    if (res.status === 429) {
      showError(tr.errRateLimit || 'Too many requests. Please wait a minute.');
      return;
    }

    const data = await res.json();
    if (!res.ok || !data.image) {
      showError(data.error || (tr.errGeneric || 'Generation failed.'));
      return;
    }

    document.getElementById('resultImg').src = 'data:image/png;base64,' + data.image;
    resultEl.classList.add('show');
  } catch (err) {
    console.error(err);
    showError(tr.errNetwork || 'Network error. Please try again.');
  } finally {
    btn.disabled = false;
    loadingEl.style.display = 'none';
  }
}

function downloadResult() {
  const img = document.getElementById('resultImg');
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'ai-creative-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showError(msg) {
  const el = document.getElementById('error');
  el.textContent = msg;
  el.style.display = 'block';
}

window.switchMode = switchMode;
window.generate = generate;
window.downloadResult = downloadResult;
window.clearImage = clearImage;`;

// ============================================================
// public/locales/*.json
// ============================================================
const LOCALES = {
  'en': {
    title: "AI Creative Generator",
    subtitle: "Preview tattoos, imagine your future baby, or try on new hairstyles — all from one upload.",
    calcHeading: "Creative generator",
    modeTattoo: "🎨 Tattoo",
    modeBaby: "👶 Baby",
    modeHair: "💇 Hairstyle",
    descTattoo: "Upload a body photo (optional) and pick a tattoo style.",
    descBaby: "Upload photos of both parents to imagine a future baby.",
    descHair: "Upload a selfie and pick a hairstyle to try on.",
    uploadOptional: "Body photo (optional)",
    uploadClick: "Click to upload or drag here",
    uploadHint: "JPG or PNG · Max 5MB",
    selfieLabel: "Your photo",
    parent1: "Parent 1 photo",
    parent2: "Parent 2 photo",
    styleLabel: "Tattoo style",
    hairStyleLabel: "Choose a hairstyle",
    promptOptional: "Custom description (optional)",
    calcBtn: "Generate",
    loadingText: "Generating your image... (10-30 seconds)",
    resultLabel: "Result",
    downloadBtn: "Download",
    resultDisclaimer: "AI-generated image. Results are for entertainment only. Baby predictions have no medical or genetic basis.",
    whatIsTitle: "What can you create?",
    use1: "Tattoo preview — Upload a body photo or start from scratch, pick a style, and see how a tattoo would look.",
    use2: "Baby prediction — Upload two parent photos and get an AI-imagined baby portrait. For fun only.",
    use3: "Hairstyle try-on — Upload a selfie and preview 8 different hairstyles before committing.",
    faqTitle: "Frequently asked questions",
    faq1q: "Is this tool free?",
    faq1a: "Yes. It runs on Cloudflare Workers AI with a free daily quota. Normal use won't hit limits.",
    faq2q: "Are my photos stored?",
    faq2a: "No. Photos are processed in memory and discarded immediately after the result is generated. Nothing is stored, logged, or used for training.",
    faq3q: "Is the baby prediction accurate?",
    faq3a: "No. Baby prediction is purely for entertainment. It does not use genetics and has no medical or scientific basis. It simply blends facial features in a visually plausible way.",
    faq4q: "Why does generation take 10-30 seconds?",
    faq4a: "Image generation is computationally intensive. The model runs on Cloudflare's GPU infrastructure, and the time depends on load. Most generations complete in 10-20 seconds.",
    faq5q: "What image format works best?",
    faq5a: "Clear, well-lit photos with the face or body part clearly visible. Front-facing portraits work best for hairstyle and baby modes. Avoid blurry, low-light, or heavily filtered images.",
    disclaimer: "<strong>Note:</strong> AI-generated images are for entertainment purposes only. Do not use them to make medical, cosmetic, or personal decisions.",
    footer: "Runs on Cloudflare Workers AI. Your photos are not stored.",
    errType: "Please upload an image.",
    errSize: "Image must be under 5MB.",
    errTattoo: "Please upload a photo or enter a description.",
    errBaby: "Please upload both parent photos.",
    errHair: "Please upload a selfie.",
    errGeneric: "Generation failed. Please try again.",
    errNetwork: "Network error. Please try again.",
    errRateLimit: "Too many requests. Please wait a minute."
  },
  'zh': {
    title: "AI 创意生成器",
    subtitle: "预览纹身、想象未来的宝宝，或试戴新发型——一次上传，多种玩法。",
    calcHeading: "创意生成",
    modeTattoo: "🎨 纹身",
    modeBaby: "👶 宝宝",
    modeHair: "💇 发型",
    descTattoo: "上传一张身体照（可选），选择纹身风格。",
    descBaby: "上传父母双方的照片，想象未来宝宝的样子。",
    descHair: "上传一张自拍，选择想要试戴的发型。",
    uploadOptional: "身体照（可选）",
    uploadClick: "点击上传或拖拽到此处",
    uploadHint: "JPG 或 PNG · 最大 5MB",
    selfieLabel: "你的照片",
    parent1: "父母一方照片",
    parent2: "父母另一方照片",
    styleLabel: "纹身风格",
    hairStyleLabel: "选择发型",
    promptOptional: "自定义描述（可选）",
    calcBtn: "生成",
    loadingText: "正在生成图片…（10-30 秒）",
    resultLabel: "结果",
    downloadBtn: "下载",
    resultDisclaimer: "AI 生成的图片，仅供娱乐。宝宝预测不具备医学或遗传学依据。",
    whatIsTitle: "你能生成什么？",
    use1: "纹身预览——上传身体照或从零开始，选择风格，看看纹身效果。",
    use2: "宝宝预测——上传两张父母照片，获得 AI 想象的宝宝画像。仅供娱乐。",
    use3: "发型试戴——上传自拍，预览 8 种不同发型再做决定。",
    faqTitle: "常见问题",
    faq1q: "这个工具免费吗？",
    faq1a: "免费。运行在 Cloudflare Workers AI 上，每天有充裕的免费额度。正常使用不会触达限制。",
    faq2q: "照片会被存储吗？",
    faq2a: "不会。照片在内存中处理，返回结果后立即丢弃。不存储、不记录、不用于训练。",
    faq3q: "宝宝预测准确吗？",
    faq3a: "不准确。宝宝预测纯属娱乐，不使用遗传学，没有医学或科学依据。它只是以视觉上合理的方式融合面部特征。",
    faq4q: "为什么生成需要 10-30 秒？",
    faq4a: "图片生成计算量较大。模型运行在 Cloudflare 的 GPU 基础设施上，耗时取决于负载。多数生成在 10-20 秒内完成。",
    faq5q: "什么样的图片效果最好？",
    faq5a: "清晰、光照良好的照片，面部或身体部位清晰可见。正脸肖像最适合发型和宝宝模式。避免模糊、低光或重度滤镜的照片。",
    disclaimer: "<strong>注意：</strong>AI 生成的图片仅供娱乐。请勿用于医学、美容或个人决策。",
    footer: "运行在 Cloudflare Workers AI 上。你的照片不会被存储。",
    errType: "请上传一张图片。",
    errSize: "图片必须小于 5MB。",
    errTattoo: "请上传照片或输入描述。",
    errBaby: "请上传父母双方的照片。",
    errHair: "请上传一张自拍。",
    errGeneric: "生成失败，请重试。",
    errNetwork: "网络错误，请重试。",
    errRateLimit: "请求过于频繁，请稍等一分钟。"
  }
};

// ============================================================
// wrangler.toml
// ============================================================
const WRANGLER_TOML = `name = "ai-creative-generator"
main = "src/index.js"
compatibility_date = "2026-09-27"

[ai]
binding = "AI"

[assets]
directory = "./public"
binding = "ASSETS"
not_found_handling = "single-page-application"
html_handling = "none"
run_worker_first = ["/*"]

[[ratelimits]]
name = "AI_RATE_LIMITER"
namespace_id = "1008"
simple = { limit = 20, period = 60 }
`;

const PACKAGE_JSON = `{
  "name": "ai-creative-generator",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "deploy": "wrangler deploy",
    "dev": "wrangler dev"
  },
  "devDependencies": {
    "wrangler": "^4.0.0"
  }
}
`;

const GITIGNORE = `node_modules/
.wrangler/
.dev.vars
.DS_Store
*.log
.vscode/
.idea/
dist/
build/
`;

const README_MD = `# AI Creative Generator

A Cloudflare Worker that generates AI images for tattoo preview, baby prediction, and hairstyle try-on, using Workers AI (FLUX.2 klein 9B).

## Features

- Three modes: tattoo, baby, hairstyle
- Supports up to 2 input images per request
- Frontend compresses images to 512x512 before upload
- Runs on Cloudflare Workers AI — no API keys
- Built-in rate limiting (20 requests/min per IP)
- Photos are not stored
- Multi-language interface (EN + ZH)

## Setup

\`\`\`bash
npm install
npx wrangler login
npx wrangler deploy
\`\`\`

## Routes

Add to \`tool-proxy\`:
- \`toolara.dev/ai-creative-generator/*\`
- \`www.toolara.dev/ai-creative-generator/*\`

## License

MIT
`;

// ============================================================
// 生成文件
// ============================================================
const files = {
  'src/index.js': SRC_INDEX,
  'public/index.html': INDEX_HTML,
  'public/css/style.css': STYLE_CSS,
  'public/js/i18n.js': I18N_JS,
  'public/js/app.js': APP_JS,
  'public/locales/en.json': JSON.stringify(LOCALES.en, null, 2),
  'public/locales/zh.json': JSON.stringify(LOCALES.zh, null, 2),
  'wrangler.toml': WRANGLER_TOML,
  'package.json': PACKAGE_JSON,
  '.gitignore': GITIGNORE,
  'README.md': README_MD,
};

const root = '.';
let count = 0;
for (const [filePath, content] of Object.entries(files)) {
  const fullPath = path.join(root, filePath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(fullPath, content, 'utf8');
  console.log('Created: ' + filePath);
  count++;
}

console.log(`\nDone. ${count} files generated.`);
console.log('\nNext steps:');
console.log('  1. npm install');
console.log('  2. npx wrangler@latest deploy');
console.log('  3. In tool-proxy/src/index.js PROXY_MAP, add:');
console.log('     \'/ai-creative-generator\': \'https://ai-creative-generator.lvyafei2026.workers.dev\'');
console.log('  4. In tool-proxy/wrangler.toml run_worker_first, add:');
console.log('     "/ai-creative-generator/*"');
console.log('  5. In Cloudflare tool-proxy Domains & Routes, add:');
console.log('     toolara.dev/ai-creative-generator/*');
console.log('     www.toolara.dev/ai-creative-generator/*');
console.log('  6. Update tool-proxy/public/sitemap.xml and index.html');