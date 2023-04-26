import { Telegraf, session } from "telegraf";
import { message } from "telegraf/filters";
import config from "config";
import { ogg } from "./ogg.js";
import { openai } from "./openai.js";
import { code } from "telegraf/format";

const bot = new Telegraf(config.get("TELEGRAM_TOKEN"));

const INITIAL_SESSION = {
  messages: [],
};

bot.use(session());

bot.command("new", async (context) => {
  context.session = INITIAL_SESSION;
  await context.reply("Жду вашего голосового или текстового сообщения");
});

bot.command("start", async (context) => {
  context.session = INITIAL_SESSION;
  await context.reply("Жду вашего голосового или текстового сообщения");
});

bot.on(message("voice"), async (context) => {
  context.session = context.session ?? INITIAL_SESSION;
  try {
    await context.reply(code("Жду ответ от сервера"));
    const FILE_ID = context.message.voice.file_id;
    const USER_ID = String(context.message.from.id);
    const link = await context.telegram.getFileLink(FILE_ID);
    const oggPath = await ogg.create(link.href, USER_ID);
    const mp3Path = await ogg.toMp3(oggPath, USER_ID);

    const text = await openai.transcription(mp3Path);

    await context.reply(code(`Ваш запрос: ${text}`));

    context.session.messages.push({ role: openai.roles.USER, content: text });

    const response = await openai.chat(context.session.messages);

    context.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await context.reply(response.content);
  } catch (error) {
    console.log("Error while voice message", error.message);
  }
});

bot.on(message("text"), async (context) => {
  context.session = context.session ?? INITIAL_SESSION;
  try {
    await context.reply(code("Жду ответ от сервера"));

    context.session.messages.push({
      role: openai.roles.USER,
      content: context.message.text,
    });

    const response = await openai.chat(context.session.messages);

    context.session.messages.push({
      role: openai.roles.ASSISTANT,
      content: response.content,
    });

    await context.reply(response.content);
  } catch (error) {
    console.log("Error while voice message", error.message);
  }
});

bot.launch();

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
