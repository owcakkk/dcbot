# Minecraft Tier Test Bot

A Discord bot for managing Minecraft PvP tier testing queues with verification and result tracking.

## Setup Instructions

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Bot Token**
   - Edit `.env` file and replace `your_discord_bot_token_here` with your actual bot token

3. **Configure Settings**
   - Edit `config.json` and set:
     - `testerRoleId`: The role ID for testers who can manage queues
     - `queueChannelId`: The channel ID where queue messages will be posted

4. **Run the Bot**
   ```bash
   npm start
   ```

## Commands

### For Testers
- `/queue open <tier>` - Open a testing queue for a specific tier
- `/queue close` - Close the current queue
- `/queue take` - Take the next player from the queue
- `/result` - Post a test result with all details

### For Players
- `/verify` - Verify your Minecraft username and preferred server
- Click "Join Queue" button to enter the queue
- Click "Leave Queue" button to exit the queue

## Features

- ✅ Interactive queue system with join/leave buttons
- ✅ Player verification with Minecraft username and server preference
- ✅ Detailed test results with Minecraft skin rendering
- ✅ Tier progression tracking (previous tier → new tier)
- ✅ SQLite database for persistent data
- ✅ Purple-themed embeds
- ✅ Support for 10 tiers (HT1-5, LT1-5)
- ✅ Support for 11 testing kits
- ✅ Server IP tracking for each test

## Configuration

All settings can be modified in `config.json`:
- Tester role
- Queue channel
- Color scheme
- Available tiers
- Available kits