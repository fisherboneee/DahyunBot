const { Client, Util } = require('discord.js')
const ytdl = require('ytdl-core')
const YouTube = require('simple-youtube-api')
const { prefix, token, APIKey } = require('./config.json')

const client = new Client({ disableEveryone: true })

const youtube = new YouTube(APIKey)

const queue = new Map()

client.once('ready' , () => {
    console.log('Dahyun is online!');
});

client.on('message', async message => {
    if(!message.content.startsWith(prefix) || message.author.bot) 
        return
    
    const args = message.content.slice(prefix.length).split(/ +/)
    const searchString = args.slice(1).join(' ')
    const url = args[1] ? args[1].replace(/<(._)>/g, '$1') : ''
    const serverQueue = queue.get(message.guild.id)

    if(message.content.startsWith(`${prefix}play`) || message.content.startsWith(`${prefix}p`)) {
        const voiceChannel = message.member.voice.channel
        if(!voiceChannel)
            return message.channel.send("You need to be in the voice channel to play music")
        
        const permissions = voiceChannel.permissionsFor(message.client.user)
        if(!permissions.has('CONNECT'))
            return message.channel.send("I don't have permission to connect to the voice channel")
        if(!permissions.has('SPEAK'))
            return message.channel.send("I don't have permission to speak in the channel")

        try {
            var video = await youtube.getVideoByID(url)
        } 
        catch {
            try {
                var videos = await youtube.searchVideos(searchString, 1)
                var video = await youtube.getVideoByID(videos[0].id)
            }
            catch {
                    return message.channel.send("I couldn't find any search results")
            }
        }

        const song = {
            id: video.id,
            title: video.title,
            url: `https://www.youtube.com/watch?v=${video.id}`
        }

        if(!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: voiceChannel,
                connection: null,
                songs: [],
                volume: 5,
                playing: true
            }
            queue.set(message.guild.id, queueConstruct)

            queueConstruct.songs.push(song)

            try {
                var connection = await voiceChannel.join()
                queueConstruct.connection = connection
                play(message.guild, queueConstruct.songs[0])
            } 
            catch (error) {
                console.log(`There was an error connecting to the voice channel: ${error}`)
                queue.delete(message.guild.id)
                return message.channel.send(`The was an error connecting to the voice channel: ${error}`)
            }
        }
        else {
            serverQueue.songs.push(song)
            return message.channel.send(`**${song.title}** has been added to the queue`)
        }
        return undefined
    }
    else if (message.content.startsWith(`${prefix}stop`)) {
        if(!message.member.voice.channel)
            return message.channel.send("You need to be in the voice channel to use this command")
        if(!serverQueue)
            return message.channel.send("No song are playing right now")
            serverQueue.songs = []
            serverQueue.connection.dispatcher.end()
            message.channel.send("I have stopped the music")
            return undefined
    }
    else if (message.content.startsWith(`${prefix}skip`)) {
        if(!message.member.voice.channel)
            return message.channel.send("You need to be in the voice channel to use this command")
        if(!serverQueue)
            return message.channel.send("There is nothing for you to skip through")
        serverQueue.connection.dispatcher.end()
        message.channel.send("I have skipped the music")
        return undefined    
    }
    else if (message.content.startsWith(`${prefix}volume`)) {
        if(!message.member.voice.channel)
            return message.channel.send("You need to be in the voice channel to use this command")
        if(!serverQueue)
            return message.channel.send("No song are playing right now")
        if(!args[1])
            return message.channel.send(`The volume is: **${serverQueue.volume}**`)
        if(isNaN(args[1]))
            return message.channel.send("That is not a valid amount to change")
        serverQueue.volume = args[1]
        serverQueue.connection.dispatcher.setVolumeLogarithmic(args[1] / 5)
        message.channel.send(`I have changed the volume to: **${args[1]}**`)
        return undefined
    }
    else if (message.content.startsWith(`${prefix}nowplaying`) || message.content.startsWith(`${prefix}np`)) {
        if(!serverQueue)
            return message.channel.send("There is nothing playing right now")
        message.channel.send(`Now Playing: **${serverQueue.songs[0].title}**`)
        return undefined
    }
    else if (message.content.startsWith(`${prefix}queue`) || message.content.startsWith(`${prefix}q`)) {
        if(!serverQueue)
            return message.channel.send("The queue is empty")
        message.channel.send(`
        __**Song Queue:**__
${serverQueue.songs.map(song => `**-** ${song.title}`).join('\n')}
        
**Now Playing:** ${serverQueue.songs[0].title}
        `, { split: true })
        return undefined
    }
    else if (message.content.startsWith(`${prefix}pause`)) {
        if(!message.member.voice.channel)
            return message.channel.send("You need to be in the voice channel to use this command")
        if(!serverQueue)
            return message.channel.send("There is nothing playing right now")
        if(!serverQueue.playing)
            return message.channel.send("The song is already on pause")
        serverQueue.playing = false
        serverQueue.connection.dispatcher.pause()
        message.channel.send("I have paused the song")
        return undefined
    }
    else if (message.content.startsWith(`${prefix}resume`)) {
        if(!message.member.voice.channel)
            return message.channel.send("You need to be in the voice channel to use this command")
        if(!serverQueue)
            return message.channel.send("There is nothing playing right now")
        if(serverQueue.playing)
            return message.channel.send("The song is already playing")
        serverQueue.playing = true
        serverQueue.connection.dispatcher.resume()
        message.channel.send("I have resumed the song")
        return undefined
    }
})

function play(guild, song) {
    const serverQueue = queue.get(guild.id)
    
    if(!song) {
        serverQueue.voiceChannel.leave()
        queue.delete(guild.id)
        return
    }

    const dispatcher = serverQueue.connection.play(ytdl(song.url))
    .on('finish', () => {
        serverQueue.songs.shift()
        play(guild, serverQueue.songs[0])
    })
    .on('error', error => {
        console.log(error)
    })
    dispatcher.setVolumeLogarithmic(serverQueue.volume / 5)

    serverQueue.textChannel.send(`Now Playing: **${song.title}**`)

}

client.login(token)