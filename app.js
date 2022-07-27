import 'dotenv/config';
import { DiscordClient } from './discord-client.mjs'
import { hasRoleCount, joinedDaysAgo } from './discord-api-utils.mjs';
import fs from 'fs';
import { parse, stringify } from 'csv/sync'
import { format, differenceInDays } from 'date-fns'

async function nudge() {

    const discordClient = new DiscordClient(process.env.BOT_TOKEN);
    const guildId = process.env.GUILD_ID;
    const nudged_members_csv_path = "nudgedMembers.csv";
    const roles_and_channels_csv_path  = "rolesAndChannels.csv";

    await cleanupPastNudges(roles_and_channels_csv_path, discordClient, guildId);

    const nudgedMembersFile = fs.readFileSync(nudged_members_csv_path);
    const alreadyNudgedUserIds = Array.from(parse(nudgedMembersFile), x => x[0]);
    const allMembers = await discordClient.getAllMembers(guildId);

    await kickMembers(allMembers, alreadyNudgedUserIds, discordClient, guildId);
    
    const membersToNudge = allMembers.filter(member => hasRoleCount(member, 0) && !member.user.bot && joinedDaysAgo(member) >= 4 && !alreadyNudgedUserIds.includes(member.user.id))

    if (membersToNudge.length) {

        const slowRollerRole = await discordClient.createMentionableRole(guildId, "Slow Roller");

        for (const member in membersToNudge) {
            await discordClient.addRoleToGuildMember(guildId, slowRollerRole.id, member.user.id);
        }

        const privateChannel = await discordClient.createPrivateChannelForRole("Slow Rollers", guildId, slowRollerRole.id, process.env.APP_ID);

        await discordClient.createChannelMessage(privateChannel.id, `:wave: <@&${slowRollerRole.id}> Pssst! I noticed you don't have a role yet. That means you probably can't see any of the useful channels :sob: Here's some instructions on how to give yourself a role...`);

        logRun(membersToNudge, nudged_members_csv_path, roles_and_channels_csv_path, slowRollerRole, privateChannel);
    }

    process.exit();
}

async function kickMembers(allMembers, alreadyNudgedUserIds, discordClient, guildId) {
    const membersToKick = allMembers.filter(member => hasRoleCount(member, 0) && !member.user.bot && joinedDaysAgo(member) >= 30 && alreadyNudgedUserIds.includes(member.user.id));

    for (const member in membersToKick) {
        await discordClient.removeMember(guildId, member.user.id);
    }
}

function logRun(nudgedMembers, nudged_members_csv_path, roles_and_channels_csv_path, slowRollerRole, privateChannel) {
    const nudgeDate = new Date(), nudgeDateFormatted = format(nudgeDate, "MM/dd/yyyy 'at' p");
    const nudgedMembersCsvString = stringify(nudgedMembers.map(member => [member.user.id, member.user.username, nudgeDate, nudgeDateFormatted]));
    
    fs.writeFileSync(nudged_members_csv_path, nudgedMembersCsvString, { flag: 'a' });
    fs.writeFileSync(roles_and_channels_csv_path, stringify([[slowRollerRole.id, privateChannel.id, nudgeDate, nudgeDateFormatted]]), { flag: 'a' });
}

async function cleanupPastNudges(roles_and_channels_csv_path, discordClient, guildId) {
    const rolesAndChannelsFile = fs.readFileSync(roles_and_channels_csv_path);
    let rolesAndChannelsCreated = parse(rolesAndChannelsFile);

    const rolesAndChannelsToDelete = rolesAndChannelsCreated.filter(function (entry) {
        const createDate = new Date(+entry[2]);
        const now = new Date();
        return differenceInDays(now, createDate) >= 3;
    }).map(entry => ({ roleId: entry[0], channelId: entry[1] }));

    for (const entry of rolesAndChannelsToDelete) {
        try { await discordClient.deleteChannel(entry.channelId); } catch { }  //if this fails it most likely means it was manually cleaned.
        try { await discordClient.deleteRole(guildId, entry.roleId); } catch { }
        rolesAndChannelsCreated = rolesAndChannelsCreated.filter(item => item[0] != entry.roleId);
    }

    fs.writeFileSync(roles_and_channels_csv_path, stringify(rolesAndChannelsCreated));
}

nudge();
