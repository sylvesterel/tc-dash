import express from "express";
import bodyParser from "body-parser";
import session from "express-session";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = 8080;

// Middleware
app.use(bodyParser.json());
app.use(session({
    secret: process.env.SECRET,
    resave: false,
    saveUninitialized: true
}));

app.use(express.static(path.join(process.cwd(), "public")));

// Simpel login
let USERS;
try {
    USERS = JSON.parse(process.env.USERS || '[]');
} catch (err) {
    console.error('Kunne ikke parse USERS fra .env:', err);
    USERS = [];
}

app.post("/login", (req, res) => {
    const { username, password } = req.body;
    const user = USERS.find(u => u.username === username && u.password === password);
    if (!user) return res.status(401).json({ error: "Ugyldigt login" });
    req.session.user = { username };
    res.json({ success: true });
});

const authMiddleware = (req, res, next) => {
    if (req.session.user) return next();
    return res.redirect("/login.html");
};

app.get("/me", (req, res) => {
    if (!req.session.user) return res.status(401).json({ error: "Ikke logget ind" });
    res.json({ username: req.session.user.username });
});

app.get("/", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "index.html"));
});

app.get("/sluse", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "sluse.html"));
});

app.get("/adgang", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "adgang.html"));
});

app.get("/integration", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "integration.html"));
});

app.get("/profil", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "profil.html"));
});

app.get("/users", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "users.html"));
});

app.listen(port, () => console.log(`Server kører på port ${port}`));