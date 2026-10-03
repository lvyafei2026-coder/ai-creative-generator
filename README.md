# AI Creative Generator

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

```bash
npm install
npx wrangler login
npx wrangler deploy
```

## Routes

Add to `tool-proxy`:
- `toolara.dev/ai-creative-generator/*`
- `www.toolara.dev/ai-creative-generator/*`

## License

MIT
