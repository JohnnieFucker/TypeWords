<script setup lang="ts">
withDefaults(defineProps<{ species?: string; stage?: string }>(), { species: 'fox', stage: '初生' })
const names: Record<string, string> = {
  rabbit: '月灵兔',
  deer: '青芽鹿',
  crane: '云羽鹤',
  turtle: '山灵龟',
  fox: '小灵狐',
}
</script>

<template>
  <svg viewBox="0 0 240 220" role="img" :aria-label="names[species] || '灵兽'">
    <ellipse cx="120" cy="198" rx="72" ry="12" fill="#d5ddbd" opacity=".55" />
    <circle cx="120" cy="106" r="89" fill="#edf0db" />
    <circle
      v-if="stage === '化灵'"
      cx="120"
      cy="106"
      r="82"
      fill="none"
      stroke="#c2a76b"
      stroke-width="2"
      stroke-dasharray="4 7"
    />
    <path
      v-if="species === 'rabbit'"
      d="M78 81 Q55 -3 80 13 Q101 28 104 76 M137 76 Q146 10 165 13 Q188 18 161 84"
      fill="#f4e7d5"
      stroke="#b5a898"
      stroke-width="4"
      stroke-linecap="round"
    />
    <path
      v-else-if="species === 'deer'"
      d="M84 75 Q57 42 67 27 M69 44 L53 31 M156 75 Q183 42 173 27 M171 44 L187 31"
      fill="none"
      stroke="#9a8f70"
      stroke-width="6"
      stroke-linecap="round"
    />
    <path
      v-else-if="species === 'crane'"
      d="M72 100 Q48 60 79 66 L103 84 M168 100 Q192 60 161 66 L137 84 M112 70 Q120 35 128 70"
      fill="#f4efe4"
      stroke="#a5aaa2"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <path
      v-else-if="species === 'turtle'"
      d="M63 104 Q55 43 120 42 Q185 43 177 104 M88 57 L120 80 L152 57 M82 88 L120 80 L158 88"
      fill="#94aa7f"
      stroke="#718d6a"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <path
      v-else
      d="M67 91 Q52 28 91 49 L105 76 M173 91 Q188 28 149 49 L135 76"
      fill="#d6a47d"
      stroke="#af7f62"
      stroke-width="4"
      stroke-linejoin="round"
    />
    <path
      d="M57 133 Q58 74 120 70 Q182 74 183 133 Q181 187 120 188 Q59 187 57 133"
      :fill="
        species === 'fox' ? '#dfb38d' : species === 'deer' ? '#d8c6a4' : species === 'turtle' ? '#d5dfbf' : '#f2e6d6'
      "
      stroke="#9e927c"
      stroke-width="4"
    />
    <path d="M82 153 Q89 122 120 137 Q151 122 158 153 Q153 178 120 179 Q87 178 82 153" fill="#f8f4e7" />
    <ellipse cx="94" cy="126" rx="5" ry="7" fill="#35473b" />
    <ellipse cx="146" cy="126" rx="5" ry="7" fill="#35473b" />
    <ellipse cx="120" cy="145" rx="5" ry="4" fill="#806d61" />
    <path
      d="M120 149 Q115 156 110 152 M120 149 Q125 156 130 152"
      fill="none"
      stroke="#806d61"
      stroke-width="2"
      stroke-linecap="round"
    />
    <circle cx="78" cy="145" r="7" fill="#e2a49b" opacity=".55" />
    <circle cx="162" cy="145" r="7" fill="#e2a49b" opacity=".55" />
    <path d="M113 69 Q111 55 122 51 Q134 55 128 68" fill="#89a775" />
    <path d="M119 62 Q126 58 132 62" fill="none" stroke="#e4edcf" stroke-width="2" />
    <path
      d="M32 93 l4 -7 4 7 7 4 -7 4 -4 7 -4 -7 -7 -4z M196 119 l3 -5 3 5 5 3 -5 3 -3 5 -3 -5 -5 -3z"
      fill="#c6d09a"
    />
  </svg>
</template>
