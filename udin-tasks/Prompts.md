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
Build the Docker Compose and backend only for Task 2.

Project location:
`task2-multiuser/`

Create:

task2-multiuser/
├── backend/
│   ├── server.js
│   ├── db.js
│   ├── schema.sql
│   ├── .env.example
│   └── package.json
└── docker-compose.yml

Use:
- Express
- mysql2/promise
- bcrypt
- express-session
- cors
- dotenv
- MySQL 8 through Docker Compose

Docker Compose:
- Service name: mysql
- Container name: `udin-sokoban-db`
- Image: mysql:8
- MYSQL_ROOT_PASSWORD: root
- MYSQL_DATABASE: sokoban
- Ports: `3306:3306`
- Named volume for persistence

Backend:
- Runs on port 4000.
- Connects to MySQL through environment variables.
- Uses session-based auth.
- Uses JSON responses.

Database tables:
- users: id, username unique, password_hash, role enum player/admin, created_at
- levels: id, name, grid_data JSON, created_by, created_at
- scores: id, user_id, level_id, moves, completed_at

Seed data:
- Admin user:
  - username: admin
  - password: admin123
- One default playable Sokoban level.

Endpoints:
- POST /api/register
- POST /api/login
- POST /api/logout
- GET /api/me
- GET /api/levels
- POST /api/levels admin only
- POST /api/scores player/admin only
- GET /api/leaderboard

Role rules:
- Anonymous: view levels and leaderboard only.
- Player: play and submit scores.
- Admin: create levels and play.

Add:
- Request validation.
- bcrypt password hashing.
- role-check middleware.
- clear JSON error messages.
- comments explaining auth, roles, and leaderboard logic.
- package.json scripts: dev and start.

Keep code simple, reliable, and demo-ready.
