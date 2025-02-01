import { Client, Message } from "discord.js";

export default async function Logger(client: Client, message: Message) {
    console.log(message.content);

}
