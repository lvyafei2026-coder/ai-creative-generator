export default {
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
  const path = url.pathname.replace(/\/$/, '');

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

// 全局每日生成上限：账户 Workers AI 免费层 10,000 neurons/天（UTC 日切），全站群共享。
//   flux-2-klein-4b 1024x1024 实测单张约 250-400 neurons（按 330 估）。
//   2026-11-04 二次切分：radar 的 autopilot 停用（额度让给产品站），本站 6 → 8 张。
//     figurine 12 张 ≈4.0k + 本站 8 张 ≈2.6k + radar 手动 5 次 ≈1.3k，余 ~2.1k。
//   KV 复用 figurine 的 namespace，key 前缀区分，两站各算各的格数。
//   撞账户 4006 时写 img:alert:<UTC日> 旗——radar 的预警巡检每 2 小时读一次并发邮件。
const DAILY_LIMIT = 8;
const QUOTA_PREFIX = 'img:creative:';

function todayKey() {
  return QUOTA_PREFIX + new Date().toISOString().slice(0, 10);
}

async function checkDailyQuota(env) {
  // binding 没生效时放行（旧行为），但要在日志里喊一声——否则整站会因为一个 KV 绑定没接上而全 500
  if (!env.QUOTA_KV) {
    console.error('QUOTA_KV 未绑定，出图配额失效，本次放行');
    return { ok: true, current: 0 };
  }
  const key = todayKey();
  const current = parseInt((await env.QUOTA_KV.get(key)) || '0', 10);
  if (current >= DAILY_LIMIT) return { ok: false, current };
  await env.QUOTA_KV.put(key, String(current + 1), { expirationTtl: 172800 });
  return { ok: true, current };
}

async function refundQuota(env) {
  if (!env.QUOTA_KV) return;
  const key = todayKey();
  const current = parseInt((await env.QUOTA_KV.get(key)) || '0', 10);
  if (current > 0) await env.QUOTA_KV.put(key, String(current - 1), { expirationTtl: 172800 });
}

// 账户额度见底：立旗给 radar 的预警巡检（每 2 小时读一次，发邮件提醒）
async function flagQuotaExhausted(env) {
  if (!env.QUOTA_KV) return;
  try {
    await env.QUOTA_KV.put('img:alert:' + new Date().toISOString().slice(0, 10),
      new Date().toISOString(), { expirationTtl: 172800 });
  } catch (e) { console.error('flagQuotaExhausted failed:', e.message); }
}

async function handleGenerate(request, env) {
  let quotaReserved = false;
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

    // 账户级出图预算：校验通过后才占格，避免无效请求吃掉配额
    const quota = await checkDailyQuota(env);
    if (!quota.ok) {
      return json({
        error: "Today's free quota is used up. Please come back tomorrow.",
        code: 'QUOTA_EXCEEDED'
      }, 429);
    }
    quotaReserved = true;

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

    // 先把 FormData 包装成 Request
    const formRequest = new Request('http://dummy', {
      method: 'POST',
      body: apiForm
    });

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b', {
      multipart: {
        body: formRequest.body,
        contentType: formRequest.headers.get('content-type') || 'multipart/form-data'
      }
    });

    if (!response || !response.image) {
      console.error('No image in response:', response);
      return json({ error: 'Generation failed. Please try again.' }, 500);
    }

    return json({ image: response.image });
  } catch (err) {
    console.error('Generate error:', {
      message: err.message,
      code: err.code,        // 这个会显示 3030 或 4006
      name: err.name
    });
    // Workers AI 免费层日配额耗尽（4006 neurons exhausted），对齐 figurine 站的处理：
    // 额度判定在入口没产生推理，把预占的格还回去；同时立旗给 radar 的预警巡检
    if (String(err.message || '').includes('4006') || err.code === 4006) {
      if (quotaReserved) await refundQuota(env);
      await flagQuotaExhausted(env);
      return json({
        error: "Today's free quota is used up. Please come back tomorrow.",
        code: 'QUOTA_EXCEEDED'
      }, 429);
    }
    return json({ error: 'Processing failed.', detail: err.message, code: err.code }, 500);
  }
}
