const Database = require('better-sqlite3');
const db = new Database('tiertest.db');

function initDatabase() {
    db.exec(`
        CREATE TABLE IF NOT EXISTS players (
            discord_id TEXT PRIMARY KEY,
            minecraft_username TEXT NOT NULL,
            preferred_server TEXT NOT NULL,
            current_tier TEXT DEFAULT 'Unranked',
            previous_tier TEXT DEFAULT 'Unranked',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
    
    // Table for per-kit tier tracking
    db.exec(`
        CREATE TABLE IF NOT EXISTS player_kit_tiers (
            discord_id TEXT NOT NULL,
            kit TEXT NOT NULL,
            current_tier TEXT NOT NULL,
            previous_tier TEXT DEFAULT 'Unranked',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (discord_id, kit)
        )
    `);
    
    // Table for tester statistics
    db.exec(`
        CREATE TABLE IF NOT EXISTS tester_stats (
            discord_id TEXT PRIMARY KEY,
            test_count INTEGER DEFAULT 0,
            last_test DATETIME
        )
    `);
    
    console.log('Database initialized successfully');
}

function getPlayer(discordId) {
    const stmt = db.prepare('SELECT * FROM players WHERE discord_id = ?');
    return stmt.get(discordId);
}

function createOrUpdatePlayer(discordId, minecraftUsername, preferredServer = 'N/A') {
    const existing = getPlayer(discordId);
    
    if (existing) {
        const stmt = db.prepare(`
            UPDATE players 
            SET minecraft_username = ?, preferred_server = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE discord_id = ?
        `);
        stmt.run(minecraftUsername, preferredServer, discordId);
    } else {
        const stmt = db.prepare(`
            INSERT INTO players (discord_id, minecraft_username, preferred_server) 
            VALUES (?, ?, ?)
        `);
        stmt.run(discordId, minecraftUsername, preferredServer);
    }
}

function updatePlayerTier(discordId, newTier) {
    const player = getPlayer(discordId);
    if (!player) return false;
    
    const stmt = db.prepare(`
        UPDATE players 
        SET previous_tier = ?, current_tier = ?, updated_at = CURRENT_TIMESTAMP 
        WHERE discord_id = ?
    `);
    stmt.run(player.current_tier, newTier, discordId);
    return true;
}

function updatePlayerKitTier(discordId, kit, newTier) {
    // Get current tier for this kit
    const stmt = db.prepare('SELECT current_tier FROM player_kit_tiers WHERE discord_id = ? AND kit = ?');
    const existing = stmt.get(discordId, kit);
    
    if (existing) {
        // Update existing, setting previous_tier to current_tier
        const updateStmt = db.prepare(`
            UPDATE player_kit_tiers 
            SET previous_tier = current_tier, current_tier = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE discord_id = ? AND kit = ?
        `);
        updateStmt.run(newTier, discordId, kit);
    } else {
        // Insert new record, previous_tier is 'Unranked'
        const insertStmt = db.prepare(`
            INSERT INTO player_kit_tiers (discord_id, kit, current_tier, previous_tier) 
            VALUES (?, ?, ?, 'Unranked')
        `);
        insertStmt.run(discordId, kit, newTier);
    }
    
    return true;
}

function getPlayerKitTier(discordId, kit) {
    const stmt = db.prepare('SELECT * FROM player_kit_tiers WHERE discord_id = ? AND kit = ?');
    return stmt.get(discordId, kit);
}

function incrementTesterStats(discordId) {
    const stmt = db.prepare('SELECT * FROM tester_stats WHERE discord_id = ?');
    const existing = stmt.get(discordId);
    
    if (existing) {
        const updateStmt = db.prepare(`
            UPDATE tester_stats 
            SET test_count = test_count + 1, last_test = CURRENT_TIMESTAMP 
            WHERE discord_id = ?
        `);
        updateStmt.run(discordId);
    } else {
        const insertStmt = db.prepare(`
            INSERT INTO tester_stats (discord_id, test_count, last_test) 
            VALUES (?, 1, CURRENT_TIMESTAMP)
        `);
        insertStmt.run(discordId);
    }
}

function getAllTesterStats() {
    const stmt = db.prepare('SELECT * FROM tester_stats ORDER BY test_count DESC');
    return stmt.all();
}

function resetAllTesterStats() {
    const stmt = db.prepare('DELETE FROM tester_stats');
    stmt.run();
}

module.exports = {
    initDatabase,
    getPlayer,
    createOrUpdatePlayer,
    updatePlayerTier,
    updatePlayerKitTier,
    getPlayerKitTier,
    incrementTesterStats,
    getAllTesterStats,
    resetAllTesterStats
};