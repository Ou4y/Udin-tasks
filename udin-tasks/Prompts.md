task-1-prompt-1
 Build a complete Sokoban clone in task1-sokoban/index.html using only HTML, CSS, and vanilla JavaScript.

Requirements:

* Single self-contained index.html file.
* Use a 2D array to represent the level.
* Support walls, floor, targets, boxes, boxes on targets, and player.
* Player moves with arrow keys in all four directions.
* Boxes can only be pushed, never pulled.
* Only one box can be pushed at a time.
* A box can move only if the next cell is floor or target.
* Detect win when every target has a box.
* Show move counter, restart button, and win message.
* Use clean readable code with comments around movement/push/win logic.
* Keep UI simple and suitable for screencast demo.

Output only the final code for index.html.

-------------------------------

task-2-prompt-1
Inside task2-multiuser/backend, build an Express + MySQL backend for a multi-user Sokoban platform.

Use:

* Node.js
* Express
* mysql2/promise
* bcrypt
* express-session
* cors
* dotenv

Create:

* server.js
* db.js
* schema.sql
* .env.example
* package.json scripts: dev and start

Database tables:

* users: id, username, password_hash, role, created_at
* levels: id, name, grid_data JSON, created_by, created_at
* scores: id, user_id, level_id, moves, completed_at

Roles:

* Anonymous: can view levels and leaderboard only
* Player: can play and submit scores
* Admin: can create levels and also play

Endpoints:

* POST /api/register
* POST /api/login
* POST /api/logout
* GET /api/me
* GET /api/levels
* POST /api/levels admin only
* POST /api/scores player/admin only
* GET /api/leaderboard

Rules:

* Hash passwords with bcrypt.
* Use session-based authentication.
* Validate request bodies.
* Return clear JSON errors.
* Seed one admin user: username admin, password admin123.
* Seed one playable Sokoban level.
* Add comments explaining auth, roles, and leaderboard query.

Keep the implementation simple, reliable, and easy to demo.
