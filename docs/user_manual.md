# Adaptive Flashcards — User Manual (No GitHub Account Required)

> **Important Note Before Sharing This Manual:**
> Right now, this application has not been published to a public website link yet.
> - **Completed Once by the App Owner:** Follow **Appendix A** at the bottom of this document **one time** (~10 minutes, free, email-only—no GitHub account needed) to create your live Web Address (e.g., `https://my-flashcards.netlify.app`) and paste that link into **Step 1** below.
> - **For Every End User After That:** Once that link is created, **End Users only follow Steps 1–5 below**. They do **not** need a GitHub account, do **not** need to install any software, and do **not** need to set up any database.

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
   > **Web Address (URL):** `https://YOUR-FLASHCARDS-LINK-HERE.netlify.app` *(Replace with your live link once Appendix A is completed once)*
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

# Appendix A: One-Time Setup to Create the Live Web Address (No GitHub Account Required)

*Because this application was just built, it does not have a live website address on the internet yet. Complete the steps below **one time** using only an email address (no GitHub account required) to create the free database and live website link.*

### 1. Create a Free Supabase Database Using Email & Password
1. In your web browser, go to **[https://supabase.com/dashboard/sign-up](https://supabase.com/dashboard/sign-up)**.
2. Enter your **Email address** and choose a **Password**, then click **Sign up** *(do **not** click Continue with GitHub)*.
3. Open your email inbox, click the confirmation link from Supabase, and sign in.
4. Click **New project**:
   - **Name:** `FlashCards`
   - **Database Password:** Click **Generate a password**
   - Click **Create new project** and wait ~60 seconds for it to finish setting up.
5. Set up the database tables:
   - Open the file `supabase/migrations/20261010000000_initial_schema.sql` located in your `flashCards` project folder (in TextEdit, Notepad, or Antigravity), select everything (**Ctrl+A** on Windows / **Cmd+A** on Mac), and copy it (**Ctrl+C** / **Cmd+C**).
   - Switch back to your Supabase browser tab, click **SQL Editor** (`>_` icon on the left menu), **Paste** (**Ctrl+V** / **Cmd+V**) into the text box, and click the green **Run** button (bottom right). It will say `Success. No rows returned`.
6. Find your two database keys:
   - In Supabase, click **Project Settings** (the **Gear icon ⚙️** at the bottom of the left menu) → click **API** (or **Data API**).
   - Keep this page open so you can copy:
     1. **Project URL** (looks like `https://abcdefghijklm.supabase.co`)
     2. **`anon` `public` Key** (long code starting with `eyJ...`)

### 2. Publish Your Live Website Link for Free
Once your Project URL and `anon` `public` key are ready, we can build your ready-to-upload `dist` website folder right here on your Mac so you can drag-and-drop it onto **[https://app.netlify.com/drop](https://app.netlify.com/drop)** (which only asks for an email address and password—no GitHub account needed) and immediately get your permanent `https://...netlify.app` web address!
