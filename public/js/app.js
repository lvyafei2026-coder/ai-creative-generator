let currentMode = 'tattoo';
let files = { tattoo: null, baby1: null, baby2: null, hair: null };
let presets = { tattoo: 'minimalist', hair: 'short_messy' };

const stage = document.getElementById('stage');
const sampleImg = document.getElementById('sampleImg');
const sampleTag = document.getElementById('sampleTag');
const resultImg = document.getElementById('resultImg');
const generateBtn = document.getElementById('generateBtn');
const errorEl = document.getElementById('error');
const previewHint = document.getElementById('previewHint');
const loadingHint = document.getElementById('loadingHint');
const resultBar = document.getElementById('resultBar');
const resultDisclaimer = document.getElementById('resultDisclaimer');

const stageStates = ['examples', 'preview', 'loading', 'result'];

function t() { return (window.__i18n && window.__i18n.t) || {}; }
function base() { return (window.__i18n && window.__i18n.base) || ''; }

function setStage(state) {
  if (!stageStates.includes(state)) return;
  stage.dataset.state = state;
  const showSample = (state === 'preview' || state === 'loading');
  sampleImg.style.display = showSample ? 'block' : 'none';
  sampleTag.style.display = showSample ? 'inline-block' : 'none';
  resultImg.style.display = state === 'result' && resultImg.src ? 'block' : 'none';
  previewHint.style.display = state === 'preview' ? 'block' : 'none';
  loadingHint.style.display = state === 'loading' ? 'block' : 'none';
  resultBar.style.display = state === 'result' ? 'flex' : 'none';
  resultDisclaimer.style.display = state === 'result' ? 'block' : 'none';
}

// 画布中的效果图跟随当前模式 + 所选风格
function updateSample() {
  if (currentMode === 'tattoo') sampleImg.src = '/examples/tattoo/' + presets.tattoo + '.jpg';
  else if (currentMode === 'hairstyle') sampleImg.src = '/examples/hair/' + presets.hair + '.jpg';
  else sampleImg.src = '/examples/baby/baby.jpg';
}
updateSample();
document.addEventListener('DOMContentLoaded', () => { layoutRing(); updateRingInfo(); });
window.addEventListener('load', () => { layoutRing(); updateRingInfo(); });
window.addEventListener('resize', layoutRing);
window.addEventListener('i18n-ready', updateRingInfo);

const RING_META = {
  tattoo:   { emoji: '🎨', nameKey: 'ringNameTattoo', zhKey: 'ringZhTattoo', tagKey: 'ringTagTattoo', labelKey: 'modeTattoo', color: '#3c3489' },
  baby:     { emoji: '👶', nameKey: 'ringNameBaby',   zhKey: 'ringZhBaby',   tagKey: 'ringTagBaby',   labelKey: 'modeBaby',   color: '#db2777' },
  hairstyle:{ emoji: '💇', nameKey: 'ringNameHair',   zhKey: 'ringZhHair',   tagKey: 'ringTagHair',   labelKey: 'modeHair',   color: '#7c3aed' }
};
const RING_ORDER = ['tattoo', 'baby', 'hairstyle'];

// 环形导航布局：选中节点旋转到正上方，其余按 120° 均分
function layoutRing() {
  const ring = document.getElementById('modeRing');
  if (!ring) return;
  const nodes = [...ring.querySelectorAll('.ring-node')];
  if (!nodes.length) return;
  const nodeW = nodes[0].offsetWidth || 62;
  const R = Math.max(0, ring.clientWidth / 2 - nodeW / 2 - 4);
  const activeIdx = Math.max(0, RING_ORDER.indexOf(currentMode));
  const rot = -activeIdx * 120;
  nodes.forEach((node, i) => {
    const a = -90 + i * 120 + rot;
    const isActive = node.dataset.mode === currentMode;
    node.style.transform = 'rotate(' + a + 'deg) translate(' + R + 'px) rotate(' + (-a) + 'deg) scale(' + (isActive ? 1.1 : 1) + ')';
    node.classList.toggle('active', isActive);
    node.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

// 中心圆与明细文案跟随当前模式
function updateRingInfo() {
  const meta = RING_META[currentMode];
  const dict = t();
  const hub = document.getElementById('ringHub');
  const hubIcon = document.getElementById('hubIcon');
  const hubName = document.getElementById('hubName');
  const hubZh = document.getElementById('hubZh');
  const tag = document.getElementById('ringTag');
  const chip = document.getElementById('modeCurrentLabel');
  if (hubIcon) hubIcon.textContent = meta.emoji;
  if (hub) hub.style.borderColor = meta.color;
  if (hubName && dict[meta.nameKey]) hubName.textContent = dict[meta.nameKey];
  if (hubZh && dict[meta.zhKey]) hubZh.textContent = dict[meta.zhKey];
  if (tag && dict[meta.tagKey]) tag.textContent = dict[meta.tagKey];
  if (chip && dict[meta.labelKey]) chip.textContent = dict[meta.labelKey];
  layoutRing();
}
window.updateRingInfo = updateRingInfo;

function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-panel').forEach(p => p.style.display = 'none');
  document.getElementById('mode-' + mode).style.display = 'block';
  stage.dataset.mode = mode;
  document.getElementById('studio').dataset.mode = mode;
  errorEl.style.display = 'none';
  updateGenerateBtn();
  setStage('examples');
  updateSample();
  updateRingInfo();
}
window.switchMode = switchMode;

// 当前模式是否满足生成条件
function modeReady() {
  if (currentMode === 'tattoo') return true; // 照片可选，还可纯文字描述
  if (currentMode === 'baby') return !!(files.baby1 && files.baby2);
  return !!files.hair;
}

function updateGenerateBtn() {
  generateBtn.disabled = !modeReady();
}

// 通用上传绑定
function setupUpload(zoneId, inputId, fileKey) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const chip = document.getElementById('preview' + fileKey.charAt(0).toUpperCase() + fileKey.slice(1));
  const thumb = document.getElementById('previewImg' + fileKey.charAt(0).toUpperCase() + fileKey.slice(1));

  zone.addEventListener('click', () => input.click());
  zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f, fileKey, chip, thumb);
  });
  input.addEventListener('change', () => {
    const f = input.files[0];
    if (f) handleFile(f, fileKey, chip, thumb);
  });
}

async function handleFile(file, key, chipEl, thumbEl) {
  const tr = t();
  if (!file.type.startsWith('image/')) {
    showError(tr.errType || 'Please upload an image.');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError(tr.errSize || 'Image must be under 5MB.');
    return;
  }

  const compressed = await compressImage(file, 512);
  files[key] = compressed;
  thumbEl.src = URL.createObjectURL(compressed);
  chipEl.style.display = 'flex';
  errorEl.style.display = 'none';
  updateGenerateBtn();
  if (key === modeFileKey()) setStage('preview');
}

function modeFileKey() {
  if (currentMode === 'tattoo') return 'tattoo';
  if (currentMode === 'baby') return null; // 需要两张，不单独切画布
  return 'hair';
}

function compressImage(file, maxSize) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxSize || height > maxSize) {
          if (width > height) { height = Math.round((height / width) * maxSize); width = maxSize; }
          else { width = Math.round((width / height) * maxSize); height = maxSize; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
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
  const map = { tattoo: 'previewTattoo', baby1: 'previewBaby1', baby2: 'previewBaby2', hair: 'previewHair' };
  document.getElementById(map[key]).style.display = 'none';
  if (resultImg) resultImg.removeAttribute('src');
  updateGenerateBtn();
  if (currentMode === 'tattoo' && key === 'tattoo') setStage('examples');
  if (currentMode === 'hairstyle' && key === 'hair') setStage('examples');
  if (currentMode === 'baby' && !files.baby1 && !files.baby2) setStage('examples');
}
window.clearImage = clearImage;

// 预设按钮与示例卡绑定
document.addEventListener('DOMContentLoaded', () => {
  setupUpload('uploadZoneTattoo', 'fileTattoo', 'tattoo');
  setupUpload('uploadZoneBaby1', 'fileBaby1', 'baby1');
  setupUpload('uploadZoneBaby2', 'fileBaby2', 'baby2');
  setupUpload('uploadZoneHair', 'fileHair', 'hair');

  document.querySelectorAll('#tattooPresets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPreset('tattoo', btn.dataset.preset));
  });
  document.querySelectorAll('#hairPresets .preset-btn').forEach(btn => {
    btn.addEventListener('click', () => selectPreset('hairstyle', btn.dataset.preset));
  });

  // 右侧示例卡：点图即选风格
  document.querySelectorAll('#exTattoo .ex-card[data-preset]').forEach(card => {
    card.addEventListener('click', () => selectPreset('tattoo', card.dataset.preset));
  });
  document.querySelectorAll('#exHair .ex-card[data-preset]').forEach(card => {
    card.addEventListener('click', () => selectPreset('hairstyle', card.dataset.preset));
  });

  updateGenerateBtn();
});

function selectPreset(mode, preset) {
  presets[mode] = preset;
  const gridId = mode === 'tattoo' ? 'tattooPresets' : 'hairPresets';
  document.querySelectorAll('#' + gridId + ' .preset-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.preset === preset));
  document.querySelectorAll('#' + (mode === 'tattoo' ? 'exTattoo' : 'exHair') + ' .ex-card').forEach(c =>
    c.classList.toggle('active', c.dataset.preset === preset));
  updateSample();
  if (stage.dataset.state === 'result') setStage('preview');
}

function backToPreview() {
  if (modeReady() && (files.tattoo || files.hair || (files.baby1 && files.baby2))) setStage('preview');
  else setStage('examples');
}
window.backToPreview = backToPreview;

async function generate() {
  const tr = t();

  errorEl.style.display = 'none';

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

  generateBtn.disabled = true;
  setStage('loading');

  try {
    const res = await fetch(base() + '/api/generate', {
      method: 'POST',
      body: formData
    });

    if (res.status === 429) {
      setStage('preview');
      showError(tr.errRateLimit || 'Too many requests. Please wait a minute.');
      return;
    }

    const data = await res.json();
    if (!res.ok || !data.image) {
      setStage('preview');
      showError(data.error || (tr.errGeneric || 'Generation failed.'));
      return;
    }

    resultImg.src = 'data:image/png;base64,' + data.image;
    setStage('result');
    if (window.innerWidth <= 900) stage.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } catch (err) {
    console.error(err);
    setStage('preview');
    showError(tr.errNetwork || 'Network error. Please try again.');
  } finally {
    generateBtn.disabled = false;
  }
}

function downloadResult() {
  const img = resultImg;
  if (!img.src) return;
  const a = document.createElement('a');
  a.href = img.src;
  a.download = 'ai-creative-' + Date.now() + '.png';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.style.display = 'block';
}

window.generate = generate;
window.downloadResult = downloadResult;
