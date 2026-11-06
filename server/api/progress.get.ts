import { readProgress, requireUser } from '../utils/db'
export default defineEventHandler(event => readProgress(requireUser(event).id))
