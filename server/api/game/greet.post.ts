import { greetPet, requireUser } from '../../utils/db'
export default defineEventHandler(event => greetPet(requireUser(event).id))
