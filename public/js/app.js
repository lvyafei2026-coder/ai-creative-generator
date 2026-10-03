let currentMode = 'tattoo';
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
window.clearImage = clearImage;