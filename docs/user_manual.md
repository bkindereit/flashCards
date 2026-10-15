# Adaptive Flashcards — User Manual (No GitHub Account Required)

> **Ready to Use Anywhere:**
> This application is live on the web at **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**.
> You do **not** need a GitHub account, do **not** need to install any software, and do **not** need to set up any database. Simply follow **Steps 1–5** below on any computer or phone.

---

## What You Need Before Starting
1. **Any Web Browser:** Chrome, Safari, Microsoft Edge, or Firefox.
2. **Your Email Address:** Used to receive a one-click sign-in link (no password to remember).
3. **Your `.csv` File of Questions & Answers:** Saved on your computer (for example, in your *Desktop*, *Documents*, or *Downloads* folder).

### How Your `.csv` Spreadsheet Should Look
If you created your flashcards in **Excel**, **Google Sheets**, or **Apple Numbers**:
- Put all your **Questions** in **Column A** and all your **Answers** in **Column B**.
- Type `question` in the top-left cell (**A1**) and `answer` in the next cell (**B1**).
- Save or export the file as **CSV UTF-8 (Comma delimited) (`.csv`)**.

---

## Step 1: Open the Website & Sign In
1. Open your web browser (Chrome, Safari, Edge, or Firefox) and click or type this web address into the top address bar:
   > **Web Address (URL):** **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**
2. You will see the **Adaptive Flashcards** sign-in screen in the center of the page:

### Creating a New Account
If you are a new user without an account:
1. Click the blue link at the bottom: **"Create an account"**.
2. Type your email address in the **"Enter your email address"** box.
3. Type a secure password (minimum 6 characters) in the **"Create a password"** box.
4. Click the green **"Create Account"** button.
5. If your project has email confirmation enabled, check your email inbox to confirm your address, then sign in!

---

### Method 1: Password Sign-In (Instant — No Email Waiting)
1. In the first box (**"Enter your email address"**), type your email address (e.g. `bastiankindereit@gmail.com`).
2. In the second box (**"Enter your password"**), type your password.
3. Click the blue **"Sign In with Password"** button.
4. You will immediately be signed in to your **Your Flashcard Decks** home screen!

---

### Method 2: Magic Sign-In Link or 6-Digit Email Code
If you prefer passwordless sign-in or have not set a password:
1. Type your email address in the email box.
2. Click the gray **"Send Magic Sign-In Link / Code"** button.
3. Open your email inbox for the message:
   - **Option A (6-Digit Code):** Enter the 6-digit verification code into the box that appears and click **"Verify Code & Sign In"**.
   - **Option B (One-Click Link):** Click the sign-in link inside the email.
4. Your browser will open to your personal **Your Flashcard Decks** home screen!

---

## Step 2: Create a New Flashcard Deck
1. On the **Your Flashcard Decks** screen, click the blue **"+ Create Deck"** button.
2. A small window titled **Create New Deck** will pop up:
   - **Deck Name:** Type a name for your topic (for example, `Biology Chapter 1` or `Real Estate Exam`).
   - **Description (Optional):** Leave blank, or type a short note.
   - **Target Exam Date (Optional):** Leave blank unless you want to enter an upcoming test date.
   - Leave the other settings (**Desired Retention** `0.90` and **Cohort Size** `10`) alone.
3. Click the blue **"Create Deck"** button at the bottom of the pop-up window.
4. You will now see a box for your new deck on your home screen.

---

### Method A: Uploading a `.csv` File from Your Computer
1. Look at your new deck box on the home screen. Along the bottom of that box, right next to the blue **▶ Study** button, click the **Upload button** (the gray square icon with an **upward-pointing arrow ↑**).
2. A window titled **"Import CSV Flashcards"** will open:
   - **CSV Delimiter:** The app automatically detects whether your file uses commas (`,`), semicolons (`;`), tabs (`\t`), or pipes (`|`). If your CSV was generated in Europe or Excel with semicolons, the dropdown automatically switches to **Semicolon (;)**, or you can change it manually at any time.
   - Click in the middle of the big dashed box that says **"Choose a UTF-8 .csv file"**.
   - A file window will open showing the folders on your computer.
   - Click the folder where your file is saved (such as *Desktop*, *Downloads*, or *Documents*), click on your **`.csv` file**, and click **"Open"**.
3. **If a Yellow Box Appears Saying "Column Mapping Required":**
   - *(This only happens if the first row of your spreadsheet didn't say `question` and `answer`.)*
   - In the **Question Column** dropdown menu, choose the column that has your questions.
   - In the **Answer Column** dropdown menu, choose the column that has your answers.
   - Click the yellow **"Apply Mapping"** button.
4. **Check Your Preview:**
   - The window will show how many cards were found under **Valid Inserts** (in green) and show the first 20 questions and answers in a table.
   - Glance at the table to make sure your questions are under **Question** and your answers are under **Answer**.
5. Click the blue **"Commit Import"** button in the bottom-right corner of the window.
6. The window will close — all of your question-and-answer pairs are now uploaded and saved!

---

### Method B: Manually Typing Question & Answer Pairs (No CSV File Needed)
If you prefer to type questions and answers in directly by hand:
1. On your deck box, click the **`+` (Add Card)** button (or click **Manage Cards**, the stacked-squares icon).
2. Click the blue **"+ Add Card"** button at the top right of the screen.
3. An input panel titled **"Add Question & Answer Pair (Concatenated to Deck)"** will appear:
   - In the **Question** box, type your question prompt.
   - In the **Answer** box, type your answer.
4. Click the blue **"Save Card"** button.
5. Your card is validated (ensuring non-blank content and no duplicate cards) and concatenated directly onto the end of your deck!
6. You can repeat this to type in as many question-answer pairs as you want.

---

## Step 4: Study Your Flashcards
1. On your deck box, click the blue **"▶ Study"** button.
2. A window will ask how long you want to study:
   - Click one of the time buttons (**5 min**, **10 min**, **15 min**, **20 min**, **30 min**, **45 min**, or **60 min**).
   - Click the blue **"Start Session"** button.
3. **Going Through Your Cards:**
   - Read the **Question** shown on the card and think of the answer.
   - Click the blue **"Show Answer"** button (or press the **Spacebar** on your keyboard).
   - Read the **Answer** that appears, then click one of the two buttons below it:
     - Click the green **"I got it!"** button (or press **`1`** on your keyboard) if you knew the answer.
     - Click the red **"Dang, I missed it!"** button (or press **`2`** on your keyboard) if you missed it.
   - The next card will appear automatically. Cards you miss will come back more often; cards you know well will be spaced out over days and weeks.
4. **Helpful Buttons While Studying:**
   - **Undo Last Grade** *(at the bottom of the card)*: If you clicked the wrong button by mistake, click this to go back one card.
   - **Pause** *(top right)*: Freezes the timer if you need to step away from your computer.
   - **End Session** *(top right)*: Finishes your study session early and shows your score.
5. When your timer finishes, you will see the **Study Session Completed** screen with your score and accuracy. Click **"Return to Deck"** to go back to your home screen.

---

## Step 5: Editing Existing Cards or Exporting Backups
- **To Edit Any Existing Card:**
  1. On your deck box, click the **Manage Cards** button (the stacked-squares icon).
  2. Find the card you want to modify (you can use the search bar to locate it quickly).
  3. Click the **Edit (pencil icon)** on the right side of that card's row.
  4. Type your updated Question and/or Answer directly in the textboxes.
  5. Click the green checkmark button to save. Your review count, accuracy, and spaced repetition memory state are fully preserved!
- **To Suspend or Pause a Card:**
  Click the pause button in the card's row to temporarily exclude it from study sessions without deleting it.
- **To Delete a Card Permanently:**
  1. Click the red **Trash Can icon** on the right side of the card's row.
  2. In the confirmation dialog, review the card prompt and click **"Delete Card"** to confirm.
  3. The card and its historical records are permanently removed from the deck.
- **To Save a Backup File to Your Computer:**
  Click **"Export CSV"** in Card Management or **"Export JSON"** at the top of the home screen to download all your decks and cards.

---

## Step 6: Tracking Your Learning Progress & Mastery
The **Learning Progress Dashboard** provides analytics and forecast visualizations so you always know your retention rate and readiness:

### How to Access the Dashboard
- **From the Top Header:** Click or tap the **"Progress"** button (green trending line icon) in the top navigation bar.
- **From the Home Screen:** Tap the **"View Dashboard"** button in the prominent quick progress banner above your decks.
- **For a Specific Deck:** Click the green **TrendingUp icon** on any individual deck card to jump straight into that deck's metrics.

### Key Metrics & Visualizations Displayed
1. **Deck Mastery Breakdown (Segmented Progress Bar):**
   - Visual color-coded bar displaying the exact proportion and counts of your cards in each stage:
     - 🟩 **Mature Review:** Cards successfully memorized and managed on long-term spaced repetition.
     - 🟦 **Learning:** Cards currently undergoing initial acquisition.
     - 🟧 **Lapsed (Relearning):** Cards previously known that were forgotten and are currently being restudied.
     - ⬛ **New Unseen:** Fresh cards imported or created that have not yet been studied.
     - 🟥 **Suspended:** Cards you temporarily paused from study.
2. **True Recall Accuracy & Active Study Time:**
   - **True Accuracy %:** Lifetime recall percentage based on all binary review events.
   - **Time Spent:** Total active study time in minutes (excludes paused intervals).
   - **Total Sessions & Cards in Scope:** Total sessions completed and cards currently available.
3. **Study Streak & 28-Day Activity Heatmap:**
   - **Daily Streak:** Tracks consecutive active days studied to maintain your learning habit.
   - **4-Week Calendar Grid:** Color-coded square matrix displaying study activity across the past 28 days (lighter to darker emerald based on daily review volume).
4. **Upcoming 7-Day Due Forecast:**
   - Mini bar chart showing the number of review cards scheduled to become due over each of the next 7 days (Today, Tomorrow, and subsequent weekdays).
   - A direct **"Study Due Cards"** button lets you immediately launch a session if cards are waiting.
5. **Exam Target Readiness & Pace Tracker:**
   - If your deck has a Target Exam Date configured, this panel tracks:
     - **Days Remaining:** Exact countdown to your exam.
     - **Required Daily Pace:** How many new cards you need to introduce per day to finish before exam day.
     - **Curriculum Progress:** Percentage of the deck already introduced into active memory.
     - **On Track Indicator:** Green status badge confirming whether your current pace is manageable.
6. **Trouble Spots & Difficult Cards List:**
   - Automatically ranks and displays your top lapsed and missed questions.
   - Click **"Show answer"** to preview the correct answer.
   - Click **"Practice"** to launch an adaptive recall session focused on reinforcing difficult concepts.

### Smartphone & Tablet Usability
- The dashboard is fully responsive: columns stack neatly on smartphones ($\ge 360\text{px}$) and expand into multi-column grid cards on tablets ($\ge 768\text{px}$).
- All buttons and interactive controls feature touch targets of at least $44\times 44\text{px}$ for effortless tapping on touchscreens.

---
---

# Appendix: Cloud Database Setup & Sign-In Troubleshooting

### 1. Active Deployment Details
* **Live Website URL:** **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**
* **Database Backend:** Supabase PostgreSQL with FSRS adaptive memory, Row-Level Security, and RPCs.
* **Security & Privacy:** Every learner who signs in with their email has their own completely isolated, private database space. Nobody else can view or edit your decks or cards.

### 2. Using on Mobile Phones & Tablets (iOS & Android)
Adaptive Flashcards is responsive and touch-optimized for smartphones (iPhone, Android) and tablets (iPad, Android tablets):
* **Touch-Friendly Targets:** All primary buttons (Reveal Answer, Grade buttons, Create Deck, Upload) are sized to at least 44×44 pixels for easy one-handed tapping.
* **Input Zoom Prevention:** Text fields are calibrated to avoid automatic iOS Safari zoom when typing.
* **Add to Home Screen (PWA App Mode):**
  * **On iPhone / iPad (Safari):** Tap the **Share** button (box with upward arrow) at the bottom/top of Safari, scroll down, and tap **"Add to Home Screen"**.
  * **On Android (Chrome):** Tap the **three-dots menu** at the top right and select **"Add to Home screen"** or **"Install app"**.
  * The app will now launch directly from your home screen in distraction-free, full-screen mode!

### 3. Troubleshooting Magic Sign-In Links & 6-Digit Codes
* **If the Email Link Opens and Returns to Sign-In:**
  Use **Option A**! Simply copy the **6-digit verification code** printed inside the email message, enter it into the **"Enter 6-digit code"** box on the screen, and click **"Verify Code & Sign In"**. This signs you in immediately without depending on link redirects.
* **If You See "Email rate limit exceeded":**
  Supabase protects against spam by limiting emails to 1 per 60 seconds. Wait 60 seconds before clicking "Send Magic Sign-In Link / Code" again. If you already received a code in your inbox, you do not need to wait—just enter the code directly and click "Verify Code & Sign In".
* **Check Site URL in Supabase:**
  If you host your own database, go to **Authentication → URL Configuration** in the Supabase Dashboard:
  * Under **Site URL**, ensure it is set to:
    ```text
    https://bkindereit.github.io/flashCards/
    ```
  * Under **Redirect URLs**, add `https://bkindereit.github.io/flashCards/**`.

### 3. Setting Up a New Independent Database (Self-Hosters Only)
If you ever want to connect your own independent Supabase database project from scratch:
1. Create a free account at **[https://supabase.com/dashboard/sign-up](https://supabase.com/dashboard/sign-up)** (email and password, no GitHub account required).
2. Create a new project named `FlashCards`.
3. In **SQL Editor**, paste the database schema from:
   **[https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql](https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql)**
   and click **Run**.
4. In **Authentication → URL Configuration**, set **Site URL** to `https://bkindereit.github.io/flashCards/` (or your custom domain) and add `https://bkindereit.github.io/flashCards/**` to **Redirect URLs**.
