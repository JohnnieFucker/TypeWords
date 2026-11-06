import { requireUser, startJourney } from '../../utils/db'
export default defineEventHandler(event => startJourney(requireUser(event).id))
