# 1
# SkinSol RWA — Чек-лист команд для тестирования

## 1️⃣ Локальная сеть (Localnet) — быстрые тесты

**Запуск локальной сети:**
```
anchor localnet
```

**Проверка кошелька и баланса:**
```
solana balance --url http://127.0.0.1:8899
```

**Деплой программы на localnet:**
```
anchor deploy --provider.cluster localnet
```

**Запуск unit-тестов:**
```
anchor test --provider.cluster localnet
```

**Проверка программы через CLI:**
```
solana program show <PROGRAM_ID> --url http://127.0.0.1:8899
```

---

## 2️⃣ Devnet — тест с сетью

**Настройка Devnet:**
```
solana config set --url https://api.devnet.solana.com
```

**Проверка кошелька и баланса:**
```
solana balance
```

**Если мало SOL — делаем airdrop:**
```
solana airdrop 2
solana balance
```

**Деплой программы:**
```
anchor deploy
```

**Запуск тестов (Devnet, рекомендовано сейчас):**

Вариант А — одной командой через npm-скрипт:
```
npm run test:devnet
```

Вариант Б — вручную через переменные окружения:
```
export ANCHOR_PROVIDER_URL=https://api.devnet.solana.com
export ANCHOR_WALLET=~/.config/solana/devnet.json
export USE_DEVNET=1
export PROGRAM_ID=Gk85ZcvrXHUsYB255MCKHpwcUc8gPp6vSYbHjtUGKxpD
npm test
```

**Проверка Program ID:**
```
solana program show <PROGRAM_ID>
```

**Демо на Devnet:**
```
npm run demo:devnet
```

Примечание: демо идемпотентное — повторный запуск не упадёт, если PDA уже создан. PROGRAM_ID можно переопределить через переменную окружения.

---

## 4️⃣ Шпаргалка к презентации

Что показать за 5–10 минут:
- Кратко: что делает SkinSol (депозиты, начисление, займ под NFT-skin — MVP логика на аккаунте Vault).
- Архитектура: Anchor-программа + PDA Vault; адрес программы: 2rRW9n…EXR (devnet).
- Demo: `npm run demo:devnet` (инициализация PDA при необходимости, депозит 500, вывод состояния).
- Тесты: `npm run test:devnet` (11 тестов, проходят на devnet).
- Что дальше: локальная сеть при полноценной среде SBF, расширение логики (реальный токен-ассет, погашение с переводами, оракулы цен, лимиты LTV).

---

## 5️⃣ Веб-клиент (React + Vite)

Папка: `app/web`

Настроен минимальный фронтенд с Solana Wallet Adapter (Phantom/Solflare), который умеет:
- Подключать кошелёк
- Инициализировать PDA (идемпотентно)
- Делать депозит 100
- Читать состояние Vault

Запуск (Devnet):
```
cd app/web
npm i
VITE_PROGRAM_ID=2rRW9nfaghs3yjMwehznx36TefCjMF4jwMjj8fihmEXR \
VITE_RPC_URL=https://api.devnet.solana.com \
npm run dev
```

Откройте http://localhost:5173 и подключите кошелёк (Phantom/Solflare). Кнопки: Init Vault / Deposit 100 / Fetch Vault.

Продакшен-сборка/превью:
```
npm run web:build
npm run web:preview
```
Предпросмотр поднимется на http://localhost:5175 (если 5174 занят). В сборке убран браузерный Metaplex JS; минт реализован через @solana/spl-token + mpl-token-metadata и работает в браузере без Node-полифиллов.

---

## 6️⃣ Аренда (Rental) — Web UI

Что уже есть в UI (папка `app/web`):
- List for rent — листинг NFT по mint-адресу с суточной ценой (USD).
- Rent — аренда на N дней (учёт арендатора и срока без реального перевода токенов; MVP-стейт в Listing PDA).
- Fetch listing — чтение состояния листинга.
- Liquidate — ручная ликвидация залога (MVP-инструкция).

PDA:
- Vault: seeds ["vault", authority]
- Listing: seeds ["listing", mint]

Важно: если обновлённая программа ещё не задеплоена на devnet, UI включает безопасный фоллбек — «симулирует» состояние листинга в localStorage. Это позволяет демонстрировать UX до деплоя. После деплоя всё автоматически перейдёт на on-chain вызовы.

Шаги в UI:
1) Подключить кошелёк.
2) (Опц.) Нажать Init Vault, затем Deposit 100 и Fetch Vault.
3) Ввести Mint address вашего NFT, указать Daily price (USD), нажать List for rent.
4) Для аренды: ввести Days и нажать Rent.
5) Нажать Fetch listing, чтобы увидеть актуальное состояние Listing.

---

## 7️⃣ Сминтить 3 NFT для демо

Скрипт минтит 3 NFT (Karambit, AWP Dragon Lore, Glock Fade) на devnet и выводит их mint-адреса:

```
npm run mint:nfts
```

Пример вывода:
```
[
	{ "name": "Karambit", "mint": "8jm8hJWqKFZ9ZhaeKMC2tpZRdAamGhfKiJkBA4yjFpVM" },
	{ "name": "AWP Dragon Lore", "mint": "jhSxZt4XZHLH7xL8ekZav1CXBwSizuGmZwipjvz4G55" },
	{ "name": "Glock Fade", "mint": "3HiMmuisxFAjg8WPQiphYdEz8FrsnA27fcP29g7pnAP1" }
]
```

Используйте эти mint-адреса в поле «Mint address» на странице, чтобы листить/арендовать NFT.

---

## 8️⃣ Деплой обновлённой программы (rental)

Если при деплое видите ошибку «Program's authority … does not match authority provided …», это означает, что upgrade authority программы не совпадает с вашим текущим ключом.

Есть три пути:

1) Использовать правильный upgrade authority (рекомендовано, если ключ доступен):
	 - Активируйте ключ текущего upgrade authority как `ANCHOR_WALLET`.
	 - Выполните сборку и деплой:
		 ```
		 anchor build
		 anchor deploy --provider.cluster devnet
		 ```
	 - Проверить:
		 ```
		 solana program show 2rRW9n…EXR --url https://api.devnet.solana.com
		 ```

2) Поменять upgrade authority на ваш текущий ключ (требует доступа к старому ключу):
	 - Владелец текущего upgrade authority выполняет смену на ваш новый ключ.
	 - После смены повторяете build/deploy.

3) Выпустить новый Program ID (быстрее всего, если доступа к старому ключу нет):
	 - Сгенерируйте новый ключ программы и обновите адреса:
		 - `programs/skinsol/src/lib.rs` — `declare_id!("<NEW_PROGRAM_ID>")`
		 - `Anchor.toml` — в `[programs.devnet]` и `[programs.localnet]`
		 - Web: переменная `VITE_PROGRAM_ID`
		 - Тесты/скрипты: `PROGRAM_ID` в окружении/скриптах
	 - Сборка и деплой на devnet из окружения с установленными Solana CLI и cargo-build-sbf.
	 - Учтите: PDA изменятся из-за нового Program ID (нормально для devnet/MVP).

В контейнере этого репо Solana CLI и SBF-плагина нет, поэтому build/deploy здесь не пройдут. Делайте деплой там, где настроен тулчейн (локальная машина/CI). UI и скрипты уже готовы — как только программа обновится на devnet, фронт перейдёт с «симуляции» на настоящие ончейн-вызовы.

Веб-клиент собирается без тяжёлых Node-полифиллов: мы отказались от @metaplex-foundation/js в браузере и используем прямые инструкции spl-token + mpl-token-metadata для минта.

---

## 9️⃣ Hackathon Checklist (готово к сдаче)

- Program ID (devnet): `Gk85ZcvrXHUsYB255MCKHpwcUc8gPp6vSYbHjtUGKxpD`  
	RPC: `https://api.devnet.solana.com`
- Demo (one-click):
	- `bash scripts/run-demo-devnet.sh`
	- Затем UI: `npm run web:dev` → http://localhost:5173
	- Флоу: Connect → Init Vault → Deposit 100 → Mint NFT → List → Rent → Fetch → (опц.) Liquidate
- Видео-демо: 1–3 минуты (показать флоу + один слайд архитектуры)
- Сборка фронта: `npm run web:build` → `npm run web:preview`

### Опционально: вход через Steam (link Steam ↔ Wallet)

Минимальный сервер уже добавлен: `app/server`.

1) Установка и запуск:
```
cd app/server
npm i
STEAM_API_KEY=... FRONTEND_URL=http://localhost:5173 node server.js
```
Сервер слушает на http://localhost:3000.

2) Поток:
- Откройте: `http://localhost:3000/auth/steam` → после логина редирект вернёт `?steamId=...` на фронт.
- Получите nonce: `GET /link/nonce?steamId=...` → подпишите в Phantom `signMessage(nonce)` → отправьте на `POST /link/verify` `{ steamId, pubkey, signature, nonce }`.
- Проверка подписи проходит через tweetnacl; маппинг steamId→pubkey хранится in-memory (достаточно для демо).  
- Проверка: `GET /link/lookup?steamId=...`.

3) Использование в UI:
- Добавьте кнопку «Link Steam», прочитайте `steamId` из query параметра, реализуйте вызовы `/link/nonce` и `/link/verify` c `wallet.signMessage`.
- Это даст подтверждённую связку внешнего аккаунта и Solana-кошелька.

---

## 10️⃣ Чек-лист для жюри (2–3 минуты)

1) Подключить Phantom → Init Vault → Deposit 100 → Fetch Vault.  
2) Mint NFT (Name/Symbol/URI) → получить mint и автоподставить его в Rental.  
3) List for rent (USD/день) → Rent (Days) → Fetch listing (видно renter/rented_until).  
4) (Опционально) Liquidate.  
5) Короткий комментарий по архитектуре: Vault PDA, Listing PDA, простая цена, без реальных переводов NFT в MVP.

---

## 11️⃣ Deploy на Vercel (Frontend + API)

Root Directory: `app/web`  
Build Command: `npm run build`  
Output Directory: `dist`

Переменные окружения (Project → Settings → Environment Variables):
- `FUND_WALLET_SECRET` — base58 приватный ключ devnet-кошелька (для `/api/credit/transfer`).
- `RPC_URL` — (опц.) https://api.devnet.solana.com
- `FRONTEND_URL` — (опц.) публичный адрес фронта.

Проверка после деплоя:
- Главная: `https://<project>.vercel.app/`
- API: `GET /api/link/nonce?steamId=test` (должен вернуть `{ nonce }`)
- Кредит: `POST /api/credit/transfer` `{ to, sol }` (вернёт `ok + signature` при корректном ключе)

Сценарий демо на проде:
1) Login with Steam (mock) → получаем `steamId` в URL.
2) Link Wallet → подписываем nonce, привязываем кошелёк.
3) Mint NFT → включить `Auto-deposit` и `Auto-credit` → получаем залог и DEV SOL.
4) List → Rent → Fetch (если есть время).

---

## 3️⃣ Советы для SkinSol RWA

- Локальная сеть — для разработки и unit-тестов.
- Devnet — только для интеграции с сетью и проверки взаимодействия с токенами/кошельками.
- Не смешивать localnet и Devnet кошельки — Program ID и SOL будут разными.
- Следить за балансом Devnet-кошелька: деплой требует ~1.5–2 SOL.