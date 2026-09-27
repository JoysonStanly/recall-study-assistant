import { afterEach, describe, expect, it, vi } from 'vitest';
import { streamGemini } from '../gemini.js';

/** Build a fake SSE Response, split into awkward chunks to exercise buffering. */
function sseResponse(events, chunkSize = 7) {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\r\n\r\n`).join('');
  const bytes = new TextEncoder().encode(body);
  return new Response(
    new ReadableStream({
      start(c) {
        for (let i = 0; i < bytes.length; i += chunkSize) c.enqueue(bytes.slice(i, i + chunkSize));
        c.close();
      },
    }),
    { status: 200, headers: { 'Content-Type': 'text/event-stream' } },
  );
}

const textEvent = (text, extra = {}) => ({ candidates: [{ content: { parts: [{ text }] }, ...extra }] });

afterEach(() => vi.unstubAllGlobals());

describe('streamGemini', () => {
  it('reassembles text across SSE events and chunk boundaries, skipping thought parts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([
      textEvent('{"title":'),
      { candidates: [{ content: { parts: [{ text: 'internal reasoning', thought: true }] } }] },
      textEvent('"Cells"}', { finishReason: 'STOP' }),
    ])));
    let out = '';
    const { finishReason } = await streamGemini({ apiKey: 'k', model: 'm', prompt: 'p', onText: (t) => { out += t; } });
    expect(out).toBe('{"title":"Cells"}');
    expect(finishReason).toBe('STOP');
  });

  it('sends the key in a header, never in the URL', async () => {
    const fetchMock = vi.fn(async () => sseResponse([textEvent('{}', { finishReason: 'STOP' })]));
    vi.stubGlobal('fetch', fetchMock);
    await streamGemini({ apiKey: 'secret', model: 'gemini-x', prompt: 'p', onText: () => {} });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).not.toContain('secret');
    expect(init.headers['x-goog-api-key']).toBe('secret');
    expect(JSON.parse(init.body).generationConfig.responseMimeType).toBe('application/json');
  });

  it('maps HTTP failures to typed error codes', async () => {
    const cases = [
      [429, '{}', 'RATE_LIMITED'],
      [404, '{"error":{"message":"models/x is not found"}}', 'MODEL_NOT_FOUND'],
      [400, '{"error":{"message":"API key not valid."}}', 'AUTH'],
      [503, 'overloaded', 'UPSTREAM_ERROR'],
    ];
    for (const [status, body, code] of cases) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response(body, { status })));
      await expect(streamGemini({ apiKey: 'k', model: 'm', prompt: 'p', onText: () => {} })).rejects.toMatchObject({ code });
    }
  });

  it('reports safety blocks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([{ promptFeedback: { blockReason: 'SAFETY' } }])));
    await expect(streamGemini({ apiKey: 'k', model: 'm', prompt: 'p', onText: () => {} })).rejects.toMatchObject({ code: 'BLOCKED' });
  });

  it('reports MAX_TOKENS so the client can explain a cut-off answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => sseResponse([textEvent('{"title":"x", "cards": [', { finishReason: 'MAX_TOKENS' })])));
    const { finishReason } = await streamGemini({ apiKey: 'k', model: 'm', prompt: 'p', onText: () => {} });
    expect(finishReason).toBe('MAX_TOKENS');
  });
});
