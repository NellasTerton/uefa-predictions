> ### 🗄️ Архив — версия 1
>
> Это первая версия проекта, сделанная под **чемпионат мира 2026**: прогнозы на матчи сборных, групповой этап и сетка плей-офф. Она свою задачу отработала и больше не развивается.
>
> Актуальная версия — **UEFA Predict 26/27** — переработана под клубные еврокубки: Лига чемпионов, Лига Европы и Лига конференций в одном приложении, общий рейтинг с разбивкой очков по турнирам и автоматическое обновление результатов. Смотреть в ветке [`main`](../../tree/main).
>
> ---
> ### 🗄️ Archive — version 1
>
> The original **FIFA World Cup 2026** edition. Superseded by **UEFA Predict 26/27**, the club-competition rework on the [`main`](../../tree/main) branch.

# 🏆 World Cup 2026 Predictions App

An offline-first, mobile-designed progressive web application (PWA) made for predictions, friendly leagues, and leaderboard tracking during the **FIFA World Cup 2026**. 

<img width="1672" height="941" alt="ChatGPT Image 11 июн  2026 г , 12_28_45" src="https://github.com/user-attachments/assets/592f28b1-0bfd-4ede-af00-280d1df65cd9" />

Web-version: [CLICK TO OPEN](https://fifa-world-cup-2026-predictions-624817335413.europe-west2.run.app)

### 💡 Concept & Motivation
The goal of this project is to deliver the excitement, friendly rivalry, and adrenaline of sports forecasting of a real bookmaker, but without any financial risk. It is a form of **"eco-friendly gambling"** for friends and colleagues, where the primary driver is the pure competitive spirit and proving whose football intuition is supreme. 

Developed as a challenge to build a fully functional cloud-based product from scratch in just 48 hours.

### 🛠️ Architecture & Tech Stack
*   **Frontend:** React (Vite) + Tailwind CSS (Mobile-first, high-fidelity dark neon theme).
*   **Database & BaaS:** Supabase (User profiles, secure credentials, and real-time predictions).
*   **Automation:** Serverless cron automation using Deno Edge Functions & PostgreSQL `pg_cron` extensions. It fetches official live data from the **API-Sports (REST API)** and completely recalculates the global leaderboard every 10 minutes.
*   **Hosting:** Fully containerized and hosted on **Google Cloud**.

### 🌟 Key Features
*   **Dual-Language Support:** Instant toggle between English and Russian (RU/EN).
*   **Strict Anti-Cheat Time-Lock:** Predictions are hard-locked on both the client side and the server side exactly at the scheduled kickoff time (`match_date`) to prevent players from waiting for game progression or to submit winning bets.
*   **Exact Score Scoring Engine:** 
    *   **5 Points:** For guessing the exact full-time score (e.g., predicting 2-1 when the match ends 2-1).
    *   **2 Points:** For predicting the correct outcome (winning team or draw) but with a different scoreline (e.g., predicting 2-1 when the match ends 2-0).
*   **Installable App (PWA):** Install straight to the home screen with customizable icons and standalone viewports.

## 📱 Installation Instructions / Как установить

### iOS (Safari)
1. Open the preview link in your Safari browser. / Откройте ссылку приложения в браузере Safari.
2. Tap the **"Share"** button (share icon). / Нажмите кнопку **«Поделиться»**.
3. Select **"Add to Home Screen"** from the list. / Выберите пункт **«На экран "Домой"»**.
4. Launch the app from your home screen directly without browser bars! / Запускайте прямо с рабочего стола как полноценное приложение!

### Android (Chrome)
1. Open the preview link in Google Chrome. / Откройте ссылку в браузере Chrome.
2. Tap the **three vertical dots** in the upper right. / Нажмите на **три точки** в правом верхнем углу.
3. Select **"Install App"** or **"Add to Home Screen"**. / Выберите **«Установить приложение»** или **«Добавить на главный экран»**.
