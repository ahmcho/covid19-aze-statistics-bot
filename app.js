// Setting up environment variables
require("dotenv").config();
// Importing libraries
const { Telegraf, Markup } = require('telegraf')
const bot = new Telegraf(process.env.BOT_TOKEN);
const moment = require('moment');
const mysql = require('mysql');
const express = require('express');
const expressApp = express();
const axios = require('axios');

//Defining app constants
const PORT = process.env.PORT || 5000;
const URL = process.env.HEROKU_URL;
const today = moment().format("DD.MM.YYYY");
const yesterday = moment().subtract(1,'days').format("DD.MM.YYYY");


//Setting up the database 
const pool = mysql.createPool({
	coonectionLimit: 10,
	host     : process.env.MYSQL_HOST,
	user     : process.env.MYSQL_USER,
	password : process.env.MYSQL_PASSWORD,
	database : process.env.MYSQL_DB,
  charset: "utf8mb4_unicode_ci",
  collate: 'utf8mb4_unicode_ci'
});

pool.on('connection', function (connection) {
  connection.query("SET NAMES 'utf8mb4'");
});

//Setting up express and telegraf
//expressApp.use(bot.webhookCallback('/bot'));
bot.telegram.setWebhook(`${URL}/bot`);

expressApp.get('/', (req, res) => {
    res.send('Hello World!')
})
    
expressApp.listen(PORT, () => {
    console.log(`COVID-19-AZE bot is running on port ${PORT}!`)
})

// Starting work with bot
bot.start((ctx) => {
  const {username, first_name, last_name, id } = ctx.message.chat;
  pool.query(process.env.QUERY_ALL_USERS, id, (error, results, fields) => {
    if(error) throw error;
    if(results.length === 0){
      //Add user to db
      pool.query(process.env.QUERY_ADD_USER, { user_id: id, first_name, last_name: last_name ? last_name: '', username: username ? username : ''}, (error,results, fields) => {
        if (error) throw error;
      })
            //Add statistics
            pool.query(process.env.QUERY_ADD_USER_STATS, {user_id: id}, (error,results, fields) => {
        if (error) throw error;
      })
    }
  })
	let message = "Salam, bu bot vasitəsilə siz Azərbaycan üzrə COVID-19 koronavirusunun statistikasını öyrənə bilərsiz!"
	ctx.telegram.sendMessage(id, message, Markup
      .keyboard([
        ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
      ])
      .resize()
  );
	
});

bot.help((ctx) => {
  ctx.reply(`1. Bot Sizə seçiminizə uyğun günün COVID-19 🦠 koronavirusunun Azərbaycan 🇦🇿 üzrə statistikasını göndərir.\n2. Əgər bugünün məlumatları hələ açıqlanmayıbsa, bot bunu sizə bilidərəcək və dünənin məlumatlarını göndərəcək.\n3. Bot bütün məlumatları https://koronavirusinfo.az/ saytından əldə edir.\n`, Markup
    .keyboard([
      ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
    ]).resize()
  )
});

bot.hears('🗒️ Qısa məlumat', async(ctx) => {
  const {username, first_name, last_name, id } = ctx.message.chat;
  console.log(`${ctx.message.chat.first_name} ${ctx.message.chat.last_name ? ctx.message.chat.last_name: ''} clicked on ${ctx.match[0]}`);
  
  pool.query(process.env.QUERY_ALL_USERS, id, (error, results, fields) => {
    if(error) throw error;
    if(results.length === 0){
      //Add user to db
      pool.query(process.env.QUERY_ADD_USER, { user_id: id, first_name, last_name: last_name ? last_name : '', username: username ? username : ''}, (error,results, fields) => {
        if (error) throw error;
      })
      //Add statistics
      pool.query(process.env.QUERY_ADD_USER_STATS, {user_id: id}, (error,results, fields) => {
        if (error) throw error;
      })
    }
  })

  //Send statistics to db
  pool.query(process.env.QUERY_UPDATE_USER_STATS_SIMPLE, [1, id], (error, results, fields) => {
    if(error) throw error;
  });
  
  const responseForToday = await axios.get('https://covid19aze.live/api/cases/');
  let jsonDataForToday = responseForToday.data;
  if(jsonDataForToday.message === 'No data for this date yet'){
      ctx.telegram.sendMessage(id, 'Bugünün məlumatları, təəssüf ki, hələ açıqlanmayıb. Dünənin məlumatları göndərilir.', Markup
      .keyboard([
        ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
      ]).resize());
      const responseForYesterday = await axios.get(`https://covid19aze.live/api/cases/${yesterday}`);
      let jsonDataForYesterday = responseForYesterday.data;
      let responseForImage = await axios.get(`https://covid19aze.live/api/gri/${yesterday}`);
      let imageLink = responseForImage.data;
      ctx.replyWithPhoto({url : imageLink}, { caption: `🇦🇿🦠 Azərbaycanda ötən gün ərzində (${yesterday})\n${jsonDataForYesterday.infected_today} yeni koronavirusa yoluxma faktı qeydə alınıb.\n${jsonDataForYesterday.deaths_today} nəfər ölüb, ${jsonDataForYesterday.recovered_today} nəfər isə müalicə olunaraq evə buraxılıb.\n#koronavirus` }, Markup
      .keyboard([
        ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
      ]).resize());
  } else {
      let responseForImage = await axios.get(`https://covid19aze.live/api/gri/${today}`);
      let imageLink = responseForImage.data;
      ctx.replyWithPhoto({url: imageLink}, { caption: `🇦🇿🦠 Azərbaycanda bu günə (${today})\n${jsonDataForToday.infected_today} yeni koronavirusa yoluxma faktı qeydə alınıb.\n${jsonDataForToday.deaths_today} nəfər ölüb, ${jsonDataForToday.recovered_today} nəfər isə müalicə olunaraq evə buraxılıb.\n#koronavirus` },Markup
        .keyboard([
          ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
        ]).resize()
      );
  }
});
bot.hears('📚 Ətraflı məlumat', async(ctx) => {
  const {username, first_name, last_name, id } = ctx.message.chat;
    console.log(`${first_name} ${last_name ? last_name: ''} clicked on ${ctx.match[0]}`);
    pool.query(process.env.QUERY_ALL_USERS, id, (error, results, fields) => {
      if(error) throw error;
      if(results.length === 0){
        //Add user to db
        pool.query(process.env.QUERY_ADD_USER, { user_id: id, first_name, last_name: last_name ? last_name : '', username: username ? username : ''}, (error,results, fields) => {
          if (error) throw error;
        })
              //Add statistics
        pool.query(process.env.QUERY_ADD_USER_STATS, {user_id: id}, (error,results, fields) => {
          if (error) throw error;
        })
      }
	  })
    //Send statistics to db
    pool.query(process.env.QUERY_UPDATE_USER_STATS_EXTENDED, [1, id], (error, results, fields) => {
		  if(error) throw error;
	  })
    const responseForToday = await axios.get('https://covid19aze.live/api/cases/');
    let jsonDataForToday = responseForToday.data;
    if(jsonDataForToday.message === 'No data for this date yet'){
        ctx.telegram.sendMessage(id, 'Bugünün məlumatları, təəssüf ki, hələ açıqlanmayıb. Dünənin məlumatları göndərilir.',Markup
        .keyboard([
          ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
        ]).resize());
        const responseForYesterday = await axios.get(`https://covid19aze.live/api/cases/${yesterday}`);
        let jsonDataForYesterday = responseForYesterday.data;
        let responseForImage = await axios.get(`htttps://covid19aze.live/api/gri/${yesterday}`);
        let imageLink = responseForImage.data;
        ctx.replyWithPhoto({url: imageLink}, { caption: `🇦🇿🦠 Azərbaycanda ötən gün ərzində (${yesterday})\n${jsonDataForYesterday.infected_today} yeni koronavirusa yoluxma faktı qeydə alınıb.\n${jsonDataForYesterday.deaths_today} nəfər ölüb, ${jsonDataForYesterday.recovered_today} nəfər isə müalicə olunaraq evə buraxılıb.\nÜmumi yoluxanların sayı: ${jsonDataForYesterday.infected_all}\nÜmumi sağalanların sayı: ${jsonDataForYesterday.recovered_all}\nAktiv xəstə sayı: ${jsonDataForYesterday.active_cases}\nBügünkü test sayı: ${jsonDataForYesterday.tests_today}\nÜmumi test sayı: ${jsonDataForYesterday.tests_all}\nÜmumi ölüm sayı: ${jsonDataForYesterday.deaths_all}\n#koronavirus` }, Markup
        .keyboard([
          ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
        ]).resize());
    } else {
        let responseForImage = await axios.get(`https://covid19aze.live/api/gri/${today}`);
        let imageLink = responseForImage.data;
        ctx.replyWithPhoto({url: imageLink}, { caption: `🇦🇿🦠 Azərbaycanda bu günə (${today})\n${jsonDataForToday.infected_today} yeni koronavirusa yoluxma faktı qeydə alınıb.\n${jsonDataForToday.deaths_today} nəfər ölüb, ${jsonDataForToday.recovered_today} nəfər isə müalicə olunaraq evə buraxılıb.\nÜmumi yoluxanların sayı: ${jsonDataForToday.infected_all}\nÜmumi sağalanların sayı: ${jsonDataForToday.recovered_all}\nAktiv xəstə sayı: ${jsonDataForToday.active_cases}\nBügünkü test sayı: ${jsonDataForToday.tests_today}\nÜmumi test sayı: ${jsonDataForToday.tests_all}\nÜmumi ölüm sayı: ${jsonDataForToday.deaths_all}\n#koronavirus` },Markup
        .keyboard([
          ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
        ]).resize());
    }
});

bot.action(/.+/, (ctx) => {
    return ctx.answerCbQuery(`Oh, ${ctx.match[0]}! Great choice`)
})
//Launching the bot
bot.launch();