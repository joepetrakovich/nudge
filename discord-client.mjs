import fetch from 'node-fetch';
import { checkStatus } from './http-utils.mjs';

export class DiscordClient {
    
    constructor(botAuthToken) {
        this.botAuthToken = botAuthToken;
    }

    async getGuildRoles(guildId) {
        const endpoint = `/guilds/${guildId}/roles`;

        const response = await this.#discordRequest(endpoint, { method: 'GET' });

        return await response.json();
    }

    async createMentionableRole(guildId, roleName) {
        const endpoint = `/guilds/${guildId}/roles`;

        const role = {
            name: roleName,
            mentionable: true
        }

        const response = await this.#discordRequest(endpoint, { method: 'POST', body: role });
        
        return await response.json();
    }

    async addRoleToGuildMember(guildId, roleId, userId, reason) {
        const endpoint = `/guilds/${guildId}/members/${userId}/roles/${roleId}`;

        const headers = { 'X-Audit-Log-Reason': reason ?? 'Adding a role to member so they can be pinged.' }

        await this.#discordRequest(endpoint, { method: 'PUT', headers: headers });
    }

    async deleteRole(guildId, roleId) {
        const endpoint = `/guilds/${guildId}/roles/${roleId}`;
      
        const response = await this.#discordRequest(endpoint, { method: 'DELETE' });
      
        return await response.json();
    }

    async getAllMembers(guildId) {
        const allMembers = [];
        const limitPerPage = 1000;
        var lastPageHighestUserID;
    
        while (true) {   
            let members = await this.#getMembers(guildId, limitPerPage, lastPageHighestUserID);         
            members.forEach(member => allMembers.push(member));
 
            if (members.length < limitPerPage) break;
    
            lastPageHighestUserID = members[members.length - 1].user.id;
        }

        return allMembers;
    }

    async #getMembers(guildId, limitPerPage, lastPageHighestUserID) {
        const endpointBase = `/guilds/${guildId}/members?limit=${limitPerPage}`;
        const endpoint = lastPageHighestUserID != null ? endpointBase + `&after=${lastPageHighestUserID}` : endpointBase;
        
        let response = await this.#discordRequest(endpoint, { method: 'GET' });
        
        return await response.json();
    }

    async removeMember(guildId, userId) {
        const endpoint = `/guilds/${guildId}/members/${userId}`;
      
        const response = await this.#discordRequest(endpoint, { method: 'DELETE' });
      
        return await response.json();
    }

    async createChannelMessage(channelId, messageContent) {
        const endpoint = `/channels/${channelId}/messages`;

        const message = {
            content: messageContent
        }
        
        //TODO: sanitize message if its user created.
        //2000 char limit
      
        const response = await this.#discordRequest(endpoint, { method: 'POST', body: message });
      
        return await response.json();
    }

    async createPrivateChannelForRole(name, guildId, roleId, botId, reason) {
        const endpoint = `/guilds/${guildId}/channels`;

        const denyEveryone = {
            id: guildId,
            type: 0,
            deny: "3072" //3072 = 0x400 | 0x800 view channel and send messages
        }

        const allowRoleToView = {
            id: roleId,
            type: 0,
            allow: "1024" //0x400 view channel
        }

        const allowBotToViewAndSend = {
            id: botId,
            type: 1,
            allow: "3072" //0x400 view channel
        }

        const channel = {
            name: name,
            type: 0,
            permission_overwrites: [ denyEveryone, allowRoleToView, allowBotToViewAndSend ]
        }

        const headers = {'X-Audit-Log-Reason': reason ?? 'Creating private channel to nudge some members.'}
              
        const response = await this.#discordRequest(endpoint, { method: 'POST', body: channel, headers: headers });
        
        return await response.json();
    }

    async deleteChannel(channelId) {
        const endpoint = `/channels/${channelId}`;
      
        const response = await this.#discordRequest(endpoint, { method: 'DELETE' });
      
        return await response.json();
    }

    async #createGlobalCommand(appId, command) {
        const endpoint = `/applications/${appId}/commands`;
        //201 is success
        const response = await this.#discordRequest(endpoint, { method: 'POST', body: command });

        return await response.json();
    }

    async getAllGlobalCommands(appId) {
        const endpoint = `/applications/${appId}/commands`;
        
        const response = await this.#discordRequest(endpoint, { method: 'GET' });

        return await response.json();
    }

    async createGlobalCommandIfNotExists(appId, command){
        const existingGlobalCommands = await this.getAllGlobalCommands(appId);
        const commandName = command['name'];

        if (existingGlobalCommands && !existingGlobalCommands.map(existingCommand => existingCommand['name']).includes(commandName)) {
            console.log(`Installing "${commandName}" global command...`);
            await this.#createGlobalCommand(appId, command);
        } else {
            console.log(`"${commandName}" command already installed`);
        }
    }

    async createGuildCommand(appId, guildId, command) {
        const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
        const commandName = command['name'];

        console.log(`Installing "${commandName}" guild-scoped command...`);
        const response = await this.#discordRequest(endpoint, { method: 'POST', body: command });
        console.log(`"${commandName}" command installed.`)

        return await response.json();
    }

    async getAllGuildCommands(appId, guildId) {
        const endpoint = `applications/${appId}/guilds/${guildId}/commands`;
  
        const response = await this.#discordRequest(endpoint, { method: 'GET' });

        return await response.json();
    }

    async createGuildCommandIfNotExists(appId, guildId, command){
        const existingGuildCommands = await this.getAllGuildCommands(appId, guildId);
        const commandName = command['name'];

        if (existingGuildCommands && !existingGuildCommands.map(existingCommand => existingCommand['name']).includes(commandName)) {
            await this.createGuildCommand(appId, guildId, command);
        } else {
            console.log(`"${commandName}" command already installed.`);
        }
    }

    async #deleteGlobalCommand(appId, commandId) {
        const endpoint = `applications/${appId}/commands/${commandId}`
        //204 is success
        await this.#discordRequest(endpoint, { method: 'DELETE' });
    }

    async #deleteGuildCommand(appId, guildId, commandId) {
        const endpoint = `applications/${appId}/guilds/${guildId}/commands/${commandId}`
        //204 is success
        await this.#discordRequest(endpoint, { method: 'DELETE' });
    }

    async deleteGuildCommandByName(appId, guildId, commandName) {
        const existingGuildCommands = await this.getAllGuildCommands(appId, guildId);
        
        const matchingCommand = existingGuildCommands?.find(existingCommand => existingCommand['name'] == commandName);
        if (matchingCommand) {
            console.log(`Deleting "${commandName}" guild-scoped command...`);
            await this.#deleteGuildCommand(appId, guildId, matchingCommand['id']);
        }
    }

    async deleteGlobalCommandByName(appId, commandName) {
        const existingGlobalCommands = await this.getAllGlobalCommands(appId);
        
        const matchingCommand = existingGlobalCommands?.find(existingCommand => existingCommand['name'] == commandName);
        if (matchingCommand) {
            console.log(`Deleting "${commandName}" global command...`);
            await this.#deleteGlobalCommand(appId, guildId, matchingCommand['id']);
        }
    }

    async #discordRequest(endpoint, options) {
        const url = 'https://discord.com/api/v10/' + endpoint;

        const headers = {
            Authorization: `Bot ${this.botAuthToken}`,
            'Content-Type': 'application/json; charset=UTF-8',
            'User-Agent': 'DiscordBot (https://joe.ptrkv.ch/, 0.0.1)'
        }
        options.headers = Object.assign(headers, options.headers);

        if (options.body) options.body = JSON.stringify(options.body);

        const response = await fetch(url, options);

        try {
            checkStatus(response);
        } catch (error) {
            console.error(error);
        
            const errorBody = await error.response.text();
            console.error(`Error body: ${errorBody}`);
            throw error;
        }

        return response;
    }
}