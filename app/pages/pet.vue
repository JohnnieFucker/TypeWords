<script setup lang="ts">
import { withAppBaseURL } from '@/core/utils/base-url'
import PetPortrait from '@/components/PetPortrait.vue'

type Pet = {
  id: string
  name: string
  species: string
  level: number
  exp: number
  attack: number
  defense: number
  spirit: number
  wins: number
  losses: number
  element: string
  stage: string
  care: { hunger: number; cleanliness: number; mood: number }
}
type Game = {
  pet: Pet
  items: Array<{ id: string; name: string; description: string; quantity: number; kind: string; rarity: string }>
  todayReward: string | null
  bonusToday: string | null
  streak: number
  greeted: boolean
  supplies: { food: number; beacon: number }
  roster: Array<{ species: string; name: string; owned: boolean; active: boolean; level: number | null }>
  journey: { species: string; destination: string; started_at: number; returns_at: number } | null
  souvenirs: Array<{ souvenir: string; destination: string; quantity: number; last_at: number; note: string }>
  battlesLeft: number
  opponents: Pet[]
  records: Array<{
    won: number
    opponent: string
    challenger_score: number
    defender_score: number
    created_at: number
  }>
}
const game = ref<Game | null>(null)
const loading = ref(true)
const working = ref(false)
const error = ref('')
const result = ref('')
const needsLogin = ref(false)
const now = ref(Date.now())
let refreshTimer: ReturnType<typeof setInterval> | undefined

async function load() {
  loading.value = true
  try {
    game.value = await $fetch<Game>(withAppBaseURL('/api/game'))
  } catch (e: any) {
    needsLogin.value = e?.statusCode === 401
    error.value = needsLogin.value ? '' : '仙境暂时无法打开，请稍后重试。'
  } finally {
    loading.value = false
  }
}
async function useItem(item: string) {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    game.value = await $fetch<Game>(withAppBaseURL('/api/game/item'), { method: 'POST', body: { item } })
    result.value = '照料完成，仙宠感受到了你的心意。'
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '使用失败，请重试。'
  } finally {
    working.value = false
  }
}
async function greet() {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    game.value = await $fetch<Game>(withAppBaseURL('/api/game/greet'), { method: 'POST' })
    result.value = '仙宠开心地回应了你，还送来一份行囊和寻缘符。'
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '互动失败，请重试。'
  } finally {
    working.value = false
  }
}
async function battle(opponent: string) {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    const response = await $fetch<{
      result: { won: boolean; challengerScore: number; defenderScore: number }
      game: Game
    }>(withAppBaseURL('/api/game/battle'), { method: 'POST', body: { opponent } })
    game.value = response.game
    result.value = `${response.result.won ? '切磋获胜' : '切磋落败'}！灵力对决 ${response.result.challengerScore} : ${response.result.defenderScore}`
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '挑战失败，请重试。'
  } finally {
    working.value = false
  }
}
async function encounter() {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    const response = await $fetch<{ encounter: { name: string; caught: boolean; duplicate: boolean }; game: Game }>(
      withAppBaseURL('/api/game/encounter'),
      { method: 'POST' }
    )
    game.value = response.game
    result.value = !response.encounter.caught
      ? `遇见了${response.encounter.name}，它害羞地跑走了。`
      : response.encounter.duplicate
        ? `再次遇见${response.encounter.name}，它获得了 15 点修为。`
        : `遇见并收服了${response.encounter.name}！`
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '寻缘失败，请重试。'
  } finally {
    working.value = false
  }
}
async function choosePet(species: string) {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    game.value = await $fetch<Game>(withAppBaseURL('/api/game/switch'), { method: 'POST', body: { species } })
    result.value = '已更换同行灵兽。'
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '更换失败，请重试。'
  } finally {
    working.value = false
  }
}
async function journey() {
  if (working.value) return
  working.value = true
  error.value = ''
  result.value = ''
  try {
    game.value = await $fetch<Game>(withAppBaseURL('/api/game/journey'), { method: 'POST' })
    result.value = '准备好行囊，仙宠出发啦！'
  } catch (e: any) {
    error.value = e?.data?.statusMessage || '出发失败，请重试。'
  } finally {
    working.value = false
  }
}
const remaining = computed(() => Math.max(0, Math.ceil(((game.value?.journey?.returns_at ?? 0) - now.value) / 60000)))
onMounted(() => {
  load()
  refreshTimer = setInterval(async () => {
    now.value = Date.now()
    if (!game.value?.journey || game.value.journey.returns_at > now.value || working.value) return
    try {
      const updated = await $fetch<Game>(withAppBaseURL('/api/game'))
      if (!updated.journey) result.value = '仙宠旅行归来，带回了一份纪念！'
      game.value = updated
    } catch {
      /* 下次刷新时继续尝试 */
    }
  }, 15000)
})
onUnmounted(() => clearInterval(refreshTimer))
useSeoMeta({ title: '仙宠小境 · WordsBattle' })
</script>

<template>
  <div class="pet-page">
    <header class="pet-heading">
      <div>
        <p class="eyebrow">YOUR LITTLE SANCTUARY</p>
        <h1>仙宠小境</h1>
        <p>每天学一点，陪它慢慢长大。</p>
      </div>
      <NuxtLink to="/words" class="back-link">← 返回学习</NuxtLink>
    </header>
    <div v-if="loading" class="state">正在打开仙宠小境…</div>
    <div v-else-if="needsLogin" class="state">
      <h2>与你的仙宠相遇</h2>
      <p>微信登录后，就能领取专属仙宠。</p>
      <NuxtLink to="/">微信登录 →</NuxtLink>
    </div>
    <template v-else-if="game">
      <p v-if="error || result" class="notice" :class="{ 'notice-error': error }" role="status">
        {{ error || result }}
      </p>
      <section class="pet-hero">
        <div class="pet-copy">
          <span class="tag">✳ 你的修炼伙伴</span>
          <h2>{{ game.pet.name }}</h2>
          <p>
            {{ game.pet.element }}灵 · {{ game.pet.stage }} · 等级 {{ game.pet.level }} · 修为
            {{ game.pet.exp % 100 }} / 100
          </p>
          <div class="exp-track"><span :style="{ width: `${game.pet.exp % 100}%` }"></span></div>
          <div class="care-stats" aria-label="仙宠照料状态">
            <div
              v-for="status in [
                { label: '饱食', value: game.pet.care.hunger },
                { label: '洁净', value: game.pet.care.cleanliness },
                { label: '心情', value: game.pet.care.mood },
              ]"
              :key="status.label"
              class="care-row"
            >
              <span>{{ status.label }}</span>
              <div
                class="care-track"
                role="progressbar"
                :aria-label="status.label"
                :aria-valuenow="status.value"
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <span :style="{ width: `${status.value}%` }"></span>
              </div>
              <strong>{{ status.value }}</strong>
            </div>
          </div>
          <button class="greet-button" :disabled="game.greeted || !!game.journey || working" @click="greet">
            {{ game.greeted ? '今日已问候' : '打个招呼 · 领取行囊和寻缘符' }}
          </button>
          <p class="care-hint">
            饱食、洁净、心情分别每 4、6、8 小时下降 1 点，最低 20 点；仙宠不会死亡，照料状态影响切磋表现。
          </p>
          <div class="pet-stats">
            <div>
              <strong>{{ game.pet.attack }}</strong
              ><span>攻击</span>
            </div>
            <div>
              <strong>{{ game.pet.defense }}</strong
              ><span>防御</span>
            </div>
            <div>
              <strong>{{ game.pet.spirit }}</strong
              ><span>灵力</span>
            </div>
          </div>
        </div>
        <div class="pet-art"><PetPortrait :species="game.pet.species" :stage="game.pet.stage" /></div>
      </section>
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">MEET YOUR COMPANIONS</span>
            <h2>灵兽图鉴</h2>
          </div>
          <p>每天向仙宠问候，获得寻缘符与行囊</p>
        </div>
        <div class="roster">
          <div
            v-for="companion in game.roster"
            :key="companion.species"
            class="roster-card"
            :class="{ unknown: !companion.owned }"
          >
            <div class="roster-art"><PetPortrait :species="companion.species" /></div>
            <strong>{{ companion.owned ? companion.name : '待相遇' }}</strong>
            <span>{{ companion.owned ? `等级 ${companion.level}` : '使用寻缘符去遇见' }}</span>
            <button
              v-if="companion.owned"
              :disabled="companion.active || !!game.journey || working"
              @click="choosePet(companion.species)"
            >
              {{ companion.active ? '同行中' : '设为同行' }}
            </button>
          </div>
        </div>
        <div class="adventure-action">
          <p>
            寻缘符 <strong>{{ game.supplies.beacon }}</strong> · 相遇时有机会收服灵兽
          </p>
          <button :disabled="!game.supplies.beacon || !!game.journey || working" @click="encounter">去寻缘 ✦</button>
        </div>
      </section>
      <section class="section journey-section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">A LITTLE JOURNEY</span>
            <h2>山野来信</h2>
          </div>
          <p>准备行囊，等它带着故事回家</p>
        </div>
        <div class="journey-card">
          <div>
            <strong>{{
              game.journey ? `${game.pet.name}正在${game.journey.destination}旅行` : '山风正好，出发看看吧'
            }}</strong>
            <p>
              {{
                game.journey
                  ? `预计 ${remaining} 分钟后归来`
                  : '每次消耗一份行囊，旅行约 1 小时，归来带回纪念品和修为。'
              }}
            </p>
            <span>行囊 {{ game.supplies.food }} 份 · 旅途中不能切换、使用道具或切磋</span>
          </div>
          <button :disabled="!!game.journey || !game.supplies.food || working" @click="journey">
            {{ game.journey ? '旅途中' : '准备出发' }}
          </button>
        </div>
        <div v-if="game.souvenirs.length" class="souvenirs">
          <article v-for="item in game.souvenirs" :key="item.souvenir" class="postcard">
            <span>来自 {{ item.destination }} · 纪念 × {{ item.quantity }}</span>
            <strong>✧ {{ item.souvenir }}</strong>
            <p>{{ item.note }}</p>
          </article>
        </div>
        <p v-else class="battle-note">第一次旅行回来后，纪念品会收在这里。</p>
      </section>
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">LITTLE TREASURES</span>
            <h2>灵物小囊</h2>
          </div>
          <p>
            {{
              game.todayReward
                ? `今日获得 ${game.todayReward}${game.bonusToday ? `，连学奖励 ${game.bonusToday}` : ''}`
                : '每日学习随机获得照料道具'
            }}
          </p>
        </div>
        <div class="items">
          <div v-for="item in game.items" :key="item.id" class="item">
            <div
              class="item-icon"
              :class="item.kind === 'clean' ? 'item-icon-1' : item.kind === 'legacy' ? 'item-icon-2' : ''"
            >
              {{ item.kind === 'clean' ? '❋' : item.kind === 'legacy' ? '✧' : '✿' }}
            </div>
            <div class="item-info">
              <strong
                >{{ item.name }}
                <small :class="`rarity-${item.rarity}`">{{
                  { common: '普通', uncommon: '优良', rare: '珍稀', legacy: '旧藏' }[item.rarity]
                }}</small></strong
              >
              <span>{{ item.description }} · 持有 {{ item.quantity }}</span>
            </div>
            <button :disabled="!item.quantity || !!game.journey || working" @click="useItem(item.id)">
              {{ item.kind === 'food' ? '投喂' : item.kind === 'clean' ? '清洁' : '使用' }}
            </button>
          </div>
        </div>
        <p class="battle-note">
          普通 70% · 优良 25% · 珍稀 5%。已连续学习 {{ game.streak }} 天；每连续 3 天额外获得一件随机照料道具。
        </p>
      </section>
      <section class="section">
        <div class="section-heading">
          <div>
            <span class="eyebrow">FRIENDLY CHALLENGE</span>
            <h2>灵宠切磋</h2>
          </div>
          <p>无需同时在线 · 今日剩余 {{ game.battlesLeft }} 次</p>
        </div>
        <div v-if="!game.opponents.length" class="empty">还没有其他仙友，邀请朋友一起来学习吧。</div>
        <div v-else class="opponents">
          <div v-for="opponent in game.opponents" :key="opponent.id" class="opponent">
            <div class="mini-pet"><PetPortrait :species="opponent.species" /></div>
            <div class="opponent-info">
              <strong>{{ opponent.name }}</strong
              ><span>仙友 {{ opponent.id.slice(0, 6) }} · {{ opponent.element }}灵 · 等级 {{ opponent.level }}</span>
            </div>
            <button :disabled="!game.battlesLeft || !!game.journey || working" @click="battle(opponent.id)">
              切磋
            </button>
          </div>
        </div>
        <p class="battle-note">
          胜场 {{ game.pet.wins }} · 负场 {{ game.pet.losses }}。金克木、木克土、土克水、水克火、火克金；相克增加 20%
          力量，照料状态影响表现。
        </p>
        <div v-if="game.records.length" class="history">
          <div v-for="(record, i) in game.records" :key="i">
            <span>{{ record.won ? '获胜' : '落败' }} · {{ record.opponent }}</span
            ><span>{{ record.challenger_score }} : {{ record.defender_score }}</span>
          </div>
        </div>
      </section>
    </template>
    <div v-else class="state">
      <p role="alert">{{ error }}</p>
      <button @click="load">重试</button>
    </div>
  </div>
</template>

<style scoped>
.care-stats {
  display: grid;
  gap: 0.45rem;
  margin: 1.1rem 0 0.8rem;
}
.care-row {
  display: grid;
  grid-template-columns: 2.3rem 1fr 2rem;
  gap: 0.55rem;
  align-items: center;
  font-size: 0.75rem;
  color: var(--color-sub-text);
}
.care-row strong {
  text-align: right;
  font-size: 0.72rem;
  color: var(--color-main-text);
}
.care-track {
  height: 0.35rem;
  overflow: hidden;
  border-radius: 2rem;
  background: var(--color-third);
}
.care-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--color-select-bg);
}
.greet-button {
  border: 1px solid var(--color-line);
  border-radius: 0.5rem;
  padding: 0.45rem 0.7rem;
  background: var(--color-third);
  color: var(--color-link);
  font: inherit;
  font-size: 0.75rem;
  cursor: pointer;
}
.greet-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.pet-copy .care-hint {
  margin: 0.5rem 0 1rem;
  font-size: 0.7rem;
  line-height: 1.5;
}
.item-info small {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-sub-text);
}
.item-info small.rarity-uncommon {
  color: #488a67;
}
.item-info small.rarity-rare {
  color: #b07845;
}

.roster {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
}
.roster-card {
  display: grid;
  justify-items: center;
  gap: 0.4rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-second);
}
.roster-card span {
  color: var(--color-sub-text);
  font-size: 0.75rem;
}
.roster-card.unknown .roster-art {
  opacity: 0.2;
  filter: grayscale(1);
}
.roster-art {
  width: 6rem;
  max-width: 100%;
}
.roster-art svg {
  display: block;
  width: 100%;
}
.roster-card button,
.adventure-action button,
.journey-card button {
  padding: 0.5rem 0.8rem;
  border: 1px solid var(--color-line);
  border-radius: 0.5rem;
  color: var(--color-main-text);
  background: var(--color-third);
  cursor: pointer;
}
.roster-card button:disabled,
.adventure-action button:disabled,
.journey-card button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.adventure-action,
.journey-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-top: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-second);
}
.adventure-action p,
.journey-card p,
.journey-card span {
  color: var(--color-sub-text);
  font-size: 0.8rem;
  line-height: 1.6;
}
.journey-card p {
  margin: 0.4rem 0;
}
.souvenirs {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  margin-top: 0.8rem;
}
.postcard {
  display: grid;
  gap: 0.4rem;
  padding: 0.9rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-second);
  flex: 1 1 12rem;
}
.postcard span {
  color: var(--color-link);
  font-size: 0.7rem;
}
.postcard p {
  color: var(--color-sub-text);
  font-size: 0.75rem;
  line-height: 1.6;
}

.pet-page {
  max-width: 1040px;
  margin: 0 auto;
  padding: 3rem 1.5rem 6rem;
  color: var(--color-main-text);
}
.pet-heading,
.section-heading {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 1rem;
}
.pet-heading {
  padding: 1.4rem 0 2rem;
}
.eyebrow {
  color: var(--color-link);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.16em;
}
h1,
h2,
p {
  margin: 0;
}
h1 {
  margin: 0.45rem 0;
  color: var(--color-reverse-black);
  font:
    600 2.2rem 'Songti SC',
    Georgia,
    serif;
}
.pet-heading p:not(.eyebrow),
.section-heading p {
  color: var(--color-sub-text);
  font-size: 0.85rem;
}
.back-link {
  color: var(--color-link);
  font-weight: 650;
  font-size: 0.85rem;
  white-space: nowrap;
}
.pet-hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 250px;
  padding: 1.5rem 3rem;
  border: 1px solid var(--color-line);
  border-radius: 1.3rem;
  background: var(--color-second);
}
.pet-copy {
  flex: 1;
  max-width: 350px;
}
.tag {
  color: var(--color-link);
  font-size: 0.8rem;
}
.pet-copy h2 {
  margin: 0.9rem 0 0.4rem;
  font:
    600 2rem 'Songti SC',
    Georgia,
    serif;
  color: var(--color-reverse-black);
}
.pet-copy p {
  color: var(--color-sub-text);
  font-size: 0.85rem;
}
.exp-track {
  height: 6px;
  margin: 1rem 0 1.8rem;
  background: var(--color-third);
  border-radius: 9px;
  overflow: hidden;
}
.exp-track span {
  display: block;
  height: 100%;
  background: var(--color-select-bg);
  border-radius: inherit;
}
.pet-stats {
  display: flex;
  gap: 2.5rem;
}
.pet-stats div {
  display: grid;
  gap: 0.25rem;
}
.pet-stats strong {
  font-size: 1.4rem;
}
.pet-stats span {
  color: var(--color-sub-text);
  font-size: 0.75rem;
}
.pet-art {
  width: min(42%, 260px);
}
.pet-art svg {
  width: 100%;
  display: block;
}
.section {
  margin-top: 2.8rem;
}
.section-heading {
  margin-bottom: 1rem;
}
.section-heading h2 {
  margin-top: 0.4rem;
  color: var(--color-reverse-black);
  font:
    600 1.4rem 'Songti SC',
    Georgia,
    serif;
}
.items {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.8rem;
}
.item,
.opponent {
  display: flex;
  align-items: center;
  gap: 0.8rem;
  padding: 1rem;
  border: 1px solid var(--color-line);
  border-radius: 0.9rem;
  background: var(--color-second);
}
.item-icon {
  width: 2.7rem;
  height: 2.7rem;
  display: grid;
  place-items: center;
  border-radius: 0.75rem;
  color: #a85c46;
  background: #f3e3d4;
  font-size: 1.4rem;
}
.item-icon-1 {
  color: #59816c;
  background: #e1eddf;
}
.item-icon-2 {
  color: #8a7aaf;
  background: #ece7f2;
}
.item-info,
.opponent-info {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.25rem;
}
.item-info span,
.opponent-info span {
  font-size: 0.72rem;
  color: var(--color-sub-text);
}
.item button,
.opponent button,
.state button {
  border: 1px solid var(--color-line);
  border-radius: 0.5rem;
  padding: 0.45rem 0.75rem;
  background: var(--color-third);
  color: var(--color-main-text);
  cursor: pointer;
}
.item button:disabled,
.opponent button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.opponents {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.8rem;
}
.mini-pet {
  width: 3.5rem;
  flex: none;
}
.mini-pet svg {
  width: 100%;
  display: block;
}
.empty,
.state {
  padding: 2rem;
  border: 1px dashed var(--color-line);
  border-radius: 0.9rem;
  text-align: center;
  color: var(--color-sub-text);
}
.state p {
  margin: 0.8rem 0;
}
.battle-note {
  margin-top: 0.9rem;
  color: var(--color-sub-text);
  font-size: 0.75rem;
}
.history {
  margin-top: 1rem;
  border-top: 1px solid var(--color-line);
}
.history div {
  display: flex;
  justify-content: space-between;
  padding: 0.65rem 0;
  border-bottom: 1px solid var(--color-line);
  font-size: 0.8rem;
}
.notice {
  margin-bottom: 1rem;
  padding: 0.8rem 1rem;
  border-radius: 0.7rem;
  color: var(--color-link);
  background: var(--color-third);
}
.notice-error {
  color: #b74d42;
}
@media (max-width: 768px) {
  .pet-page {
    padding: 4rem 1rem 4rem;
  }
  .pet-heading {
    align-items: start;
  }
  .pet-hero {
    padding: 1.3rem;
    min-height: 0;
  }
  .pet-copy h2 {
    font-size: 1.6rem;
  }
  .pet-stats {
    gap: 1rem;
  }
  .items,
  .opponents {
    grid-template-columns: 1fr;
  }
  .section-heading {
    align-items: start;
    flex-direction: column;
  }
  .pet-art {
    width: 40%;
  }
}
@media (max-width: 520px) {
  .roster {
    gap: 0.4rem;
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
  .roster-card {
    padding: 0.6rem 0.25rem;
  }
  .roster-card button {
    padding: 0.4rem 0.3rem;
    font-size: 0.7rem;
  }
}
</style>
