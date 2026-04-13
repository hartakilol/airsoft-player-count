const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PIN = String(process.env.ADMIN_PIN || "1234").trim();
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY environment variables");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

async function getState() {
  const { data, error } = await supabase
    .from("player_count")
    .select("count, updated_at")
    .eq("id", 1)
    .single();

  if (error) {
    throw error;
  }

  return {
    count: data.count,
    updatedAt: data.updated_at,
  };
}

async function setState(nextCount) {
  const { data, error } = await supabase
    .from("player_count")
    .update({
      count: nextCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1)
    .select("count, updated_at")
    .single();

  if (error) {
    throw error;
  }

  return {
    count: data.count,
    updatedAt: data.updated_at,
  };
}

app.get("/api/count", async (req, res) => {
  try {
    const state = await getState();
    res.json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not load player count" });
  }
});

app.get("/api/status", (req, res) => {
  res.json({
    ok: true,
    pinLength: ADMIN_PIN.length
  });
});

app.post("/api/count", async (req, res) => {
  try {
    const providedPin = String(req.body.pin ?? "").trim();
    const nextCount = Number(req.body.count);

    if (providedPin !== ADMIN_PIN) {
      return res.status(401).json({
        error: "Invalid PIN",
        details: "The PIN entered on the page does not match the server PIN."
      });
    }

    if (!Number.isInteger(nextCount) || nextCount < 0) {
      return res.status(400).json({
        error: "Count must be a whole number 0 or higher"
      });
    }

    const state = await setState(nextCount);
    io.emit("countUpdated", state);
    res.json(state);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Could not update player count" });
  }
});

io.on("connection", async (socket) => {
  try {
    const state = await getState();
    socket.emit("countUpdated", state);
  } catch (err) {
    console.error(err);
    socket.emit("countUpdated", {
      count: 0,
      updatedAt: new Date().toISOString()
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Admin PIN loaded. Length: ${ADMIN_PIN.length}`);
});
