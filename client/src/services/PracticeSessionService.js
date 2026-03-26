/**
 * PracticeSessionService — persists practice session data to Supabase
 * for historical tracking and progress analysis.
 *
 * Tables expected:
 *   practice_sessions — one row per session with summary stats
 *   session_errors    — individual deviations linked to a session
 *   user_pieces       — tracks which pieces a user has practiced and their progress
 */

import { supabase } from '../lib/supabase'

/**
 * Save a completed practice session to Supabase.
 *
 * @param {object} params
 * @param {string} params.userId - Supabase user ID
 * @param {string} params.scoreId - ID of the score practiced
 * @param {string} [params.scoreTitle] - Title of the score
 * @param {object} params.sessionLog - Full session log from SessionLogger
 * @param {object} params.sessionSummary - Summary stats from SessionLogger
 * @param {number} params.accuracyPercent - Calculated accuracy %
 * @param {string} params.instrument - Instrument played
 * @returns {Promise<{sessionId: string} | null>}
 */
export async function savePracticeSession({
  userId,
  scoreId,
  scoreTitle,
  sessionLog,
  sessionSummary,
  accuracyPercent,
  instrument,
}) {
  if (!userId || !sessionLog) return null

  try {
    // 1. Insert practice_session row
    const { data: session, error: sessionError } = await supabase
      .from('practice_sessions')
      .insert({
        user_id: userId,
        score_id: scoreId || null,
        score_title: scoreTitle || null,
        instrument,
        duration_ms: sessionLog.duration_ms || 0,
        accuracy_percent: accuracyPercent,
        total_deviations: sessionSummary?.total_deviations || 0,
        pitch_deviation_count: sessionSummary?.pitch_deviation_count || 0,
        avg_pitch_deviation_cents:
          sessionSummary?.average_pitch_deviation_cents || 0,
        worst_measure: sessionSummary?.worst_measure || null,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (sessionError) {
      console.error('Failed to save practice session:', sessionError)
      return null
    }

    const sessionId = session.id

    // 2. Insert session_errors (batch, limited to 200 to avoid payload limits)
    const deviations = (sessionLog.deviations || []).slice(0, 200)
    if (deviations.length > 0) {
      const errorRows = deviations.map((d) => ({
        session_id: sessionId,
        user_id: userId,
        type: d.type,
        measure_number: d.measureNumber,
        beat: d.beat || null,
        expected_note: d.expectedNote || null,
        detected_note: d.detectedNote || null,
        cents_deviation: d.centsDeviation || null,
        confidence: d.confidence || null,
        is_vibrato: d.isVibrato || false,
        timestamp_ms: d.timestamp || null,
      }))

      const { error: errorsError } = await supabase
        .from('session_errors')
        .insert(errorRows)

      if (errorsError) {
        console.error('Failed to save session errors:', errorsError)
      }
    }

    // 3. Upsert user_pieces for progress tracking
    if (scoreId) {
      await upsertUserPiece({
        userId,
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
 * Upsert user_pieces record — tracks per-piece progress over time.
 */
async function upsertUserPiece({
  userId,
  scoreId,
  scoreTitle,
  accuracyPercent,
  instrument,
}) {
  try {
    // Check if record exists
    const { data: existing } = await supabase
      .from('user_pieces')
      .select('id, practice_count, best_accuracy, last_accuracy')
      .eq('user_id', userId)
      .eq('score_id', scoreId)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('user_pieces')
        .update({
          practice_count: (existing.practice_count || 0) + 1,
          best_accuracy: Math.max(
            existing.best_accuracy || 0,
            accuracyPercent,
          ),
          last_accuracy: accuracyPercent,
          last_practiced_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
    } else {
      await supabase.from('user_pieces').insert({
        user_id: userId,
        score_id: scoreId,
        score_title: scoreTitle || null,
        instrument,
        practice_count: 1,
        best_accuracy: accuracyPercent,
        last_accuracy: accuracyPercent,
        last_practiced_at: new Date().toISOString(),
      })
    }
  } catch (err) {
    console.error('upsertUserPiece error:', err)
  }
}

/**
 * Load practice history for a user (most recent sessions).
 *
 * @param {string} userId
 * @param {object} [options]
 * @param {number} [options.limit=20]
 * @param {string} [options.scoreId] - Filter by specific score
 * @returns {Promise<Array>}
 */
export async function loadPracticeHistory(userId, options = {}) {
  const { limit = 20, scoreId } = options

  try {
    let query = supabase
      .from('practice_sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (scoreId) {
      query = query.eq('score_id', scoreId)
    }

    const { data, error } = await query

    if (error) {
      console.error('Failed to load practice history:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('loadPracticeHistory error:', err)
    return []
  }
}

/**
 * Load user_pieces progress data for a specific user.
 *
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function loadUserPieces(userId) {
  try {
    const { data, error } = await supabase
      .from('user_pieces')
      .select('*')
      .eq('user_id', userId)
      .order('last_practiced_at', { ascending: false })

    if (error) {
      console.error('Failed to load user pieces:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('loadUserPieces error:', err)
    return []
  }
}

/**
 * Get progress trend for a specific score — returns accuracy over time.
 *
 * @param {string} userId
 * @param {string} scoreId
 * @param {number} [limit=10]
 * @returns {Promise<Array<{accuracy_percent: number, created_at: string}>>}
 */
export async function getProgressTrend(userId, scoreId, limit = 10) {
  try {
    const { data, error } = await supabase
      .from('practice_sessions')
      .select('accuracy_percent, created_at')
      .eq('user_id', userId)
      .eq('score_id', scoreId)
      .order('created_at', { ascending: true })
      .limit(limit)

    if (error) {
      console.error('Failed to load progress trend:', error)
      return []
    }

    return data || []
  } catch (err) {
    console.error('getProgressTrend error:', err)
    return []
  }
}
