const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fs = require("fs");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || "1234").trim();
const DATA_FILE = path.join(__dirname, "data.json");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

function loadData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    return { count: 0, updatedAt: new Date().toISOString() };
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

let state = loadData();

app.get("/api/count", (req, res) => {
  res.json(state);
});

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    pinLength: ADMIN_PIN.length
  });
});

app.post("/api/count", (req, res) => {
  const providedPin = String(req.body.pin ?? "").trim();
  const nextCount = Number(req.body.count);

  if (providedPin !== ADMIN_PIN) {
    return res.status(401).json({
      error: "Invalid PIN",
      details: "The PIN entered on the page does not match the server PIN."
    });
  }

  if (!Number.isInteger(nextCount) || nextCount < 0) {
    return res.status(400).json({ error: "Count must be a whole number 0 or higher" });
  }

  state = {
    count: nextCount,
    updatedAt: new Date().toISOString(),
  };

  saveData(state);
  io.emit("countUpdated", state);
  res.json(state);
});

io.on("connection", (socket) => {
  socket.emit("countUpdated", state);
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin PIN loaded. Length: ${ADMIN_PIN.length}`);
});
