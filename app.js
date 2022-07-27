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

    const rolelessMembers = await getRolelessMembersToNudge(nudged_members_csv_path, discordClient, guildId);

    if (rolelessMembers.length) {

        const slowRollerRole = await discordClient.createMentionableRole(guildId, "Slow Roller");
        rolelessMembers.forEach(member => discordClient.addRoleToGuildMember(guildId, slowRollerRole.id, member.user.id));

        const privateChannel = await discordClient.createPrivateChannelForRole("Slow Rollers", guildId, slowRollerRole.id, process.env.APP_ID);

        await discordClient.createChannelMessage(privateChannel.id, `:wave: <@&${slowRollerRole.id}> Pssst! I noticed you don't have a role yet. That means you probably can't see any of the useful channels :sob: Here's some instructions on how to give yourself a role...`);

        logRun(rolelessMembers, nudged_members_csv_path, roles_and_channels_csv_path, slowRollerRole, privateChannel);
    }

    process.exit();
}

function logRun(rolelessMembers, nudged_members_csv_path, roles_and_channels_csv_path, slowRollerRole, privateChannel) {
    const nudgeDate = new Date(), nudgeDateFormatted = format(nudgeDate, "MM/dd/yyyy 'at' p");
    const nudgedMembersCsvString = stringify(rolelessMembers.map(member => [member.user.id, member.user.username, nudgeDate, nudgeDateFormatted]));
    fs.writeFileSync(nudged_members_csv_path, nudgedMembersCsvString, { flag: 'a' });
    fs.writeFileSync(roles_and_channels_csv_path, stringify([[slowRollerRole.id, privateChannel.id, nudgeDate, nudgeDateFormatted]]), { flag: 'a' });
}

async function getRolelessMembersToNudge(nudged_members_csv_path, discordClient, guildId, rolelessMembers) {
    const rolelessMembers = [];
    const nudgedMembersFile = fs.readFileSync(nudged_members_csv_path);
    const alreadyNudgedUsers = parse(nudgedMembersFile);
    const alreadyNudgedUserIds = Array.from(alreadyNudgedUsers, x => x[0]);

    const allMembers = await discordClient.getAllMembers(guildId);

    allMembers.filter(member => hasRoleCount(member, 0) && !member.user.bot && joinedDaysAgo(member) >= 4 && !alreadyNudgedUserIds.includes(member.user.id))
        .forEach(rolelessMember => rolelessMembers.push(rolelessMember));

    console.log(`${rolelessMembers.length} member(s) found that should be nudged`);

    return rolelessMembers;
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
        try { await discordClient.deleteChannel(entry.channelId); } catch { }
        try { await discordClient.deleteRole(guildId, entry.roleId); } catch { }
        rolesAndChannelsCreated = rolesAndChannelsCreated.filter(item => item[0] != entry.roleId);
    }
    fs.writeFileSync(roles_and_channels_csv_path, stringify(rolesAndChannelsCreated));
}

nudge();
