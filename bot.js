const express = require('express');
const axios = require('axios');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;

app.use(express.json());

const sellerGroups = new Map();

app.get('/', (req, res) => {
  res.send('ProofPal Bot is running! 🛡️');
});

app.post('/webhook', async (req, res) => {
  try {
    const update = req.body;
    if (update.message) {
      await handleMessage(update.message);
    }
    res.sendStatus(200);
  } catch (error) {
    console.error('Error:', error);
    res.sendStatus(500);
  }
});

async function handleMessage(message) {
  const chatId = message.chat.id;
  const userId = message.from.id;
  const userName = message.from.first_name;
  const isGroup = message.chat.type === 'group' || message.chat.type === 'supergroup';
  
  if (!isGroup) {
    await sendMessage(chatId, "Hi! Please add me to a group and send /start there.");
    return;
  }
  
  if (message.text === '/start') {
    sellerGroups.set(chatId, { userId, userName, registeredAt: new Date() });
    await sendMessage(chatId, `✅ Group registered for ${userName}! Send photos with order numbers now.`);
    return;
  }
  
  if (message.photo) {
    const groupInfo = sellerGroups.get(chatId);
    if (!groupInfo) {
      await sendMessage(chatId, "⚠️ Send /start first to register this group.");
      return;
    }
    
    const photo = message.photo[message.photo.length - 1];
    const fileData = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
    
    console.log(`Photo received from ${userName}`);
    
    await sendMessage(chatId, `✅ Photo uploaded for ${userName}!`, message.message_id);
  }
}

async function sendMessage(chatId, text, replyTo = null) {
  const params = { chat_id: chatId, text: text };
  if (replyTo) params.reply_to_message_id = replyTo;
  await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, params);
}

async function setupWebhook() {
  if (WEBHOOK_URL) {
    const response = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/setWebhook?url=${WEBHOOK_URL}/webhook`);
    console.log('Webhook set:', response.data);
  }
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`🛡️ ProofPal running on port ${PORT}`);
  await setupWebhook();
});
