import { logMessageToTerminal } from '../helper.js';

export default async function Logger(client, message) {
    logMessageToTerminal(message);
}
