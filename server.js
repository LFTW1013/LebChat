const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const fs = require('fs');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

const PORT = 3000;

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Redirect root to register.html
app.get('/', (req, res) => {
  res.redirect('/register.html');
});

// Load users
let users = {};
try {
  const data = fs.readFileSync('users.json');
  users = JSON.parse(data);
} catch {
  users = {};
}

// Load messages
let messageHistory = [];
try {
  const data = fs.readFileSync('messages.json');
  messageHistory = JSON.parse(data);
} catch {
  messageHistory = [];
}

// Login & auto-register
app.post('/auth', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ message: 'Username and password required' });
  }

  if (users[username]) {
    if (users[username].password === password) {
      return res.json({ message: 'Login successful' });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  }

  // Auto-register
  users[username] = { password };
  fs.writeFileSync('users.json', JSON.stringify(users, null, 2));
  return res.json({ message: 'Registration successful' });
});

// Serve chat page directly (optional override)
app.get('/chat.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'chat.html'));
});

// Socket.IO Chat
io.on('connection', (socket) => {
  console.log('🔌 A user connected');

  socket.on('set username', (username) => {
    socket.username = username;

    const relevantMessages = messageHistory.filter(
      msg => msg.from === username || msg.to === username
    );
    socket.emit('chat history', relevantMessages);
  });

  socket.on('private message', ({ to, message }) => {
    const msgObj = {
      from: socket.username,
      to,
      message,
      timestamp: new Date().toISOString()
    };

    messageHistory.push(msgObj);
    fs.writeFileSync('messages.json', JSON.stringify(messageHistory, null, 2));

    for (let [_, s] of io.of('/').sockets) {
      if (s.username === to || s.username === socket.username) {
        s.emit('private message', msgObj);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`❌ ${socket.username} disconnected`);
  });
});

server.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
