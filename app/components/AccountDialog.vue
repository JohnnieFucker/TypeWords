<script setup lang="ts">
import { useAccountProgress } from '@/core/composables/useAccountProgress'

const account = useAccountProgress()
const signingOut = ref(false)

async function logout() {
  signingOut.value = true
  try {
    await account.signOut()
    await navigateTo('/')
  } catch {
    account.error.value = '退出失败，请检查网络'
  } finally {
    signingOut.value = false
  }
}
</script>

<template>
  <NuxtLink v-if="!account.user.value" to="/" class="account-link">登录</NuxtLink>
  <details v-else class="account-menu">
    <summary :aria-label="`账号：${account.user.value}`"><IconFluentPerson20Regular /></summary>
    <div class="account-popover">
      <span class="account-label">当前账号</span>
      <strong>{{ account.user.value?.startsWith('wx_') ? '微信用户' : account.user.value }}</strong>
      <span class="account-hint">学习完成后自动同步</span>
      <p v-if="account.error.value" class="account-error" role="alert">{{ account.error.value }}</p>
      <button type="button" :disabled="signingOut" @click="logout">{{ signingOut ? '正在退出…' : '退出登录' }}</button>
    </div>
  </details>
</template>

<style scoped>
.account-link,
summary {
  min-width: 2.25rem;
  height: 2.25rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.6rem;
  color: var(--color-main-text);
  cursor: pointer;
}
.account-link {
  padding: 0 0.65rem;
  font-size: 0.8rem;
  font-weight: 600;
}
.account-link:hover,
summary:hover {
  background: var(--color-fourth);
}
.account-menu {
  position: relative;
}
summary {
  list-style: none;
  font-size: 1.25rem;
}
summary::-webkit-details-marker {
  display: none;
}
.account-popover {
  position: absolute;
  top: calc(100% + 0.6rem);
  right: 0;
  z-index: 20;
  width: 13rem;
  display: grid;
  gap: 0.4rem;
  padding: 1rem;
  box-sizing: border-box;
  border: 1px solid var(--color-line);
  border-radius: 0.8rem;
  background: var(--color-second);
  box-shadow: 0 12px 30px #152c1c1a;
}
.account-label,
.account-hint {
  color: var(--color-sub-text);
  font-size: 0.75rem;
}
.account-popover strong {
  overflow-wrap: anywhere;
}
.account-popover button {
  margin-top: 0.6rem;
  padding: 0.55rem;
  border: 1px solid var(--color-line);
  border-radius: 0.45rem;
  color: var(--color-main-text);
  background: var(--color-third);
  text-align: left;
  cursor: pointer;
}
.account-error {
  color: #bd554a;
  font-size: 0.8rem;
}
</style>
