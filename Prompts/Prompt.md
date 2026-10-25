# Latest approved updates (25 October 2026)

These updates supersede the older requirements below: student signup/login uses university registration ID and signup name without a password or access key; teams and numbers are verified against the supplied roster using registration IDs only; any roster member may claim the single leader portal; no fixed member/team cap; release makes Start Quiz available without starting timers; papers are balanced randomly across roster teams; selecting the first module starts forty minutes; opening module selection consumes no time; choose only the first module, then follow a server-randomized sequence gated on correctness; hints require a cancellable cost confirmation and use non-additive total deduction tiers; students never receive scores/performance and return home within sixty seconds; a top theme toggle supports persisted dark/light mode. Supplied papers and answer keys must stay as written.

---

# MASTER SYSTEM PROMPT & SPECIFICATION DOCUMENT

**PROJECT TARGET:** Gamified Online Assessment & Anti-Malpractice Quizzing Platform

**PROJECT NAME:** Mathematics Quiz 3 Portal

**HOSTING & INFRASTRUCTURE:** Vercel (Next.js / Frontend & Serverless API), Supabase / PostgreSQL or MySQL Database

## 1. EXECUTIVE SUMMARY & INSTRUCTION TO AI AGENT

You are an expert Full-Stack Software Architect and Cybersecurity Engineer. Your task is to build a complete, production-grade, secure web application for hosting a gamified mathematics quiz ("Mathematics Quiz 3") for branch students.
  
This specification contains **all functional requirements, user workflows, security threat models, database schemas, API routes, and anti-cheating mechanisms** required to deploy the system. You must follow every constraint, business rule, and security directive outlined below without omitting or altering any existing rule.

## 2. SYSTEM ARCHITECTURE & CORE WORKFLOWS

### 2.1 Entity & Role Structure

1. **Students & Teams:**
    
    - Students form teams of up to **5 members** externally in class prior to logging in.
          
    - **Team Size:** Maximum of 5 members, minimum of 1 member (flexible 1–5 range).  
        
    - **Team Leader:** Exactly 1 student per team acts as the Team Leader.
        
    - **Representation:** The Team Leader alone logs in and performs all administrative/quiz actions on behalf of the entire team.
        
    - **Team Allotment:** The system automatically assigns a unique **Team Number between 1 and 12** upon registration (Maximum allowed teams = 12).
        
2. **System Administrator:**
    
    - Authenticates via a dedicated, secure **Admin Portal** using a special designated admin username.
        
    - Exercises master control over all team data, paper releases, real-time tracking, lockout management, and state restoration.
        

## 3. DETAILED FUNCTIONAL REQUIREMENTS

### 3.1 Authentication & Leader Onboarding

- **Login Credentials:** Team Leaders authenticate using their official **Registration Number** as their username.
    
- **First-Time Registration Engine:**
    
    - When a Registration Number is entered for the first time, the system automatically creates an account by requesting the Leader's **Name** and **Registration Number**.
        
    - System must remember the logged-in session (via secure HTTP-only JWT cookies or Supabase Auth session).
        
- **Duplicate Registration Prevention:**
      
    - If a student's Registration Number (Leader or team member) is already present in the database from a prior registration, the system strictly blocks them from re-registering or creating a duplicate team.
        

### 3.2 Portal Navigation & Team Registration Flow

1. **Landing / Home Page:**
    
    - Upon successful sign-in, the Team Leader is directed to the main Dashboard/Home Page.
        
    - The Home Page prominently features a clickable block/section titled **"Mathematics Quiz 3"**.
        
2. **Team Registration Page:**
    
    - Clicking "Mathematics Quiz 3" redirects the user to the **"Team Registration"** page.
        
    - The form mandates entering the names and registration numbers for **all team members** (including the Team Leader themselves).  
        
    - Validates member count ($1 \le \text{members} \le 5$).
        
3. **Team Number Allotment:**
      
    - Upon form submission and database verification, the system assigns a unique **Team Number (Integer between 1 and 12)**.
        
4. **Waiting Room:**
      
    - Upon team confirmation, the Leader is redirected to a dedicated **Quiz Waiting Room**.
        
    - The team remains in this state awaiting manual paper release instructions from the Admin.
        

### 3.3 Test Format & Gamified Exam Engine

- **Subject & Scope:** Mathematics.
- **Total Test Duration:** Each assigned set (A, B or C) has a total time limit of **40 minutes** from the team's server-recorded start. At expiry, finalize marks already earned and reject further answers and hint requests. Refreshes, disconnections, lockouts and paper callbacks do not reset or extend this clock.
    
- **Syllabus Modules:** Exactly 5 modules named `Module-1`, `Module-2`, `Module-3`, `Module-4`, and `Module-5`.
    
- **Question Paper Sets:**
      
    - Exactly **3 Question Paper Sets** (Set A, Set B, Set C) preloaded in the backend.
        
    - Each set contains **5 questions**, worth **2 marks each** (Total = 10 marks per set).
        
    - Question-to-Module Mapping: Question $N$ corresponds directly to `Module-N` (Q1 $\rightarrow$ Module-1, Q2 $\rightarrow$ Module-2, ..., Q5 $\rightarrow$ Module-5).
        
- **Random Allotment & Admin Controls:**
      
    - Upon paper release by the Admin, the system randomly assigns 1 of the 3 sets to each team.
        
    - Admin retains full capability to view, override, and manually change set assignments at any time.
        
- **Test Execution Environment:**
      
    - When the quiz starts, it opens in a dedicated secure web window/page.
        
    - **Game-Style Progression:**
          
        - Participants can view 1 question at a time from their assigned set.
            
        - Users have the freedom to choose which question to attempt based on the module name.
            
        - **Key Input & Validation:** Answers are whole numbers. Input forms accept alphanumeric strings to accommodate various input methods, but sanitize and validate inputs strictly against the numerical key.
            
        - **Gatekeeping Logic:** The submitted answer acts as a "Key". Unless the key is **100% correct**, the team is locked from completing that module/question and cannot move forward to complete the remaining test requirements.
            
- **Time-Gated Hint System:**
    
    - Hints are **strictly locked** for the first 5 minutes ($300\text{ seconds}$) of the exam.
        
    - After 5 minutes elapse, the "Request Hint" button activates.
        
    - Each question has a custom pre-set maximum number of hints available.
        
    - Requesting a hint automatically applies a pre-configured mark deduction (as specified in the paper marking scheme) from the question's total score.
        
- **Scoring & Completion:**
      
    - Once all 5 questions are successfully solved, the final score is tallied.
        
    - **Database Persistence:** The database stores:
        
        - Final total team score.
            
        - Itemized per-question marks breakup.
            
        - Marks deducted due to hint usage.
            
        - The final submitted answer "keys".
            
        - Complete team details (member names, registration IDs, team number).
            

### 3.4 Post-Quiz Lifecycle & Lockout

1. **60-Second Auto-Close Window:**
    
    - Upon quiz completion, a prominent 60-second timer begins on screen.
        
    - The team has 60 seconds to close the window manually, after which the browser window/tab closes programmatically.
        
2. **Re-Attempt Lockdown:**
     
    - No re-attempts are allowed under any circumstances.
        
    - Upon completion, the "Mathematics Quiz 3" section on the Home Page becomes permanently **unresponsive/disabled** for that team.
        
    - Only the Admin has rights to re-issue or unlock quizzes.
        

## 4. ADMIN PORTAL SPECIFICATION

- **Authentication:** Accessed via a special, configurable admin username.
    
- **Master Dashboard Functionality:**
      
    1. **Team & Activity Monitoring:** Live view of all 12 teams, member details, assigned team numbers, allotted question paper sets, current active question/module, time elapsed, and hint usage.
        
    2. **Set Allotment Management:** Capability to view and manually override the randomly assigned paper set for any team.
        
    3. **Paper Release Controls:** Pre-loaded paper sets (Set 1, Set 2, Set 3) remain unreleased by default. Admin can manually trigger global release or call-back the paper release at will.
        
          
        
    4. **Manual Quiz Closure:** Admin can manually withdraw and close the quiz portal for individual teams or globally once the exam is completed.
        
          
        
    5. **Disciplinary & Lockout Controls:**
        
          
        - Admin can manually lock out any team if malicious activity is observed.
            
              
            
        - Admin can manually lift locks/bans and restore the team's exact previous test state.
            
              
            

## 5. THREAT MODELING, SECURITY VULNERABILITIES & EXPLOIT MITIGATION

To ensure maximum integrity, the system must address the following critical vulnerabilities and architectural flaws:

  

```
+-----------------------------------------------------------------------------------+
|                            ATTACK SURFACE & THREAT MODEL                          |
+-----------------------------------------------------------------------------------+
| 1. Client-Side Key Extraction      --> Mitigated via Server-Side Key Evaluation     |
| 2. Premature Hint API Scraping    --> Mitigated via Server-Enforced Time Checks   |
| 3. Proctoring Bypass (DevTools/Tab)--> Mitigated via Multi-Event Lockouts & SSE   |
| 4. Concurrent Registration Exploits--> Mitigated via DB Unique Constraints & Locks |
| 5. IDOR / State Tampering          --> Mitigated via Row Level Security & Signed JWT|
| 6. Network Drop State Loss        --> Mitigated via Server-Synced State Hydration |
+-----------------------------------------------------------------------------------+
```

### Threat 1: Client-Side Answer Key & Hint Leakage (CRITICAL)

- **Vulnerability:** If answer keys, marking schemes, or hints are embedded in frontend JavaScript bundles, API payloads, or LocalStorage, students can inspect network traffic or memory to obtain correct answers instantly.
    
      
    
- **Mitigation Strategy:**
    
      
    - **Zero-Key Frontend Architecture:** Answer keys and full hint texts must **NEVER** be sent to the client browser.
        
          
        
    - **Server-Side Evaluation:** Key validation is performed exclusively via secure API endpoints (Next.js Server Actions or Supabase Edge Functions).
        
          
        
    - **Payload Isolation:** The client receives only `{ question_id, question_text, module_id }`. When an answer is submitted, the server compares the hash/value of the submitted key against the database, returning only `{ success: boolean, attempts: number }`.
        
          
        
    - **Time-Gated Hint Delivery:** Hints are stored securely in the database. The API route checks `server_now >= quiz_start_time + 300s` before returning hint text. Requests made prior to 5 minutes return HTTP 403 Forbidden.
        
          
        

### Threat 2: Proctoring & Anti-Malpractice Bypasses

- **Vulnerability:** Browser events (`visibilitychange`, `blur`) can be blocked using extensions, DevTools breakpoints, or running unmonitored secondary displays/browsers.
    
      
    
- **Mitigation Strategy:**
    
      
    - **Multi-Layer Event Monitoring:**
        
          
        - Page Visibility API (`document.hidden`, `visibilitychange`).
            
              
            
        - Window Focus/Blur (`window.onblur`, `window.onfocus`).
            
              
            
        - Cursor Boundaries (`document.mouseleave`).
            
              
            
        - Keyboard Interception: Intercept and disable `Alt+Tab`, `Ctrl+Tab`, `F12`, `Ctrl+Shift+I`, `Ctrl+C`, `Ctrl+V`, `Context Menu` (right-click).
            
              
            
        - Screen Resolution Delta Monitoring: Detect DevTools docking by checking `window.outerWidth - window.innerWidth` and `window.outerHeight - window.innerHeight`.
            
              
            
    - **Server-Side Heartbeat & Lockout:**
        
          
        - The client sends an encrypted ping every 3 seconds containing focus state and window metrics.
            
              
            
        - If a ping is missed or reports a focus violation, the server immediately sets `teams.is_locked = TRUE` in the database.
            
              
            
        - Upon lockout, the user UI instantly renders a hard lockout screen requiring Admin intervention.
            
              
            

### Threat 3: Registration Race Conditions & Team Number Exhaustion

- **Vulnerability:** Simultaneous registrations by multiple leaders could assign the same team number or exceed the 12-team limit.
    
      
    
- **Mitigation Strategy:**
    
      
    - Enforce a strict PostgreSQL atomic sequence or MySQL transaction with row locking (`SELECT ... FOR UPDATE`) during team creation.
        
          
        
    - Apply `UNIQUE` constraints on `team_number` (restricted to integers 1–12) and `registration_number` across all team member entries.
        
          
        

### Threat 4: IDOR (Insecure Direct Object Reference) & Session Hijacking

- **Vulnerability:** A student could alter `team_id` in API requests to view or submit answers for another team.
    
      
    
- **Mitigation Strategy:**
    
      
    - Implement Supabase Row Level Security (RLS) or session-bound JWT verification.
        
          
        
    - Verify that `auth.uid()` or session cookie maps exclusively to `teams.leader_registration_id`. Users cannot query or mutate data belonging to other team IDs.
        
          
        

### Threat 5: Network Disconnections & State Recovery

- **Vulnerability:** Unexpected network drops or page refreshes could lose candidate progress or lock them out prematurely.
    
      
    
- **Mitigation Strategy:**
    
      
    - All progression state (unlocked modules, submitted keys, used hints, elapsed time) is saved atomically to the database upon every action.
        
          
        
    - On page refresh, the client hydrates its state directly from the backend server. If `is_locked == TRUE`, it renders the lockout view; otherwise, it restores the exact question and timer state.
        
          
        

## 6. DATABASE SCHEMA SPECIFICATION

SQL

```
-- 1. USERS / LEADERS TABLE
CREATE TABLE users (
    registration_id VARCHAR(50) PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) DEFAULT 'LEADER' CHECK (role IN ('LEADER', 'ADMIN')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. TEAMS TABLE
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_number INT UNIQUE CHECK (team_number BETWEEN 1 AND 12),
    leader_registration_id VARCHAR(50) REFERENCES users(registration_id),
    allotted_set_id INT CHECK (allotted_set_id IN (1, 2, 3)),
    is_quiz_started BOOLEAN DEFAULT FALSE,
    is_quiz_completed BOOLEAN DEFAULT FALSE,
    is_locked BOOLEAN DEFAULT FALSE,
    lock_reason TEXT,
    quiz_start_time TIMESTAMP WITH TIME ZONE,
    quiz_end_time TIMESTAMP WITH TIME ZONE,
    total_score DECIMAL(4,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. TEAM MEMBERS TABLE
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    registration_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    is_leader BOOLEAN DEFAULT FALSE
);

-- 4. QUESTION SETS & QUESTIONS TABLE (ADMIN/BACKEND ONLY)
CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id INT NOT NULL CHECK (set_id IN (1, 2, 3)),
    module_number INT NOT NULL CHECK (module_number BETWEEN 1 AND 5),
    question_text TEXT NOT NULL,
    correct_key VARCHAR(100) NOT NULL, -- Whole number stored securely
    max_marks DECIMAL(4,2) DEFAULT 2.00,
    UNIQUE(set_id, module_number)
);

-- 5. HINTS TABLE
CREATE TABLE hints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE,
    hint_order INT NOT NULL,
    hint_text TEXT NOT NULL,
    deduction_marks DECIMAL(4,2) NOT NULL DEFAULT 0.50
);

-- 6. TEAM SUBMISSIONS TABLE
CREATE TABLE team_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    question_id UUID REFERENCES questions(id),
    submitted_key VARCHAR(100),
    is_correct BOOLEAN DEFAULT FALSE,
    hints_used_count INT DEFAULT 0,
    marks_awarded DECIMAL(4,2) DEFAULT 0.00,
    marks_deducted DECIMAL(4,2) DEFAULT 0.00,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(team_id, question_id)
);

-- 7. AUDIT & PROCTORING LOGS
CREATE TABLE proctoring_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- e.g., 'ALT_TAB', 'DEVTOOLS_OPEN', 'FOCUS_LOST'
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## 7. API ENDPOINT SPECIFICATIONS

### 7.1 Student & Quiz Endpoints

#### `POST /api/auth/login`

- **Request:** `{ registration_id: string, name?: string }`
    
      
    
- **Behavior:** Checks if user exists. If first time, creates user entry. Generates session JWT. Returns user profile and existing team association if present.
    
      
    

#### `POST /api/team/register`

- **Request:** `{ members: [ { name: string, registration_number: string, is_leader: boolean } ] }`
    
      
    
- **Behavior:** Validates member count (1–5). Checks database for duplicate registration numbers. Assigns available `team_number` (1–12) atomically. Redirects to Waiting Room.
    
      
    

#### `GET /api/quiz/status`

- **Behavior:** Returns current state of the team (waiting, started, set allotted, locked, or completed) and global paper release status from admin.
    
      
    

#### `POST /api/quiz/submit-key`

- **Request:** `{ question_id: string, submitted_key: string }`
    
      
    
- **Behavior:** Evaluates key server-side. If correct, updates `team_submissions`, awards marks, and unlocks progression to the next module/question. If incorrect, returns error without unlocking.
    
      
    

#### `POST /api/quiz/request-hint`

- **Request:** `{ question_id: string, hint_index: number }`
    
      
    
- **Behavior:** Verifies `quiz_start_time` $\ge 300$ seconds. Deducts specified hint penalty from question score, logs hint usage, and returns hint text.
    
      
    

#### `POST /api/quiz/proctor-event`

- **Request:** `{ event_type: string, details: string }`
    
      
    
- **Behavior:** Logs malpractice event to `proctoring_logs`. Immediately sets `teams.is_locked = true` and triggers real-time lockout on client.
    
      
    

### 7.2 Admin Endpoints

#### `POST /api/admin/login`

- **Request:** `{ admin_username: string, password: string }`
    
      
    
- **Behavior:** Authenticates special admin user and issues Admin JWT.
    
      
    

#### `POST /api/admin/toggle-paper-release`

- **Request:** `{ release_status: boolean }`
    
      
    
- **Behavior:** Globals switch to release or call-back test papers to waiting teams.
    
      
    

#### `POST /api/admin/override-set`

- **Request:** `{ team_id: string, set_id: number }`
    
      
    
- **Behavior:** Changes allotted question set (1, 2, or 3) for the specified team.
    
      
    

#### `POST /api/admin/lockout-team`

- **Request:** `{ team_id: string, lock_status: boolean, reason?: string }`
    
      
    
- **Behavior:** Locks or unlocks a team's quiz session manually. Unlocking restores their previous progress state.
    
      
    

#### `GET /api/admin/live-dashboard`

- **Behavior:** Returns real-time status of all 12 teams, active questions, scores, hint deductions, and proctoring alerts.
    
      
    

## 8. STEP-BY-STEP IMPLEMENTATION ROADMAP FOR DEVELOPMENT

```
+-----------------------------------------------------------------------------------+
|                        DEVELOPMENT EXECUTION ROADMAP                              |
+-----------------------------------------------------------------------------------+
| STEP 1: Database Setup & Seed Scripts (Supabase/MySQL Schema)                     |
| STEP 2: Authentication Engine & Leader Onboarding Routes                          |
| STEP 3: Team Registration & Atomic Team Number Allocator (1-12)                   |
| STEP 4: Admin Portal & Paper Release Toggle Infrastructure                        |
| STEP 5: Waiting Room & Real-time SSE / WebSocket Synchronization                  |
| STEP 6: Quiz Execution Engine, Server-Side Key Validation & Hints                 |
| STEP 7: Client-Side Anti-Malpractice Event Monitor & Lockout System               |
| STEP 8: Post-Quiz Tally, 60-Second Auto-Close Timer & Re-attempt Blockers         |
+-----------------------------------------------------------------------------------+
```

### Step 1: Database Setup & Seeding

1. Execute the SQL schema script provided in Section 6.
    
      
    
2. Seed `questions` and `hints` tables for Sets 1, 2, and 3 across all 5 modules. Ensure `correct_key` values are stored securely.
    
      
    

### Step 2: Authentication & Team Onboarding

1. Implement `/api/auth/login` to handle registration ID authentication and first-time user creation.
    
      
    
2. Build the Home Page featuring the clickable **"Mathematics Quiz 3"** card.
    
      
    
3. Build the Team Registration form accepting 1 to 5 members with client- and server-side validation.
    
      
    

### Step 3: Admin Dashboard & Waiting Room Sync

1. Implement the Admin Portal authenticated via special admin credentials.
    
      
    
2. Create controls for global paper release toggle and random set assignment (Sets 1–3).
    
      
    
3. Build the student Waiting Room page using Server-Sent Events (SSE) or Supabase Realtime to auto-launch the quiz window upon paper release.
    
      
    

### Step 4: Secure Quiz Window & Gameplay

1. Build the module selection interface (Modules 1 through 5).
    
      
    
2. Implement server-side key verification (`/api/quiz/submit-key`) ensuring keys are never sent to the client.
    
      
    
3. Implement time-gated hint retrieval enforcement (unlocked only after 5 elapsed minutes).
    
      
    

### Step 5: Anti-Malpractice Engine & Lockout

1. Attach event listeners for `visibilitychange`, `blur`, `mouseleave`, keyboard shortcut suppression, and DevTools detection.
    
      
    
2. Connect detection triggers to `/api/quiz/proctor-event` to enforce instant team lockout.
    
      
    
3. Implement Admin lock/unlock controls to restore exam state upon ban lifting.
    
      
    

### Step 6: Post-Quiz Finalization & Auto-Close

1. Implement final score calculation and store itemized breakups in `teams` and `team_submissions` tables.
    
      
    
2. Add a 60-second countdown component triggering `window.close()` upon expiration.
    
      
    
3. Disable the "Mathematics Quiz 3" section on the Home Page for completed teams to prevent re-attempts.
    
      
    

### VERIFICATION CHECKLIST FOR BUILD COMPLETION

- [ ] All 5 modules, 3 sets, and 10-mark total structure implemented.
    
      
    
- [ ] Max 12 teams, team numbers restricted to range 1–12.
    
      
    
- [ ] Flexible team size (1 to 5 members) enforced.
    
      
    
- [ ] 5-minute time lock on hints implemented and enforced on server.
    
      
    
- [ ] Server-side answer key validation (Zero keys exposed to frontend).
    
      
    
- [ ] Anti-malpractice event triggers and instant lockout functional.
    
      
    
- [ ] Admin override capabilities (set change, release toggle, state restoration) fully wired.
    
      
    
- [ ] 60-second auto-close timer and re-attempt lockout verified.
