<h1 align=center>
  <img src="https://github.com/user-attachments/assets/9d626e0f-0601-4640-8981-ad66d8ac4853" alt="TypeWords" style="width: 500px;"/>
</h1>

<p align="center">
  <a href="/README.md">English</a> |
  <a href="/docs/README.es.md">Español</a> |
  <a href="/docs/README.de.md">Deutsch</a> |
  <a href="/docs/README.fr.md">Français</a> |
  <a href="/docs/README.pt.md">Português</a> |
  <a href="/docs/README.ru.md">Русский</a> |
  <a href="/docs/README.uk.md">Українська</a> |
  <a href="/docs/README.ja.md">日本語</a> |
  <a href="/docs/README.ko.md">한국인</a> |
  <a href="/docs/README.th.md">ไทย</a> |
  <a href="/docs/README.vi.md">Tiếng Việt</a> |
  <a href="/docs/README.id.md">Bahasa Indonesia</a> |
  <a href="/docs/README.zh-TW.md">繁體中文</a> |
  <a href="/docs/README.zh-CN.md">简体中文</a> 
</p>

<p align="center">
  <b>Learn English, one keystroke at a time; smarter memorization, more efficient learning - an open-source word practice tool</b>
</p>

## Project Introduction

<https://www.bilibili.com/video/BV1QwYv6eEAS>

## Online Access

<https://typewords.cc>

<img width="1920" height="1440" alt="practice words" src="/public/imgs/words.png" />

## Features

### Word Practice

- Practice modes: Follow-along / Dictation / Self-test / Spelling from memory
- Smart mode: Automatically calculates learning words based on memory curves, deepening memory through dictation
- Free mode: No restrictions, plan your own learning
- Provides phonetics, pronunciation (American/British), example sentences, phrases, synonyms, root words, etymology, error statistics, and more

### Favorites, Wrong Words, Mastered

- Words typed incorrectly while learning are automatically added to your wrong word book for later review
- Actively add words to mastered to automatically skip them in future sessions
- Add words to favorites for consolidation and review

### Highly Customizable

- Rich keyboard sound effects
- Customizable shortcuts
- Highly configurable settings

### Clean and Efficient

- Clean design, modern UI, ad-free
- Refreshing interface, simple operation
- No forced subscription to any platform

### Vocabulary Library

Built-in commonly used vocabulary including CET-4, CET-6, GMAT, GRE, IELTS, SAT, TOEFL, Graduate English, TEM-4, TEM-8, and more (official website only).
Designed to meet most users' vocabulary learning needs. Community contributions of additional vocabulary are welcome.

## Running the Project

#### Note: This project can run standalone with data saved locally. Manual backup is required when switching devices; this does not affect normal usage.

This project is built with `Nuxt` and requires a Node.js environment.

1. Install NodeJS, refer to the [official documentation](https://nodejs.org/en/download)
2. The project is large. It's recommended to use `git clone --depth 1 https://github.com/zyronon/TypeWords.git` to clone only the latest commit. GitHub's Download ZIP feature will not work properly.
3. In the project root directory, open a terminal and run `pnpm install` to download dependencies.
4. Run `pnpm run dev` to start the project. The default address is [`http://localhost:5567`](http://localhost:5567)
5. Open [`http://localhost:5567`](http://localhost:5567) in your browser to access the project.
6. Run `pnpm run generate` to build the project files.

## Features and Suggestions

The project is currently in early development, with new features being added continuously. If you have any suggestions or feature requests, feel free to open an `Issue`.
If you like the design philosophy of this software, please submit a `PR`. Thank you for your support!

## Contributing Guide

[Contributing Guidelines](/docs/CONTRIBUTING.md)

If you're interested in this project, we welcome your contributions and will provide as much help as possible.

Before contributing, please communicate with the developers to avoid code conflicts.

Thank you again for your contributions!


## ❤️ Support TypeWords
If TypeWords has been helpful to you, feel free to sponsor the project to support server operation and future development.  
Of course, sponsorship is not required for use—sharing the project, submitting feedback, or contributing code are also highly valuable forms of support.

<img width="300" height="390" alt="practice words" src="/public/imgs/zhifubao.png" />
<img width="300" height="390" alt="practice words" src="/public/imgs/weixin.png" />


## 内置账号和学习进度同步

运行环境需要 Node.js 22.13 或更高版本。使用 `pnpm install` 和 `pnpm dev` 启动后，可通过首页的微信二维码登录；完成学习任务后，学习记录会同步到运行该服务的服务器。其他设备需要访问同一个服务器并登录同一账号。学习中断时的进度和个人设置保存在当前浏览器，不会实时同步。

服务器使用 SQLite，默认数据库位置是项目目录下的 `.data/typewords.sqlite`，可通过 `TYPEWORDS_DATA_DIR` 环境变量指定持久化目录。部署时需要持久化并备份该目录（包括 SQLite 的 WAL 文件），同时使用 HTTPS。静态生成的站点没有账号接口，无法使用同步。原用户名密码账号可在登录页验证后绑定微信，原学习进度保持不变。退出账号后本地数据仍保留，同一浏览器配置文件中的本地学习数据绑定首次登录的账号；使用其他账号请使用独立浏览器配置文件。

跨设备合并以较大的词典学习位置和较新的单词复习状态为准；删除单词或将学习位置回退目前不会同步到其他设备。自定义词典仅同步单词原文，不同步释义、例句等内容。

### 微信公众号扫码登录配置

需要已开通网页授权的微信公众号，并在公众号后台配置与回调地址一致的网页授权域名；按微信要求将域名验证文件放在站点根目录。在项目根目录的 `.env` 文件中配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 和 `WECHAT_CALLBACK_URL`；该文件已被 Git 忽略。如文件不存在，可从 `.env.example` 复制。回调地址必须是 HTTPS，格式为 `https://你的域名/api/auth/wechat/callback`；如使用部署子路径，应在 `/api` 前加入该子路径。服务端从启动目录的 `.env` 读取配置；已有系统环境变量优先。AppSecret 仅供服务端使用，不要提交到代码仓库。

电脑生成一次性二维码，手机通过微信扫码，在微信内完成公众号网页授权；授权成功后返回电脑，电脑建立登录会话。旧账号可选择“已有旧账号？绑定微信”，验证原用户名和密码后扫码；已有微信账号不能绑定到另一个旧账号。扫码登录需可被手机访问的 HTTPS 服务，单独访问本机 `localhost` 无法完成授权。
