const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const app = express();
const port = process.env.PORT || 3000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const groups = new Map();

app.use(bodyParser.json());

app.post('/webhook', (req, res) => {
    const update = req.body;
    console.log('Received update:', JSON.stringify(update));
    
    if (update.message && (update.message.chat.type === 'group' || update.message.chat.type === 'supergroup')) {
        const chatId = update.message.chat.id;
        
        if (update.message.photo) {
            const caption = update.message.caption || '';
            console.log(`Photo received in group ${chatId} with caption: ${caption}`);
            
            const orderNumber = extractOrderNumber(caption);
            if (orderNumber) {
                console.log(`Extracted order number: ${orderNumber}`);
                sendConfirmation(chatId, `Order #${orderNumber} received!`);
            } else {
                sendConfirmation(chatId, 'Photo received!');
            }
        }
        
        if (update.message.text === '/start') {
            groups.set(chatId, { name: update.message.chat.title });
            console.log(`Group ${chatId} registered: ${update.message.chat.title}`);
            sendConfirmation(chatId, 'Group registered! Send photos with order numbers in captions.');
        }
    }
    
    res.sendStatus(200);
});

function extractOrderNumber(caption) {
    if (!caption) return null;
    const match = caption.match(/Order\s*#?(\d+)/i);
    return match ? match[1] : null;
}

function sendConfirmation(chatId, message) {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    axios.post(url, { chat_id: chatId, text: message })
        .then(response => {
            console.log('Confirmation message sent:', response.data);
        })
        .catch(error => {
            console.error('Error sending message:', error.message);
        });
}

app.listen(port, () => {
    console.log(`Bot server listening on port ${port}`);
    console.log(`Registered groups: ${groups.size}`);
});
