import { encounterPet, requireUser } from '../../utils/db'
export default defineEventHandler(event => encounterPet(requireUser(event).id))
