We are building a website cum portal for hosting and running quiz for students of my branch.

### Entry and Database format:
1. Students are grouped into teams of 5, with one of the 5 members assuming themselves as the leader of the pack. (This is done externally in class itself)
2. Only the team leader is allowed to log in with proper credentials (registration id only), and they represent their whole team for the test.
3. Once the team leader logs in, they navigate to the test and fill up their team details (name and registration numbers, including that of the team leader themselves as well) in a form type environment, and a team number is allotted to them by the website.
4. Once they fill in all the data and it is verified, they are allowed to start the quiz.
5. The tallied marks for the team is stored exclusively in our database, along with their team details, with marks breakup of each question. This includes number of marks deducted due to usage of hints, the final submitted "keys" (answers) themselves.
### Test Format:
1. Only Mathematics is the allotted subject for now.
2. The syllabus for the quiz contains only 5 modules, named Module-1, Module-2,..., Module-5
3. We have 3 question paper sets, each set/paper containing 5 questions, 2 marks each.
4. Each question corresponds to a different module, the order (from the docs) follows the pattern mentioned in 2nd point.
5. The test is conducted in a game format.
6. Upon starting, participants can only see 1 question from their allotted set, they have the freedom to choose the question based on the module.
7. The answer to each question is a whole number, so only alpha-numeric inputs are accepted as answers.
8. Upon solving the question, the answer obtained is treated as a key. Unless the key is absolutely correct, they cannot move on to the next question.
9. Users have the option to opt for a hint if the question seems difficult. Hints are only provided after first 5 minutes of the exam.
10. Each question gets a specified (already pre-set) amount of hints. Using up hints deducts marks as mentioned in the paper.
11. Once all questions are solved, the total marks is tallied and stored.

### Website Format:
1. The website is hosted on vercel, with a connected mysql or supabase database for storing student responses.
2. There should be a login page, for the team leader to sign into. The system remembers the username signing in, and for first timers it will by default create an account by asking for registration number (as username) and name of the leader.
3. After successful sign-in, the users will be directed to a separate home page containing a clickable block/section named "Mathematics Quiz 3". Upon clicking they will be redirected to a new page called "Team Registration". 
4. In the new team registration page the user will be asked to input details (registration numbers and names) of all their team members, in a form type environment.
5. A maximum of 5 members is allowed per team, however, there is no lower limit. Teams can have as little as 1 person to 5 of them.
6. Once team registration is confirmed the user will be redirected back to the quiz page where they will await server/admin instructions to start the quiz.
7. Once the admin releases the papers to the system, the system will randomly assign 1 of the 3 sets to each team. The admin should be able to view and change the allotment at will.
8. Once the papers are allotted, the quiz begins in a new window/webpage.
9. This new window/webpage should be very alert to malpractices.
10. Alt-tabbing, tab switching, new tab creation, and many more untoward practices are strictly not allowed, and the website should ensure that doesn't happen.
11. Incase of any such action, the user shall be locked out of the quiz completely and final decision relies on the admin.
12. Marks awarded for each question, hints used, marks deducted and the final "key" (answer) is stored in our database, along with their respective team data.
13. When the quiz end the user gets a 60 second time-window to close the webpage-window, after which it closes automatically.
14. Once the quiz is done no re-attempts are allowed to the team, the "Mathematics Quiz 3" section itself becomes unresponsive for that particular team. Only the admin has permissions to re-issue quizzes.
15. The maximum number of teams is 12, so the team number generated should be in between 1-12 only.
16. Already registered members/leaders, if their detail is present in the database, will not be allowed to re-register for the quiz.

### ADMIN Portal for the website:
1. When logged into the portal with a special username (which shall be specified later), the website opens up the admin portal.
2. The admin portal has master control over everything, every bit of information.
3. The admin can view and change all teams, team details, team number, allotted set of question paper, and monitor their activity (which question they're on).
4. The admin can also lock teams out from the quiz if they visually see/report any malicious activity.
5. The question paper sets shall be preloaded on the admin portal from the beginning, but they will not be released to the users.
6. The admin will manually release/call-back the release of papers to the user portals.
7. Even though the system randomly assigns sets to each team, the admin can change the question set allotted at will.
8. The admin can manually withdraw and close the paper/quiz portal once its confirmed that the quiz has been conducted properly.
9. Admin also has the power to lift any locks/bans from the quiz paper manually, and restore the previous state of test for that team.

### Materials that currently exist and what they are:
1. All 3 sets of quiz papers, with hints and an answer key for each.
2. The marking/demarking scheme for each hint and question.
	1. Answer key is separate and shall not be uploaded to the portal.