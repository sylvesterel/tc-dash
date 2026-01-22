import express from "express";
import path from "path";
import { authMiddleware } from "../middleware/auth.js";

const router = express.Router();

// Protected page routes
router.get("/", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "index.html"));
});

router.get("/sluse", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "sluse.html"));
});

router.get("/adgang", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "adgang.html"));
});

router.get("/integration", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "integration.html"));
});

router.get("/profil", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "profil.html"));
});

router.get("/users", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "users.html"));
});

router.get("/indkob", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "indkob.html"));
});

router.get("/codes", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "codes.html"));
});

router.get("/projects", authMiddleware, (req, res) => {
    res.sendFile(path.join(process.cwd(), "protected", "projects.html"));
});

export default router;
