/**
 * ESM re-export of the canonical SessionLogger.
 *
 * The single source of truth lives in src/js/analysis/session-logger.js.
 * That file uses CJS exports, so we import the default (which Vite resolves
 * to the module.exports object) and re-export the named class.
 */
import cjs from '../../../src/js/analysis/session-logger.js'

export const SessionLogger = cjs.SessionLogger
