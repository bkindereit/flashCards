# Adaptive Flashcards — End-User Instruction Manual (Scenario A)

Welcome to **Adaptive Flashcards**! This guide walks a brand-new user on any computer (Mac, Windows, or Chromebook) through signing in, creating a deck, uploading a local `.csv` file of question-and-answer pairs, and studying with spaced repetition.

---

## Before You Begin: What You Need
1. **A Web Browser:** Chrome, Safari, Edge, or Firefox (no software installation required).
2. **An Email Address:** Used to receive your passwordless sign-in link.
3. **Your Local `.csv` File:** A spreadsheet saved in **CSV (Comma-Separated Values / UTF-8)** format on your computer containing your questions and answers.

### Preparing Your CSV File (Quick Check)
Your `.csv` file works automatically if the first row has the column headers `question` and `answer`:

```csv
question,answer
"What is the powerhouse of the cell?","The mitochondrion"
"What is Newton's Second Law?","Force equals mass times acceleration (F = ma)"
```

> **Tip:** Even if your CSV file uses different column names (such as `Front` and `Back` or `Prompt` and `Response`), the app will let you pick which column is the Question and which is the Answer during upload!

---

## Step 1: Open the App & Sign In
1. Open your web browser and navigate to the **Adaptive Flashcards web address (URL)**.
2. On the **Adaptive Flashcards** sign-in screen:
   - Click the **Enter your email address** box and type your email address.
   - Click the blue **Send Magic Sign-In Link** button.
3. You will see a green confirmation message:
   > *"Check your email for the magic sign-in link or OTP code!"*
4. Open your email inbox, open the email from **Adaptive Flashcards / Supabase Auth**, and click the **Log In / Magic Link**.
5. Your browser will open directly into **Your Flashcard Decks**.

*(Optional: If you want Adaptive Flashcards to appear as an app icon on your Desktop, Dock, or Taskbar, click the **Install** icon on the right side of the Chrome/Edge address bar, or choose **File → Add to Dock** in Safari on a Mac).*

---

## Step 2: Create a New Deck
1. On the **Your Flashcard Decks** screen, click the blue **+ Create Deck** button in the top-right corner (or in the center of the page if you have no decks yet).
2. In the **Create New Deck** window:
   - **Deck Name (Required):** Enter a name for your subject (e.g., *Biology 101* or *AWS Certification*).
   - **Description (Optional):** Add a short note about what the deck covers.
   - **Target Exam Date (Optional):** If you are preparing for a test on a specific date, select the date here.
   - **Scheduling Settings (Optional):** You can leave **Desired Retention** (`0.90` = 90% memory target) and **Cohort Size** (`10` cards per learning group) at their recommended defaults.
3. Click **Create Deck** (or **Save**). Your new deck card will appear on the dashboard.

---

## Step 3: Upload Your Local CSV File
1. Find your new deck on the **Your Flashcard Decks** screen.
2. On the bottom bar of that deck card, click the **Upload (Import CSV)** icon button (the upward arrow icon next to the blue **Study** button).
3. The **Import CSV Flashcards** window will open:
   - Click inside the dashed box labeled **"Choose a UTF-8 .csv file"**.
   - Browse your computer (e.g., your *Downloads*, *Documents*, or *Desktop* folder), select your `.csv` file, and click **Open**.
4. **If Column Mapping Is Requested:**
   - If your file did not use the exact headers `question` and `answer`, an amber **Column Mapping Required** box will appear.
   - Choose your question column under **Question Column**, choose your answer column under **Answer Column**, and click **Apply Mapping**.
5. **Review the Import Preview:**
   - You will see four summary counters:
     - **Total Data Rows:** Total rows read from your file.
     - **Valid Inserts (Green):** Valid flashcards ready to be added.
     - **File Duplicates (Amber):** Duplicate questions/answers automatically skipped so you never study the same card twice.
     - **Rejected (Red):** Blank or malformed rows skipped (if any exist, you can click **Download Rejected Rows** to inspect them).
   - Scroll through the **Preview First 20 Parsed Rows** table to verify that your questions and answers look right.
6. Click the blue **Commit Import** button in the bottom-right corner.
7. Once finished, the window closes automatically and your flashcards are safely stored in your deck!

---

## Step 4: Start a Timed Study Session
1. On your deck card, click the blue **▶ Study** button.
2. A **Start Study Session** window will ask how long you want to study:
   - Pick a preset button (**5 min**, **10 min**, **15 min**, **20 min**, **30 min**, **45 min**, or **60 min**) or type a custom number of minutes.
   - Click **Start Session**.
3. **Studying Each Card:**
   - Read the **Question** displayed on the screen and think of the answer.
   - Click **Show Answer** (or press `Space` or `Enter` on your keyboard).
   - Compare your answer to the revealed **Answer**, then grade yourself honestly:
     - Click **I got it!** (or press `1` on your keyboard) if you recalled it accurately.
     - Click **Dang, I missed it!** (or press `2` on your keyboard) if you forgot or got it wrong.
4. **Helpful Controls During Study:**
   - **Undo Last Grade:** Made a typo or clicked the wrong button? Click **Undo Last Grade** at the bottom of the card to immediately step back and re-grade the previous card.
   - **Pause / Resume:** Need to step away? Click **Pause** in the top bar so the countdown timer and response timer stop until you click **Resume Study**.
   - **End Session:** Click **End Session** at any time to finish early and view your session summary.
5. **Session Summary:**
   - When the timer finishes (or all due cards are completed), you will see your **Study Session Completed** summary showing **Cards Reviewed**, **Correct**, **Missed**, **New Cards**, **Due Remaining**, and **Accuracy %**.
   - Click **Return to Deck** to go back to your dashboard.

---

## Step 5: Managing Cards & Backing Up Your Data
- **Add, Edit, Search, or Delete Individual Cards:**
  On any deck card, click the **Manage Cards** icon (the stacked-layers icon next to the Upload button). From there, you can search your cards, edit typos in questions/answers, add single cards manually, or delete cards.
- **Download a Full Backup Anytime:**
  Click **Export JSON** in the top navigation bar to download a complete backup file of all your decks, cards, and FSRS study history to your computer.
