const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const config = require('./config.json');

class QueueManager {
    constructor() {
        this.activeQueue = null;
        this.queueMessage = null;
        this.players = [];
        this.currentKit = null;
        this.currentTester = null;
    }

    isQueueOpen() {
        return this.activeQueue !== null;
    }

    getQueuePosition(userId) {
        return this.players.findIndex(p => p.id === userId);
    }

    addPlayer(user) {
        if (this.getQueuePosition(user.id) !== -1) {
            return false;
        }
        this.players.push({ id: user.id, username: user.username, tag: user.tag });
        return true;
    }

    removePlayer(userId) {
        const index = this.getQueuePosition(userId);
        if (index === -1) return false;
        this.players.splice(index, 1);
        return true;
    }

    takePlayer() {
        if (this.players.length === 0) return null;
        return this.players.shift();
    }

    openQueue(kit, tester) {
        this.activeQueue = true;
        this.players = [];
        this.currentKit = kit;
        this.currentTester = tester;
    }

    async closeQueue() {
        this.activeQueue = null;
        this.players = [];
        
        if (this.queueMessage) {
            try {
                const closedEmbed = new EmbedBuilder()
                    .setTitle('🔒 Testing Queue - CLOSED')
                    .setColor(config.colors.error)
                    .setDescription('This queue has been closed by the tester.')
                    .addFields(
                        { name: '⚔️ Kit', value: this.currentKit || 'Unknown', inline: true },
                        { name: '🧪 Tester', value: this.currentTester || 'Unknown', inline: true }
                    )
                    .setTimestamp()
                    .setFooter({ text: 'Tier Testing System' });
                
                await this.queueMessage.edit({ embeds: [closedEmbed], components: [] });
            } catch (error) {
                console.error('Error closing queue message:', error);
            }
        }
        
        this.currentKit = null;
        this.currentTester = null;
        this.queueMessage = null;
    }

    createQueueEmbed() {
        const embed = new EmbedBuilder()
            .setTitle('🎮 Testing Queue - OPEN')
            .setColor(config.colors.primary)
            .setDescription(this.players.length === 0 
                ? '*Queue is empty. Click the button below to join!*' 
                : `**Players in queue: ${this.players.length}**`)
            .addFields(
                { name: '⚔️ Kit', value: this.currentKit || 'Unknown', inline: true },
                { name: '🧪 Current Tester', value: this.currentTester || 'Unknown', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: 'Tier Testing System' });

        if (this.players.length > 0) {
            const queueList = this.players.map((player, index) => 
                `**${index + 1}.** ${player.tag}`
            ).join('\n');
            embed.addFields({ name: '📋 Queue List', value: queueList });
        }

        return embed;
    }

    createQueueButtons() {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('queue_join')
                    .setLabel('Join Queue')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅'),
                new ButtonBuilder()
                    .setCustomId('queue_leave')
                    .setLabel('Leave Queue')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('❌')
            );
        return row;
    }

    async updateQueueMessage(channel) {
        if (!this.queueMessage) return;
        
        try {
            const embed = this.createQueueEmbed();
            const buttons = this.createQueueButtons();
            await this.queueMessage.edit({ embeds: [embed], components: [buttons] });
        } catch (error) {
            console.error('Error updating queue message:', error);
        }
    }
}

module.exports = new QueueManager();