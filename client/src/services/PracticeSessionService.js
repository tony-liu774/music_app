/**
 * PracticeSessionService — persists practice session data locally
 * for historical tracking and progress analysis.
 *
 * This is a simplified version that stores data in localStorage
 * without requiring Supabase authentication.
 */

/**
 * Save a completed practice session locally.
 *
 * @param {object} params
 * @param {string} [params.scoreId] - ID of the score practiced
 * @param {string} [params.scoreTitle] - Title of the score
 * @param {object} params.sessionLog - Full session log from SessionLogger
 * @param {object} params.sessionSummary - Summary stats from SessionLogger
 * @param {number} params.accuracyPercent - Calculated accuracy %
 * @param {string} params.instrument - Instrument played
 * @returns {Promise<{sessionId: string} | null>}
 */
export async function savePracticeSession({
  scoreId,
  scoreTitle,
  sessionLog,
  sessionSummary,
  accuracyPercent,
  instrument,
}) {
  if (!sessionLog) return null

  try {
    const sessionId = `session_${Date.now()}`

    // Create session record
    const sessionRecord = {
      id: sessionId,
      score_id: scoreId || null,
      score_title: scoreTitle || null,
      instrument,
      duration_ms: sessionLog.duration_ms || 0,
      accuracy_percent: accuracyPercent,
      total_deviations: sessionSummary?.total_deviations || 0,
      pitch_deviation_count: sessionSummary?.pitch_deviation_count || 0,
      avg_pitch_deviation_cents: sessionSummary?.average_pitch_deviation_cents || 0,
      worst_measure: sessionSummary?.worst_measure || null,
      created_at: new Date().toISOString(),
      deviations: (sessionLog.deviations || []).slice(0, 200),
    }

    // Get existing sessions from localStorage
    const sessions = getLocalSessions()
    sessions.push(sessionRecord)

    // Keep only last 100 sessions
    const trimmedSessions = sessions.slice(-100)
    localStorage.setItem('practice_sessions', JSON.stringify(trimmedSessions))

    // Update piece progress
    if (scoreId) {
      upsertLocalPiece({
        scoreId,
        scoreTitle,
        accuracyPercent,
        instrument,
      })
    }

    return { sessionId }
  } catch (err) {
    console.error('PracticeSessionService.savePracticeSession error:', err)
    return null
  }
}

/**
 * Get sessions from localStorage
 */
function getLocalSessions() {
  try {
    const data = localStorage.getItem('practice_sessions')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Upsert piece progress in localStorage
 */
function upsertLocalPiece({
  scoreId,
  scoreTitle,
  accuracyPercent,
  instrument,
}) {
  try {
    const pieces = getLocalPieces()
    const existing = pieces.find(p => p.score_id === scoreId)

    if (existing) {
      existing.practice_count = (existing.practice_count || 0) + 1
      existing.best_accuracy = Math.max(existing.best_accuracy || 0, accuracyPercent)
      existing.last_accuracy = accuracyPercent
      existing.last_practiced_at = new Date().toISOString()
    } else {
      pieces.push({
        score_id: scoreId,
        score_title: scoreTitle || null,
        instrument,
        practice_count: 1,
        best_accuracy: accuracyPercent,
        last_accuracy: accuracyPercent,
        last_practiced_at: new Date().toISOString(),
      })
    }

    localStorage.setItem('user_pieces', JSON.stringify(pieces))
  } catch (err) {
    console.error('upsertLocalPiece error:', err)
  }
}

/**
 * Get pieces from localStorage
 */
function getLocalPieces() {
  try {
    const data = localStorage.getItem('user_pieces')
    return data ? JSON.parse(data) : []
  } catch {
    return []
  }
}

/**
 * Load practice history (most recent sessions).
 *
 * @param {object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.scoreId] - Filter by specific score
 * @returns {Promise<Array>}
 */
export async function loadPracticeHistory(options = {}) {
  const { limit = 20, scoreId } = options

  try {
    let sessions = getLocalSessions()

    if (scoreId) {
      sessions = sessions.filter(s => s.score_id === scoreId)
    }

    // Sort by created_at descending
    sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return sessions.slice(0, limit)
  } catch (err) {
    console.error('loadPracticeHistory error:', err)
    return []
  }
}

/**
 * Load piece progress data.
 *
 * @returns {Promise<Array>}
 */
export async function loadUserPieces() {
  try {
    const pieces = getLocalPieces()
    pieces.sort((a, b) => new Date(b.last_practiced_at) - new Date(a.last_practiced_at))
    return pieces
  } catch (err) {
    console.error('loadUserPieces error:', err)
    return []
  }
}

/**
 * Get progress trend for a specific score — returns accuracy over time.
 *
 * @param {string} scoreId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{accuracy_percent: number, created_at: string}>>}
 */
export async function getProgressTrend(scoreId, limit = 10) {
  try {
    const sessions = getLocalSessions()
      .filter(s => s.score_id === scoreId)
      .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      .slice(-limit)

    return sessions.map(s => ({
      accuracy_percent: s.accuracy_percent,
      created_at: s.created_at,
    }))
  } catch (err) {
    console.error('getProgressTrend error:', err)
    return []
  }
}
