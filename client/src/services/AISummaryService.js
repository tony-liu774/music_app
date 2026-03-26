/**
 * AISummaryService — aggregates session data and calls the /api/ai-summary
 * endpoint for a post-session coaching debrief. Falls back to a local
 * summary when the backend is unreachable.
 */

const API_ENDPOINT = '/api/ai-summary'
const REQUEST_TIMEOUT_MS = 10000

/**
 * Simple in-memory LRU cache for AI debrief responses.
 * Keyed by a hash of the error pattern to avoid redundant API calls.
 */
const CACHE_MAX_SIZE = 20
const responseCache = new Map()

/**
 * Generate a cache key from the payload's error signature.
 * Uses accuracy, intonation trend, worst measures, and deviation count
 * so identical error patterns produce the same key.
 */
function getCacheKey(payload) {
  const worstKey = (payload.worstMeasures || [])
    .map((m) => `${m.measureNumber}:${m.errorCount}`)
    .join(',')
  return `${payload.instrument}|${payload.accuracyPercent}|${payload.intonationTrend}|${worstKey}|${payload.summaryStats?.total_deviations || 0}`
}

function cacheGet(key) {
  if (!responseCache.has(key)) return null
  const value = responseCache.get(key)
  // Move to end (most recently used)
  responseCache.delete(key)
  responseCache.set(key, value)
  return value
}

function cacheSet(key, value) {
  if (responseCache.size >= CACHE_MAX_SIZE) {
    // Evict oldest entry
    const firstKey = responseCache.keys().next().value
    responseCache.delete(firstKey)
  }
  responseCache.set(key, value)
}

/**
 * Build the aggregation payload from session log, summary stats,
 * worst measures, and vibrato data.
 */
export function buildPayload({
  sessionLog,
  sessionSummary,
  worstMeasures,
  durationMs,
  instrument = 'violin',
}) {
  const pitchDevs = (sessionLog?.deviations || []).filter(
    (d) => d.type === 'pitch',
  )

  // Intonation trend: compare first-half vs second-half average deviation
  let intonationTrend = 'stable'
  if (pitchDevs.length >= 4) {
    const mid = Math.floor(pitchDevs.length / 2)
    const firstHalfAvg =
      pitchDevs
        .slice(0, mid)
        .reduce((s, d) => s + Math.abs(d.centsDeviation || 0), 0) / mid
    const secondHalfAvg =
      pitchDevs
        .slice(mid)
        .reduce((s, d) => s + Math.abs(d.centsDeviation || 0), 0) /
      (pitchDevs.length - mid)
    if (secondHalfAvg < firstHalfAvg * 0.85) intonationTrend = 'improving'
    else if (secondHalfAvg > firstHalfAvg * 1.15)
      intonationTrend = 'deteriorating'
  }

  // Vibrato usage stats
  const vibratoEntries = pitchDevs.filter((d) => d.isVibrato)
  const vibratoPercent =
    pitchDevs.length > 0
      ? Math.round((vibratoEntries.length / pitchDevs.length) * 100)
      : 0

  // Accuracy: percentage of pitch readings within ±15 cents
  const accurateCount = pitchDevs.filter(
    (d) => Math.abs(d.centsDeviation || 0) <= 15,
  ).length
  const accuracyPercent =
    pitchDevs.length > 0
      ? Math.round((accurateCount / pitchDevs.length) * 100)
      : 100

  return {
    instrument,
    durationMs: durationMs || sessionLog?.duration_ms || 0,
    accuracyPercent,
    intonationTrend,
    vibratoUsagePercent: vibratoPercent,
    worstMeasures: (worstMeasures || []).slice(0, 5),
    summaryStats: sessionSummary || {},
    recentDeviations: (sessionLog?.deviations || []).slice(-30),
  }
}

/**
 * Build the text prompt sent to the backend LLM endpoint.
 */
export function buildPrompt(payload) {
  const worst = payload.worstMeasures
    .map(
      (m) =>
        `measure ${m.measureNumber} (avg ${m.averageDeviation}¢, ${m.errorCount} errors)`,
    )
    .join(', ')

  return `You are an encouraging masterclass string instructor. Analyze this practice session and respond with exactly TWO sentences: one praising what went well and one giving a specific, actionable tip. Keep it warm, specific, and under 60 words total.

Instrument: ${payload.instrument}
Practice duration: ${Math.round(payload.durationMs / 1000)}s
Overall accuracy: ${payload.accuracyPercent}%
Intonation trend: ${payload.intonationTrend}
Vibrato usage: ${payload.vibratoUsagePercent}%
Worst measures: ${worst || 'none'}
Total deviations: ${payload.summaryStats.total_deviations || 0}
Avg pitch deviation: ${payload.summaryStats.average_pitch_deviation_cents || 0} cents

Respond as JSON: { "debrief": "<your two sentences>", "score": <0-100 integer overall session score> }`
}

/**
 * Generate a local fallback debrief when the API is unreachable.
 */
export function generateLocalDebrief(payload) {
  const { accuracyPercent, intonationTrend, worstMeasures } = payload

  let praise
  if (accuracyPercent >= 85) {
    praise =
      'Excellent accuracy this session — your intonation is really coming together!'
  } else if (accuracyPercent >= 65) {
    praise =
      'Good effort — you showed solid consistency through most of this piece.'
  } else {
    praise =
      'Nice work getting through the piece — every run-through builds muscle memory.'
  }

  let tip
  if (worstMeasures.length > 0) {
    const m = worstMeasures[0].measureNumber
    tip = `Try isolating measure ${m} at a slower tempo to lock in the finger placement.`
  } else if (intonationTrend === 'deteriorating') {
    tip =
      'Your intonation drifted later in the session — consider shorter, focused bursts with breaks.'
  } else {
    tip =
      'Keep building on this momentum — try adding dynamics and expression in your next session.'
  }

  return {
    debrief: `${praise} ${tip}`,
    score: accuracyPercent,
    isOfflineFallback: true,
  }
}

/**
 * Request an AI-generated debrief from the backend.
 * Returns { debrief, score, isOfflineFallback } on success or fallback.
 * Caches responses to avoid redundant API calls for identical error patterns.
 */
export async function requestAIDebrief(payload) {
  // Check cache first
  const cacheKey = getCacheKey(payload)
  const cached = cacheGet(cacheKey)
  if (cached) {
    return { ...cached, isCached: true }
  }

  const prompt = buildPrompt(payload)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, session_data: payload }),
      signal: controller.signal,
    })

    const data = await response.json()

    if (data.use_fallback || !response.ok) {
      return generateLocalDebrief(payload)
    }

    // The backend returns { success, raw, summary, score, ... }.
    // Try parsing `raw` first (the unmodified LLM JSON string) for
    // prompt-specific fields like { debrief, score }. Fall back to
    // the backend's pre-extracted fields.
    let parsed = {}
    if (data.raw) {
      try {
        parsed = JSON.parse(data.raw)
      } catch {
        parsed = {}
      }
    }

    const result = {
      debrief: parsed.debrief || data.summary || data.overall_assessment || '',
      score:
        typeof parsed.score === 'number'
          ? parsed.score
          : typeof data.score === 'number'
            ? data.score
            : null,
      isOfflineFallback: false,
    }

    // Cache the result
    cacheSet(cacheKey, result)

    return result
  } catch {
    // Network error / timeout → offline fallback
    return generateLocalDebrief(payload)
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Clear the AI debrief response cache. Exported for testing.
 */
export function clearAICache() {
  responseCache.clear()
}
