import { logMessageToTerminal } from '../helper.js';

export default async function messageHandler(client, message) {
    logMessageToTerminal(message);
}
