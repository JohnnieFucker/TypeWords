<script setup lang="ts">
import { BaseIcon } from '@/base'
import IeDialog from '@/components/dialog/IeDialog.vue'
import useTheme from '@/core/hooks/theme.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { ShortcutKey } from '@/core/types/enum.ts'
import { onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useInit } from '@/core/composables/useInit.ts'
import { useI18n } from 'vue-i18n'
import WordCollectPopover from '@/components/word/WordCollectPopover.vue'
import AccountDialog from '@/components/AccountDialog.vue'
import { useAccountProgress } from '@/core/composables/useAccountProgress'

const { toggleTheme, getTheme, setTheme } = useTheme()
const settingStore = useSettingStore()
const init = useInit()

watch(
  () => settingStore.load,
  n => {
    if (!n) return
    setTheme(settingStore.theme)
  }
)

watch(
  () => settingStore.theme,
  n => {
    setTheme(n)
  }
)

const { locales, setLocale } = useI18n()
const route = useRoute()

const showIcon = $computed(() => {
  return ['/words', '/setting'].includes(route.path)
})

const account = useAccountProgress()
function retrySync() {
  if (account.user.value && !location.pathname.includes('/practice-words/')) {
    account.restore().catch(() => {})
  }
}
watch(
  () => route.path,
  path => {
    if (path === '/words') retrySync()
  }
)
onMounted(async () => {
  await init()
  await account.initialize()
  window.addEventListener('online', retrySync)
})
onUnmounted(() => window.removeEventListener('online', retrySync))
</script>

<template>
  <div class="layout anim">
    <IeDialog />

    <div class="flex-1 z-1 relative main-content overflow-x-hidden">
      <!--      <slot></slot>-->
      <router-view></router-view>

      <div class="app-actions" v-if="showIcon">
        <NuxtLink to="/words" v-if="route.path === '/setting'" :aria-label="$t('words')">
          <BaseIcon :title="$t('words')"><IconFluentTextUnderlineDouble20Regular /></BaseIcon>
        </NuxtLink>
        <AccountDialog />
        <NuxtLink to="/setting" :aria-label="$t('setting')">
          <BaseIcon :title="$t('setting')"><IconFluentSettings20Regular /></BaseIcon>
        </NuxtLink>
        <details class="language-menu">
          <summary aria-label="选择语言"><IconPhTranslate /></summary>
          <div class="language-options">
            <button v-for="locale in locales" :key="locale.code" type="button" @click="setLocale(locale.code)">
              {{ locale.name }}
            </button>
          </div>
        </details>

        <BaseIcon
          :title="`${$t('toggle_theme')}(${settingStore.shortcutKeyMap[ShortcutKey.ToggleTheme]})`"
          @click="toggleTheme"
        >
          <IconFluentWeatherMoon16Regular v-if="getTheme() === 'light'" />
          <IconFluentWeatherSunny16Regular v-else />
        </BaseIcon>
      </div>
    </div>
    <WordCollectPopover />
  </div>
</template>

<style scoped lang="scss">
.layout {
  width: 100%;
  height: 100%;
  display: flex;
  background: var(--color-primary);
}
.app-actions {
  position: absolute;
  right: 1.4rem;
  top: 1.25rem;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-second);
}
.language-menu {
  position: relative;
}
.language-menu summary {
  width: 2.25rem;
  height: 2.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  list-style: none;
  border-radius: 0.6rem;
  cursor: pointer;
  font-size: 1.3rem;
}
.language-menu summary::-webkit-details-marker {
  display: none;
}
.language-menu summary:hover {
  background: var(--color-fourth);
}
.language-options {
  position: absolute;
  top: calc(100% + 0.6rem);
  right: 0;
  width: 11rem;
  max-height: 60vh;
  overflow: auto;
  padding: 0.4rem;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-second);
  box-shadow: 0 12px 30px #152c1c1a;
}
.language-options button {
  display: block;
  width: 100%;
  padding: 0.55rem 0.7rem;
  border: 0;
  border-radius: 0.4rem;
  color: var(--color-main-text);
  background: transparent;
  text-align: left;
  cursor: pointer;
}
.language-options button:hover {
  background: var(--color-third);
}
@media (max-width: 768px) {
  .app-actions {
    top: 0.75rem;
    right: 0.75rem;
  }
}
</style>
