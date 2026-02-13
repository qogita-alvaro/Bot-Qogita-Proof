const express = require('express');
const axios = require('axios');
const FormData = require('form-data');

const app = express();
const BOT_TOKEN = process.env.BOT_TOKEN;
const WEBHOOK_URL = process.env.WEBHOOK_URL;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

app.use(express.json());

const sellerGroups = new Map();

app.get('/', (req, res) => {
  res.send('ProofPal Bot is running! 🛡️');
});

app.post('/webhook', async (req, res) => {
  console.log('Webhook received:', JSON.stringify(req.body));
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
    await sendMessage(chatId, "Hi! Please add me to a group.");
    return;
  }
  
  // Auto-register group on first interaction
  if (!sellerGroups.has(chatId)) {
    sellerGroups.set(chatId, { userId, userName, registeredAt: new Date() });
    await sendMessage(chatId, `✅ Group ready! Send photos with order numbers.\nExample: "ORDER-12345"`);
    return;
  }
  
  if (message.photo) {
    try {
      const photo = message.photo[message.photo.length - 1];
      const caption = message.caption || '';
      const orderNumber = extractOrderNumber(caption);
      
      console.log(`Processing photo from ${userName}, order: ${orderNumber || 'none'}`);
      
      // Download photo from Telegram
      const fileData = await axios.get(`https://api.telegram.org/bot${BOT_TOKEN}/getFile?file_id=${photo.file_id}`);
      const filePath = fileData.data.result.file_path;
      const fileUrl = `https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`;
      
      console.log('Downloading photo from Telegram...');
      const imageResponse = await axios.get(fileUrl, { responseType: 'arraybuffer' });
      const imageBuffer = Buffer.from(imageResponse.data);
      
      // Upload to Cloudinary
      console.log('Uploading to Cloudinary...');
      const cloudinaryUrl = await uploadToCloudinary(imageBuffer, userName, orderNumber);
      
      console.log(`Photo uploaded - Seller: ${userName}, Order: ${orderNumber || 'unknown'}, URL: ${cloudinaryUrl}`);
      
      if (orderNumber) {
        await sendMessage(chatId, `✅ Photo saved!\n\nSeller: ${userName}\nOrder: ${orderNumber}\n\n🔗 ${cloudinaryUrl}`, message.message_id);
      } else {
        await sendMessage(chatId, `✅ Photo saved for ${userName}!\n\n💡 Tip: Include order number in caption\nExample: "ORDER-12345"\n\n🔗 ${cloudinaryUrl}`, message.message_id);
      }
    } catch (error) {
      console.error('Error uploading photo:', error);
      await sendMessage(chatId, `❌ Error saving photo. Please try again.`, message.message_id);
    }
  }
}

async function uploadToCloudinary(imageBuffer, sellerName, orderNumber) {
  const formData = new FormData();
  formData.append('file', imageBuffer, { filename: 'photo.jpg' });
  formData.append('upload_preset', 'ml_default');
  
  // Organize in folders: Seller/Order
  const folder = orderNumber 
    ? `ProofPal/${sellerName}/ORDER-${orderNumber}`
    : `ProofPal/${sellerName}/misc`;
  formData.append('folder', folder);
  
  const timestamp = Math.round(Date.now() / 1000);
  formData.append('timestamp', timestamp);
  formData.append('api_key', CLOUDINARY_API_KEY);
  
  // Generate signature
  const crypto = require('crypto');
  const signature = crypto
    .createHash('sha1')
    .update(`folder=${folder}&timestamp=${timestamp}&upload_preset=ml_default${CLOUDINARY_API_SECRET}`)
    .digest('hex');
  formData.append('signature', signature);
  
  const response = await axios.post(
    `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
    formData,
    { headers: formData.getHeaders() }
  );
  
  return response.data.secure_url;
}

function extractOrderNumber(caption) {
  const patterns = [
    /ORDER[:\s-]*(\d+)/i,
    /PEDIDO[:\s-]*(\d+)/i,
    /#(\d+)/,
    /^(\d{4,})/
  ];
  
  for (const pattern of patterns) {
    const match = caption.match(pattern);
    if (match) return match[1];
  }
  return null;
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
