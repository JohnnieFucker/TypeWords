import { getGame, requireUser } from '../../utils/db'
export default defineEventHandler(event => getGame(requireUser(event).id))
