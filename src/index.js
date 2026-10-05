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

    const response = await env.AI.run('@cf/black-forest-labs/flux-2-klein-4b', {
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
    console.error('Generate error:', {
      message: err.message,
      code: err.code,        // 这个会显示 3030 或 4006
      name: err.name
    });
    return json({ error: 'Processing failed.', detail: err.message, code: err.code }, 500);
  }
}
