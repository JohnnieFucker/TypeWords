<script setup lang="ts">
import { useAccountProgress } from '@/core/composables/useAccountProgress'
import { useInit } from '@/core/composables/useInit'
import { withAppBaseURL } from '@/core/utils/base-url'

definePageMeta({ layout: 'empty' })

const account = useAccountProgress()
const init = useInit()
const ready = ref(false)
const initializationError = ref('')
const qrError = ref('')
const qrImage = ref('')
const qrLoading = ref(false)
let pollTimer: ReturnType<typeof setTimeout> | undefined
let disposed = false
let generation = 0

useSeoMeta({ title: 'WordsBattle · 一起修炼，一起成长' })

async function createQr() {
  const currentGeneration = ++generation
  clearTimeout(pollTimer)
  qrError.value = ''
  qrImage.value = ''
  qrLoading.value = true
  try {
    const result = await $fetch<{ url: string }>(withAppBaseURL('/api/auth/wechat/qr'), {
      method: 'POST',
      timeout: 10000,
    })
    const QRCode = await import('qrcode')
    if (disposed || currentGeneration !== generation) return
    const image = await (QRCode.default || QRCode).toDataURL(result.url, {
      width: 220,
      margin: 1,
      color: { dark: '#203d32', light: '#fbfaf5' },
    })
    if (disposed || currentGeneration !== generation) return
    qrImage.value = image
    if (!disposed && currentGeneration === generation) pollTimer = setTimeout(() => poll(currentGeneration), 2000)
  } catch (error: any) {
    if (currentGeneration === generation)
      qrError.value = error?.data?.statusMessage || error?.message || '无法生成二维码，请稍后重试。'
  } finally {
    if (currentGeneration === generation) qrLoading.value = false
  }
}

async function poll(currentGeneration: number) {
  try {
    const result = await $fetch<{ status: string; username?: string | null; message?: string }>(
      withAppBaseURL('/api/auth/wechat/status'),
      { timeout: 10000 }
    )
    if (disposed || currentGeneration !== generation) return
    if (result.status === 'authorized') {
      qrLoading.value = true
      const bound = localStorage.getItem('typewords-local-account')
      if (bound && bound !== result.username) {
        qrError.value = '本地学习数据属于其他账号，请使用独立浏览器登录。'
        qrLoading.value = false
        return
      }
      await $fetch(withAppBaseURL('/api/auth/wechat/claim'), { method: 'POST', timeout: 10000 })
      await account.initialize()
      if (!account.user.value) throw new Error(account.error.value || '登录失败，请重试。')
      await navigateTo('/words')
      return
    }
    if (result.status === 'expired' || result.status === 'error') {
      qrError.value = result.message || '二维码已过期，请刷新。'
      return
    }
  } catch (error: any) {
    if (currentGeneration === generation) {
      qrLoading.value = false
      qrError.value = error?.data?.statusMessage || error?.message || '连接失败，请刷新二维码重试。'
    }
    return
  }
  if (!disposed && currentGeneration === generation) pollTimer = setTimeout(() => poll(currentGeneration), 2000)
}

onMounted(async () => {
  try {
    await init()
    await account.initialize()
    ready.value = true
    if (account.user.value) await navigateTo('/words')
    else await createQr()
  } catch {
    initializationError.value = '本地学习数据加载失败，请刷新页面重试。'
  } finally {
    ready.value = true
  }
})
onUnmounted(() => {
  disposed = true
  generation++
  clearTimeout(pollTimer)
})
</script>

<template>
  <main class="welcome">
    <section class="welcome-story" aria-label="WordsBattle">
      <div class="brand">
        <img class="brand-mark" :src="withAppBaseURL('/imgs/logo/wordsbattle-mark.png')" alt="" width="40" height="40" />
        <span>WORDSBATTLE</span>
      </div>
      <div class="story-copy">
        <span class="eyebrow"><span class="eyebrow-line"></span> LEARN · GROW · BATTLE</span>
        <h1>Words grow<br /><em>with magic.</em></h1>
        <p>把单词留在指尖，<br />和你的仙宠，一起修炼成长。</p>
      </div>
      <div class="word-note" aria-hidden="true">
        <span class="note-index">A LITTLE EVERY DAY</span>
        <span class="note-word">grow<span>.</span></span>
        <span class="note-meaning">/ɡrəʊ/ &nbsp; v. 成长；逐渐变得更好</span>
      </div>
      <div class="story-footer"><span>ONE WORD AT A TIME</span><span>✳</span></div>
    </section>

    <section class="welcome-form" aria-labelledby="welcome-title">
      <div class="form-top"><span>YOUR SPACE TO LEARN</span><span class="form-top-mark">✳</span></div>
      <div class="form-body">
        <span class="form-kicker">WELCOME BACK</span>
        <h2 id="welcome-title">欢迎回来。</h2>
        <p class="form-description">用微信扫一扫，继续你的单词旅程。</p>
        <div class="qr-area">
          <div class="qr-frame">
            <img v-if="qrImage" :src="qrImage" alt="微信登录二维码" width="200" height="200" />
            <div v-else class="qr-placeholder">{{ qrLoading ? '正在生成二维码…' : '二维码不可用' }}</div>
          </div>
          <p class="qr-caption">打开微信扫一扫，完成授权</p>
          <button type="button" class="text-button" :disabled="qrLoading" @click="createQr()">刷新二维码</button>
        </div>
        <p v-if="initializationError || qrError || account.error.value" class="form-error" role="alert">
          {{ initializationError || qrError || account.error.value }}
        </p>
        <div class="guest-line">
          <span>想先试一试？</span
          ><button type="button" :disabled="!ready || !!initializationError" @click="navigateTo('/words')">
            直接开始学习 <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
      <div class="form-footer"><span>MADE FOR CURIOUS MINDS</span><span>© WORDSBATTLE</span></div>
    </section>
  </main>
</template>

<style scoped>
.welcome {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(430px, 0.95fr);
  background: #f6f4ec;
  color: #263c32;
}
.welcome-story {
  min-height: 100vh;
  box-sizing: border-box;
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: 42px clamp(32px, 5vw, 82px) 35px;
  color: #e6ecdd;
  background: #203d32;
}
.welcome-story::after {
  content: '';
  position: absolute;
  width: 500px;
  height: 500px;
  right: -235px;
  top: -260px;
  border: 1px solid #aac4a333;
  border-radius: 50%;
  box-shadow:
    0 0 0 60px #aac4a30b,
    0 0 0 120px #aac4a309;
  pointer-events: none;
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.2em;
}
.brand-mark {
  width: 40px;
  height: 40px;
  padding: 5px;
  box-sizing: border-box;
  object-fit: contain;
  background: #fbfaf5;
  border-radius: 10px;
}
.note-word span {
  color: #c3d79a;
}
.story-copy {
  margin: auto 0;
  padding: 75px 0 35px;
  position: relative;
  z-index: 1;
}
.eyebrow,
.note-index,
.story-footer,
.form-top,
.form-kicker,
.form-footer {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.17em;
}
.eyebrow {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #bdcdb4;
}
.eyebrow-line {
  width: 28px;
  height: 1px;
  background: #b5c8ac;
}
.story-copy h1 {
  margin: 25px 0;
  font:
    400 clamp(56px, 6.2vw, 96px)/0.98 Georgia,
    'Times New Roman',
    serif;
  letter-spacing: -0.055em;
}
.story-copy h1 em {
  color: #c9d9b3;
  font-weight: 400;
}
.story-copy p {
  margin: 0;
  color: #c2d0c3;
  font-size: 15px;
  line-height: 2;
  letter-spacing: 0.04em;
}
.word-note {
  display: flex;
  flex-direction: column;
  align-self: flex-end;
  width: min(280px, 62%);
  gap: 5px;
  margin-bottom: 42px;
  padding-top: 18px;
  border-top: 1px solid #adc6ac55;
}
.note-index {
  color: #a3baa5;
  font-size: 9px;
}
.note-word {
  font:
    italic 44px Georgia,
    serif;
  letter-spacing: -0.04em;
}
.note-meaning {
  font-size: 12px;
  color: #b5c7b7;
}
.story-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #a2b8a5;
  font-size: 9px;
}
.story-footer span:last-child {
  font-size: 19px;
  color: #d4dfc6;
}
.welcome-form {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 46px clamp(36px, 6vw, 100px) 35px;
}
.form-top,
.form-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  color: #8d9989;
  font-size: 9px;
}
.form-top-mark {
  color: #708b68;
  font-size: 20px;
}
.form-body {
  width: 100%;
  max-width: 420px;
  margin: auto;
  padding: 55px 0;
}
.form-kicker {
  color: #728c6f;
  font-size: 10px;
}
.form-body h2 {
  margin: 15px 0 8px;
  font-family: 'Songti SC', 'Noto Serif SC', Georgia, serif;
  font-size: clamp(33px, 3vw, 42px);
  font-weight: 600;
  letter-spacing: -0.06em;
  color: #263c32;
}
.form-description {
  margin: 0;
  color: #78877a;
  font-size: 14px;
}
.form-error {
  margin: 0 0 17px;
  font-size: 12px;
  line-height: 1.5;
  color: #a3483e;
}
.qr-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin: 32px 0 18px;
}
.qr-frame {
  display: grid;
  place-items: center;
  width: 222px;
  height: 222px;
  border: 1px solid #dce2d6;
  border-radius: 12px;
  background: #fbfaf5;
}
.qr-frame img {
  display: block;
  width: 200px;
  height: 200px;
}
.qr-placeholder {
  color: #78877a;
  font-size: 13px;
}
.qr-caption {
  color: #78877a;
  font-size: 13px;
}
.text-button {
  border: 0;
  padding: 0;
  background: transparent;
  color: #436e50;
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}
.text-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.guest-line {
  margin-top: 25px;
  display: flex;
  justify-content: space-between;
  color: #8a998a;
  font-size: 13px;
}
.guest-line button {
  padding: 0;
  border: 0;
  background: none;
  color: #436e50;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.guest-line button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.form-footer {
  gap: 16px;
}
@media (max-width: 760px) {
  .welcome {
    display: block;
  }
  .welcome-story {
    min-height: 0;
    padding: 24px 25px 28px;
  }
  .story-copy {
    padding: 50px 0 10px;
  }
  .story-copy h1 {
    font-size: clamp(46px, 12vw, 64px);
    margin: 18px 0;
  }
  .story-copy p {
    font-size: 13px;
  }
  .word-note,
  .story-footer {
    display: none;
  }
  .welcome-form {
    min-height: 0;
    padding: 28px 25px;
  }
  .form-body {
    padding: 42px 0 55px;
  }
  .form-top {
    display: none;
  }
}
</style>
