/**
 * Tests for the AI route (/api/ai-summary) using Claude API.
 */

const { describe, it, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert');

// Mock the @anthropic-ai/sdk module before requiring the route
const mockCreate = mock.fn();

// We need to test the route handler directly since we can't easily
// mock the require() in the lazy init pattern. Instead we test the
// route behavior via a lightweight express-like test harness.

describe('AI Route - Claude API integration', () => {
  let originalEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('rejects requests without a prompt', async () => {
    // Require fresh route module
    delete require.cache[require.resolve('../src/routes/ai')];
    const router = require('../src/routes/ai');

    // Find the POST handler
    const postHandler = router.stack.find(
      (layer) => layer.route && layer.route.path === '/ai-summary' && layer.route.methods.post
    );

    assert.ok(postHandler, 'POST /ai-summary route should exist');

    const req = { body: {} };
    const res = createMockRes();

    await postHandler.route.stack[0].handle(req, res);

    assert.strictEqual(res.statusCode, 400);
    assert.ok(res.jsonData.error, 'should return error');
    assert.ok(res.jsonData.error.includes('Missing prompt'));
  });

  it('returns fallback when API key is not configured', async () => {
    delete process.env.ANTHROPIC_API_KEY;

    delete require.cache[require.resolve('../src/routes/ai')];
    const router = require('../src/routes/ai');

    const postHandler = router.stack.find(
      (layer) => layer.route && layer.route.path === '/ai-summary' && layer.route.methods.post
    );

    const req = { body: { prompt: 'Analyze this session' } };
    const res = createMockRes();

    await postHandler.route.stack[0].handle(req, res);

    assert.strictEqual(res.statusCode, 200);
    assert.strictEqual(res.jsonData.use_fallback, true);
  });

  it('route module exports an express router', () => {
    delete require.cache[require.resolve('../src/routes/ai')];
    const router = require('../src/routes/ai');

    assert.ok(router.stack, 'should have a stack (express Router)');
    const aiSummaryRoute = router.stack.find(
      (layer) => layer.route && layer.route.path === '/ai-summary'
    );
    assert.ok(aiSummaryRoute, 'should have /ai-summary route');
  });

  it('uses claude-sonnet-4-6 model in the system prompt', () => {
    // Read the route source to verify model name
    const fs = require('fs');
    const routeSource = fs.readFileSync(
      require.resolve('../src/routes/ai'),
      'utf-8'
    );

    assert.ok(
      routeSource.includes('claude-sonnet-4-6'),
      'should use claude-sonnet-4-6 model'
    );
    assert.ok(
      routeSource.includes('@anthropic-ai/sdk'),
      'should import Anthropic SDK'
    );
    assert.ok(
      routeSource.includes('ANTHROPIC_API_KEY'),
      'should check for ANTHROPIC_API_KEY'
    );
  });

  it('prompt includes masterclass instructor system message', () => {
    const fs = require('fs');
    const routeSource = fs.readFileSync(
      require.resolve('../src/routes/ai'),
      'utf-8'
    );

    assert.ok(
      routeSource.includes('masterclass string instructor'),
      'system prompt should reference masterclass instructor'
    );
  });

  it('sets temperature to 0.7 for consistent responses', () => {
    const fs = require('fs');
    const routeSource = fs.readFileSync(
      require.resolve('../src/routes/ai'),
      'utf-8'
    );

    assert.ok(
      routeSource.includes('temperature: 0.7'),
      'should set temperature to 0.7'
    );
  });
});

/**
 * Create a mock Express response object.
 */
function createMockRes() {
  const res = {
    statusCode: 200,
    jsonData: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(data) {
      res.jsonData = data;
      return res;
    },
  };
  return res;
}
