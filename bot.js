const { Client, GatewayIntentBits, Collection, Events, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, EmbedBuilder, PermissionFlagsBits, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
const { SlashCommandBuilder } = require('discord.js');
require('dotenv').config();
const axios = require('axios');

const config = require('./config.json');
const database = require('./database');
const queueManager = require('./queueManager');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

database.initDatabase();

client.once(Events.ClientReady, async () => {
    console.log(`✅ Bot is ready! Logged in as ${client.user.tag}`);
    
    const commands = [
        new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Manage the testing queue')
            .addSubcommand(subcommand =>
                subcommand
                    .setName('open')
                    .setDescription('Open the testing queue')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('close')
                    .setDescription('Close the current queue')
            )
            .addSubcommand(subcommand =>
                subcommand
                    .setName('take')
                    .setDescription('Take the next player from the queue')
            ),
        
        new SlashCommandBuilder()
            .setName('verify')
            .setDescription('Post the verification message with button'),
        
        new SlashCommandBuilder()
            .setName('result')
            .setDescription('Post a test result')
            .addUserOption(option =>
                option.setName('player')
                    .setDescription('The player who was tested')
                    .setRequired(true)
            )
            .addStringOption(option =>
                option.setName('kit')
                    .setDescription('Testing kit used')
                    .setRequired(true)
                    .addChoices(
                        ...config.kits.map(kit => ({ name: kit, value: kit }))
                    )
            )
            .addStringOption(option =>
                option.setName('tier')
                    .setDescription('Tier achieved')
                    .setRequired(true)
                    .addChoices(
                        ...config.tiers.map(tier => ({ name: tier, value: tier }))
                    )
            )
            .addStringOption(option =>
                option.setName('evaluation')
                    .setDescription('Did the player earn an evaluation?')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Yes', value: 'Yes' },
                        { name: 'No', value: 'No' }
                    )
            ),
        
        new SlashCommandBuilder()
            .setName('tests')
            .setDescription('View tester statistics leaderboard'),
        
        new SlashCommandBuilder()
            .setName('resettests')
            .setDescription('Reset all tester statistics (Staff only)')
    ];

    try {
        console.log('🔄 Registering slash commands...');
        await client.application.commands.set(commands);
        console.log('✅ Slash commands registered successfully');
    } catch (error) {
        console.error('❌ Error registering commands:', error);
    }
});;

async function getMinecraftSkin(username) {
    try {
        const mojangResponse = await axios.get(`https://api.mojang.com/users/profiles/minecraft/${username}`, {
            timeout: 5000
        });
        
        if (mojangResponse.data && mojangResponse.data.id) {
            const uuid = mojangResponse.data.id;
            return `https://render.crafty.gg/3d/bust/${uuid}`;
        }
    } catch (error) {
        console.log(`Could not fetch UUID for ${username}, trying with username directly`);
    }
    
    return `https://render.crafty.gg/3d/bust/${username}`;
}

function hasTesterRole(member) {
    return member.roles.cache.has(config.testerRoleId);
}

function hasStaffRole(member) {
    return member.roles.cache.has(config.staffRoleId);
}

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isChatInputCommand()) {
        const { commandName } = interaction;

        if (commandName === 'queue') {
            if (!hasTesterRole(interaction.member)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            }

            const subcommand = interaction.options.getSubcommand();

            if (subcommand === 'open') {
                if (queueManager.isQueueOpen()) {
                    return interaction.reply({ content: '❌ A queue is already open. Close it first.', ephemeral: true });
                }

                const selectMenu = new StringSelectMenuBuilder()
                    .setCustomId('queue_kit_select')
                    .setPlaceholder('Select a testing kit')
                    .addOptions(
                        config.kits.map(kit => ({
                            label: kit,
                            value: kit,
                            emoji: '⚔️'
                        }))
                    );

                const row = new ActionRowBuilder().addComponents(selectMenu);

                const embed = new EmbedBuilder()
                    .setTitle('⚔️ Select Testing Kit')
                    .setDescription('Choose which kit this queue will be for:')
                    .setColor(config.colors.primary);

                await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
            }

            if (subcommand === 'close') {
                if (!queueManager.isQueueOpen()) {
                    return interaction.reply({ content: '❌ No queue is currently open.', ephemeral: true });
                }

                await queueManager.closeQueue();

                await interaction.reply({ content: '✅ Queue has been closed.', ephemeral: true });
            }

            if (subcommand === 'take') {
                if (!queueManager.isQueueOpen()) {
                    return interaction.reply({ content: '❌ No queue is currently open.', ephemeral: true });
                }

                const player = queueManager.takePlayer();
                if (!player) {
                    return interaction.reply({ content: '❌ The queue is empty.', ephemeral: true });
                }

                await queueManager.updateQueueMessage(interaction.channel);

                const embed = new EmbedBuilder()
                    .setTitle('🎯 Player Selected for Testing')
                    .setDescription(`**${player.tag}** has been taken from the queue for testing.`)
                    .setColor(config.colors.success)
                    .addFields(
                        { name: '👤 Player', value: `<@${player.id}>`, inline: true }
                    )
                    .setTimestamp();

                await interaction.reply({ embeds: [embed] });
            }
        }

        if (commandName === 'verify') {
            if (!hasTesterRole(interaction.member)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('✅ Player Verification')
                .setDescription('Click the button below to verify your Minecraft information and gain access to the testing queue.\n\n**Required Information:**\n• Minecraft Username')
                .setColor(config.colors.primary)
                .setFooter({ text: 'Tier Testing System' })
                .setTimestamp();

            const button = new ButtonBuilder()
                .setCustomId('verify_button')
                .setLabel('✅ Verify')
                .setStyle(ButtonStyle.Primary);

            const row = new ActionRowBuilder().addComponents(button);

            try {
                await interaction.channel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: '✅ Verification message posted!', ephemeral: true });
            } catch (error) {
                console.error('❌ Error posting verification message:', error);
                await interaction.reply({ content: '❌ Failed to post verification message.', ephemeral: true });
            }
        }

        if (commandName === 'result') {
            if (!hasTesterRole(interaction.member)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            }

            await interaction.deferReply();

            const player = interaction.options.getUser('player');
            const kit = interaction.options.getString('kit');
            const tier = interaction.options.getString('tier');
            const evaluation = interaction.options.getString('evaluation');

            const playerData = database.getPlayer(player.id);
            if (!playerData) {
                return interaction.editReply({ content: `❌ ${player.tag} has not verified yet. They need to use \`/verify\` first.` });
            }

            // Get previous tier for this specific kit
            const kitTierData = database.getPlayerKitTier(player.id, kit);
            const previousTier = kitTierData ? kitTierData.current_tier : 'Unranked';
            
            // Update the tier for this kit
            database.updatePlayerKitTier(player.id, kit, tier);
            
            // Increment tester stats
            database.incrementTesterStats(interaction.user.id);

            const skinUrl = await getMinecraftSkin(playerData.minecraft_username);

            const embed = new EmbedBuilder()
                .setTitle('🏆 Test Result')
                .setColor(config.colors.primary)
                .setThumbnail(skinUrl)
                .addFields(
                    { name: '👤 Player', value: `${player.tag} (<@${player.id}>)`, inline: true },
                    { name: '⚔️ Minecraft IGN', value: playerData.minecraft_username, inline: true },
                    { name: '🎮 Kit', value: kit, inline: true },
                    { name: '🏅 Tier Achieved', value: tier, inline: true },
                    { name: '📋 Previous Tier', value: previousTier, inline: true },
                    { name: '✅ Evaluation', value: evaluation, inline: true },
                    { name: '🧪 Tester', value: interaction.user.tag, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Tier Testing System' });

            await interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'tests') {
            if (!hasStaffRole(interaction.member)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            }

            await interaction.deferReply();

            const stats = database.getAllTesterStats();
            
            if (stats.length === 0) {
                return interaction.editReply({ content: '📊 No tester statistics available yet.' });
            }

            const leaderboardLines = [];
            for (let i = 0; i < stats.length; i++) {
                const stat = stats[i];
                const tester = await client.users.fetch(stat.discord_id).catch(() => null);
                const testerName = tester ? tester.tag : 'Unknown User';
                const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
                leaderboardLines.push(`${medal} **${testerName}** - ${stat.test_count} tests`);
            }

            const embed = new EmbedBuilder()
                .setTitle('📊 Tester Statistics Leaderboard')
                .setDescription(leaderboardLines.join('\n'))
                .setColor(config.colors.primary)
                .setTimestamp()
                .setFooter({ text: 'Tier Testing System' });

            await interaction.editReply({ embeds: [embed] });
        }

        if (commandName === 'resettests') {
            if (!hasStaffRole(interaction.member)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', ephemeral: true });
            }

            database.resetAllTesterStats();

            const embed = new EmbedBuilder()
                .setTitle('🔄 Statistics Reset')
                .setDescription('All tester statistics have been reset to 0.')
                .setColor(config.colors.success)
                .setTimestamp();

            await interaction.reply({ embeds: [embed] });
        }
    }

    if (interaction.isModalSubmit()) {
        if (interaction.customId === 'verify_modal') {
            const minecraftUsername = interaction.fields.getTextInputValue('minecraft_username');

            database.createOrUpdatePlayer(interaction.user.id, minecraftUsername);

            const embed = new EmbedBuilder()
                .setTitle('✅ Verification Successful')
                .setDescription('Your information has been saved!')
                .setColor(config.colors.success)
                .addFields(
                    { name: '⚔️ Minecraft Username', value: minecraftUsername, inline: true }
                )
                .setTimestamp();

            await interaction.reply({ embeds: [embed], ephemeral: true });
        }
    }

    if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'queue_kit_select') {
            if (!hasTesterRole(interaction.member)) {
                return interaction.update({ content: '❌ You do not have permission to use this.', components: [] });
            }

            const selectedKit = interaction.values[0];
            const testerName = interaction.user.tag;

            queueManager.openQueue(selectedKit, testerName);

            const embed = queueManager.createQueueEmbed();
            const buttons = queueManager.createQueueButtons();

            const queueChannel = await client.channels.fetch(config.queueChannelId);
            const message = await queueChannel.send({ embeds: [embed], components: [buttons] });
            queueManager.queueMessage = message;

            await interaction.update({ 
                content: `✅ Queue opened for **${selectedKit}**!`, 
                embeds: [], 
                components: [] 
            });
        }
    }

    if (interaction.isButton()) {
        if (interaction.customId === 'verify_button') {
            console.log('🔘 Verify button clicked by', interaction.user.tag);

            const modal = new ModalBuilder()
                .setCustomId('verify_modal')
                .setTitle('Minecraft Verification');

            const usernameInput = new TextInputBuilder()
                .setCustomId('minecraft_username')
                .setLabel('Minecraft Username')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Enter your Minecraft username')
                .setRequired(true)
                .setMaxLength(16);

            const firstRow = new ActionRowBuilder().addComponents(usernameInput);

            modal.addComponents(firstRow);

            try {
                await interaction.showModal(modal);
                console.log('✅ Verification modal shown');
            } catch (error) {
                console.error('❌ Error showing modal:', error);
            }
        }

        if (interaction.customId === 'queue_join') {
            if (!queueManager.isQueueOpen()) {
                return interaction.reply({ content: '❌ No queue is currently open.', ephemeral: true });
            }

            const playerData = database.getPlayer(interaction.user.id);
            if (!playerData) {
                return interaction.reply({ content: '❌ You need to verify first! Use `/verify` to register your information.', ephemeral: true });
            }

            const added = queueManager.addPlayer(interaction.user);
            if (!added) {
                return interaction.reply({ content: '❌ You are already in the queue!', ephemeral: true });
            }

            await queueManager.updateQueueMessage(interaction.channel);
            await interaction.reply({ content: '✅ You have joined the queue!', ephemeral: true });
        }

        if (interaction.customId === 'queue_leave') {
            if (!queueManager.isQueueOpen()) {
                return interaction.reply({ content: '❌ No queue is currently open.', ephemeral: true });
            }

            const removed = queueManager.removePlayer(interaction.user.id);
            if (!removed) {
                return interaction.reply({ content: '❌ You are not in the queue!', ephemeral: true });
            }

            await queueManager.updateQueueMessage(interaction.channel);
            await interaction.reply({ content: '✅ You have left the queue.', ephemeral: true });
        }
    }
});

client.on(Events.Error, error => {
    console.error('Discord client error:', error);
});

client.login(process.env.DISCORD_TOKEN);