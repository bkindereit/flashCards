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

## Step 1: Open the Website & Sign In with Your Email
1. Open your web browser (Chrome, Safari, Edge, or Firefox) and click or type this web address into the top address bar:
   > **Web Address (URL):** **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**
2. You will see the **Adaptive Flashcards** sign-in screen in the center of the page:
   - Click inside the box that says **"Enter your email address"** and type your email address.
   - Click the blue **"Send Magic Sign-In Link"** button.
3. A green message will appear below the button:
   > *"Check your email for the magic sign-in link or OTP code!"*
4. Open your email inbox in another tab or on your phone (check your *Spam* or *Junk* folder if it doesn't arrive within 1 minute).
5. Open the email titled **"Magic Link"** and click **"Log In"**.
6. Your browser will automatically open to your personal **Your Flashcard Decks** home screen.

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

## Step 3: Upload the `.csv` File from Your Computer
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

## Step 5: Editing Cards or Downloading a Backup Copy
- **To Fix a Typo, Add a Single Card, or Delete a Card:**
  On your deck box, click the **Manage Cards** button (the **stacked-squares icon** next to the Upload arrow). You can search for any card using the search box, click **Edit** (pencil icon) to change the text, click **Delete** (trash icon) to remove it, or click **+ New Card** to type in one card manually.
- **To Save a Backup File to Your Computer:**
  Click **"Export JSON"** in the top-right corner of the screen at any time to save a complete backup file of your flashcards to your *Downloads* folder.

---
---

# Appendix: Cloud Database Setup & Sign-In Troubleshooting

### 1. Active Deployment Details
* **Live Website URL:** **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**
* **Database Backend:** Supabase PostgreSQL with FSRS adaptive memory, Row-Level Security, and RPCs.
* **Security & Privacy:** Every learner who signs in with their email has their own completely isolated, private database space. Nobody else can view or edit your decks or cards.

### 2. Troubleshooting Magic Sign-In Links
If clicking the email sign-in link opens `localhost:3000` or says `Email link is invalid or has expired`:
1. **Check Site URL in Supabase:**
   * Go to **[https://supabase.com/dashboard/project/fuqghjkscijbxrdkkdlv/auth/url-configuration](https://supabase.com/dashboard/project/fuqghjkscijbxrdkkdlv/auth/url-configuration)**.
   * Under **Site URL**, ensure it is set to:
     ```text
     https://bkindereit.github.io/flashCards/
     ```
   * Click **Save changes**.
   * Under **Redirect URLs**, click **Add URL**, enter `https://bkindereit.github.io/flashCards/**`, and click **Add URL**.
2. **Request a Brand-New Sign-In Link:**
   * Old sign-in emails contain the old redirect link and will expire.
   * Go back to **[https://bkindereit.github.io/flashCards/](https://bkindereit.github.io/flashCards/)**, enter your email address again, click **Send Magic Sign-In Link**, and click **Log In** in the newest email.

### 3. Setting Up a New Independent Database (Self-Hosters Only)
If you ever want to connect your own independent Supabase database project from scratch:
1. Create a free account at **[https://supabase.com/dashboard/sign-up](https://supabase.com/dashboard/sign-up)** (email and password, no GitHub account required).
2. Create a new project named `FlashCards`.
3. In **SQL Editor**, paste the database schema from:
   **[https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql](https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql)**
   and click **Run**.
4. In **Authentication → URL Configuration**, set **Site URL** to `https://bkindereit.github.io/flashCards/` (or your custom domain) and add `https://bkindereit.github.io/flashCards/**` to **Redirect URLs**.
