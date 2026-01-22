import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

// Database Configuration - Main Dashboard
const sylleDatabaseConfig = {
    host: process.env.SYL_DB_HOST,
    user: process.env.SYL_DB_USER,
    password: process.env.SYL_DB_PASSWORD,
    database: process.env.SYL_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export const pool = mysql.createPool(sylleDatabaseConfig);

// Database Configuration - Sluse (Old TourCare System)
const sluseDatabaseConfig = {
    host: process.env.SLUSE_DB_HOST,
    user: process.env.SLUSE_DB_USER,
    password: process.env.SLUSE_DB_PASSWORD,
    database: process.env.SLUSE_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export const slusePool = mysql.createPool(sluseDatabaseConfig);

// Database Configuration - CRM Integration (HubSpot/Rentman)
const crmDatabaseConfig = {
    host: process.env.SYL_DB_HOST,
    user: process.env.SYL_DB_USER,
    password: process.env.SYL_DB_PASSWORD,
    database: process.env.CRM_DB_NAME,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

export const crmPool = mysql.createPool(crmDatabaseConfig);

// Helper function to add business days
export function addBusinessDays(date, days) {
    const d = new Date(date);
    let remaining = days;
    while (remaining !== 0) {
        d.setDate(d.getDate() + Math.sign(days));
        const day = d.getDay();
        if (day !== 0 && day !== 6) remaining -= Math.sign(days);
    }
    return d;
}

export default { pool, slusePool, crmPool, addBusinessDays };
