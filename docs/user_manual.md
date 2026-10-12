# Adaptive Flashcards — Complete Step-by-Step User Manual

This manual is written for a **brand-new user on a brand-new computer** with everyday computer skills. You do **not** need to install any software, and you do **not** need to use a terminal or write any code. Everything is done inside your regular web browser (Chrome, Safari, Edge, or Firefox).

---

## Why Isn't There a Web Address (URL) Yet?
Right now, the FlashCards program code is stored on GitHub (`https://github.com/bkindereit/flashCards`), which is like a folder of blueprints. To get your own personal, private **Web Address (URL)** and your own free **Cloud Database** where your flashcards are saved, you complete **Part 1** once in your web browser (~10 minutes, 100% free). After that, you will have a permanent bookmarkable link you can open on any computer or phone forever.

---

## Part 1: One-Time Setup to Get Your Web Address (URL)
*(You only do Part 1 once. Everything is free and no credit card is required.)*

### Step 1A: Create Your Free Cloud Database (Supabase)
1. Open your web browser and go to **[https://supabase.com](https://supabase.com)**.
2. Click **Start your project** (top right) and sign in with your **GitHub** account (or create a free account with your email).
3. Click the green **New project** button:
   - **Organization:** Leave the default selected.
   - **Name:** Type `FlashCards`
   - **Database Password:** Click **Generate a password** (you won't need to type this password again).
   - **Region:** Pick the region closest to where you live.
   - Click **Create new project**.
4. Wait about 60 seconds while the page says *"Setting up project..."* until it finishes.

### Step 1B: Set Up the Flashcard Tables in Your Database
1. Open a **second browser tab** and go to this exact link (this is the database setup file from the project):
   **[https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql](https://raw.githubusercontent.com/bkindereit/flashCards/main/supabase/migrations/20261010000000_initial_schema.sql)**
2. Select all the text on that page (**Ctrl + A** on Windows, or **Cmd + A** on Mac) and copy it (**Ctrl + C** or **Cmd + C**).
3. Go back to your **Supabase** browser tab:
   - On the left-hand menu bar, click **SQL Editor** (the icon that looks like `>_`).
   - Click into the big blank text area on the right and **Paste** (**Ctrl + V** or **Cmd + V**) the text you copied.
   - Click the green **Run** button in the bottom-right corner.
   - You will see **`Success. No rows returned`** at the bottom. *(Your database tables are now ready!)*

### Step 1C: Copy Your Two Database Connection Keys
1. Still in Supabase, look at the left-hand menu bar and click **Project Settings** (the **Gear icon ⚙️** at the bottom of the left sidebar).
2. In the Settings menu that appears, click **API** (or **Data API**).
3. Keep this tab open — you will copy two things from this page in the next step:
   - **Project URL:** A web link that looks like `https://abcdefghijklm.supabase.co`
   - **Project API Keys → `anon` `public`:** A long string of letters and numbers that starts with `eyJ...` (click the **Copy** button next to `anon` `public`).

### Step 1D: Publish Your Personal Web Address for Free (Vercel)
1. Open a new browser tab and go to **[https://vercel.com](https://vercel.com)**.
2. Click **Sign Up** (or **Log In**), choose **Hobby (Free)**, and click **Continue with GitHub**.
3. Once logged in to Vercel, click the **Add New...** button (top right) and select **Project**.
4. Under **Import Git Repository**, find **`flashCards`** in the list and click **Import** next to it.
   *(If you don't see `flashCards`, click **Adjust GitHub App Permissions** on that screen to allow Vercel to see your `flashCards` repository).*
5. On the **Configure Project** page, click to expand the section called **Environment Variables**. You will add **two** items here:
   - **Item 1:**
     - In the **Key** box, type exactly: `VITE_SUPABASE_URL`
     - In the **Value** box, paste your **Project URL** from Step 1C (e.g., `https://abcdefghijklm.supabase.co`).
     - Click **Add** (if there is an Add button, or move to the second row).
   - **Item 2:**
     - In the **Key** box, type exactly: `VITE_SUPABASE_ANON_KEY`
     - In the **Value** box, paste your **`anon` `public` key** from Step 1C.
     - Click **Add**.
6. Click the big **Deploy** button at the bottom.
7. Wait about **45–60 seconds** while Vercel builds your site. Confetti will appear on screen with the message **"Congratulations!"**
8. Click **Continue to Dashboard**. Under **Domains**, you will see your new permanent **Web Address (URL)** — it will look like:
   **`https://flash-cards-yourname.vercel.app`**
9. **Copy that `https://...vercel.app` link!** That is your personal Adaptive Flashcards web address.

### Step 1E: Connect Your Sign-In Email Link to Your New Web Address
1. Switch back to your **Supabase** browser tab one last time.
2. On the left-hand menu bar, click **Authentication** (the **Lock icon 🔒**), then click **URL Configuration**.
3. Look for the box labeled **Site URL** (it currently says `http://localhost:3000`):
   - Erase `http://localhost:3000` and **paste your new `https://...vercel.app` address** from Step 1D.
   - Click the green **Save changes** button.

**🎉 One-Time Setup Complete!** Bookmark your `https://...vercel.app` link in your browser. You will never have to repeat Part 1 again, even if you buy a new computer or use your phone.

---

## Part 2: Daily Use — Signing In, Uploading Your CSV, and Studying

### Step 1: Check Your Local `.csv` File
Before uploading, make sure your question-and-answer spreadsheet on your computer is saved as a **`.csv` (CSV UTF-8)** file.
- If you made your list in **Microsoft Excel**, **Apple Numbers**, or **Google Sheets**:
  - Put your questions in **Column A** and your answers in **Column B**.
  - Put `question` in cell **A1** and `answer` in cell **B1** (optional, but saves a step!).
  - Click **File → Save As** (or **Download**) and choose **CSV UTF-8 (Comma delimited) (`.csv`)**.

---

### Step 2: Open Your Web Address & Sign In
1. Open your bookmarked **`https://...vercel.app`** web address in your browser.
2. On the **Adaptive Flashcards** sign-in box:
   - Click inside **Enter your email address** and type your email address.
   - Click the blue **Send Magic Sign-In Link** button.
3. A green message will appear:
   > *"Check your email for the magic sign-in link or OTP code!"*
4. Open your email inbox (check your *Spam/Junk* folder if you don't see it within 30 seconds), open the email titled **Magic Link**, and click **Log In**.
5. Your browser will open directly into **Your Flashcard Decks**.

*(Optional Tip: Want an icon on your Desktop or Dock so it feels like an installed program? In Chrome or Edge, click the little **Computer/Download icon** on the right side of the address bar and click **Install**. In Safari on a Mac, click **File → Add to Dock**).*

---

### Step 3: Create a Deck for Your Cards
1. On the **Your Flashcard Decks** screen, click the blue **+ Create Deck** button.
2. A window will pop up:
   - **Deck Name:** Type a name for your flashcards (for example, `Spanish Vocabulary` or `History Exam`).
   - **Description (Optional):** You can leave this blank or write a short note.
   - **Target Exam Date (Optional):** Leave blank unless you want to track a test date.
   - Leave the other numbers (**Desired Retention** `0.90` and **Cohort Size** `10`) as they are.
3. Click the blue **Create Deck** button. Your new deck box now appears on the screen.

---

### Step 4: Upload Your `.csv` File from Your Computer
1. Look at your new deck box on the screen. At the bottom of that box, right next to the blue **▶ Study** button, click the **Upload button** (the icon with an **upward-pointing arrow ↑**).
2. A window titled **Import CSV Flashcards** will open:
   - Click anywhere inside the big dashed box that says **"Choose a UTF-8 .csv file"**.
   - A file finder window from your computer will open. Go to the folder where your `.csv` file is saved (such as *Desktop*, *Documents*, or *Downloads*), click your `.csv` file, and click **Open**.
3. **If You See a Yellow "Column Mapping Required" Box:**
   - This only appears if your spreadsheet didn't name the first row `question` and `answer`.
   - Use the **Question Column** dropdown to pick the column that has your questions.
   - Use the **Answer Column** dropdown to pick the column that has your answers.
   - Click the yellow **Apply Mapping** button.
4. **Check the Preview:**
   - You will see four boxes showing:
     - **Total Data Rows:** How many rows were in your file.
     - **Valid Inserts (Green):** How many flashcards are ready to be added.
     - **File Duplicates (Yellow):** Any identical duplicate rows that were automatically skipped.
     - **Rejected (Red):** Any blank rows that were skipped.
   - Below that, you will see the first 20 questions and answers in a table so you can double-check that Question and Answer aren't backwards.
5. Click the blue **Commit Import** button in the bottom-right corner of the window.
6. The window will close, and all of your questions and answers are now saved in your deck!

---

### Step 5: Study Your Flashcards
1. On your deck box, click the blue **▶ Study** button.
2. A window will ask **how many minutes** you want to study:
   - Click one of the time buttons (**5 min**, **10 min**, **15 min**, **20 min**, **30 min**, **45 min**, or **60 min**) and click **Start Session**.
3. **How to Review Each Card:**
   - Read the **Question** on screen and think of the answer in your head.
   - Click the blue **Show Answer** button (or press the **Spacebar** or **Enter** key on your keyboard).
   - The **Answer** will appear below the question, along with two grading buttons:
     - Click the green **I got it!** button (or press **`1`** on your keyboard) if you knew the answer.
     - Click the red **Dang, I missed it!** button (or press **`2`** on your keyboard) if you missed it.
   - The app automatically schedules cards you missed to come back sooner, and spaces out cards you know well!
4. **Other Buttons on the Study Screen:**
   - **Undo Last Grade** *(bottom of card)*: Clicked the wrong button by mistake? Click this to go right back to the card you just graded.
   - **Pause** *(top right)*: Pauses the study timer if you need to take a break.
   - **End Session** *(top right)*: Stops studying early and shows your score summary.
5. When your timer runs out (or you finish all due cards), a **Study Session Completed** screen shows how many cards you reviewed and your accuracy percentage. Click **Return to Deck** to go back to your home screen.

---

### Step 6: Viewing, Editing, or Backing Up Your Cards Later
- **To View, Search, Edit, or Delete Individual Cards:**
  On your deck box, click the **Manage Cards** button (the **stacked-squares icon** next to the Upload arrow). Here you can search for a word, click **Edit** to fix a typo on a card, click **Delete** to remove a card, or click **+ New Card** to type in a single card by hand.
- **To Save a Backup Copy to Your Computer:**
  Click **Export JSON** in the top-right bar of the screen at any time to download a complete backup file of all your decks and flashcards.
