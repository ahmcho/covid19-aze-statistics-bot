// Setting up environment variables
require("dotenv").config();
// Importing libraries
const { Telegraf, Markup } = require('telegraf')
const bot = new Telegraf(process.env.BOT_TOKEN);
const moment = require('moment');
const mysql = require('mysql');
const crawler = require('crawler-request');
const express = require('express');
const {buildMessageFromResponse, downloadPdf} = require('./utils');
const expressApp = express();

//Defining app constants
const PORT = process.env.PORT || 5000;
const URL = process.env.HEROKU_URL;
const today = moment().format("DD.MM.YYYY");
const sqlToday = moment().format('YYYY-MM-DD');
const yesterday = moment().subtract(1,'days').format("DD.MM.YYYY");
const sqlYesterday = moment().subtract(1,'days').format('YYYY-MM-DD')

//Setting up the database 
const pool = mysql.createPool({
	coonectionLimit: 10,
	host     : process.env.MYSQL_HOST,
	user     : process.env.MYSQL_USER,
	password : process.env.MYSQL_PASSWORD,
	database : process.env.MYSQL_DB,
    charset: "utf8mb4"
});

//Setting up express and telegraf
expressApp.use(bot.webhookCallback('/bot'));
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
	let message = `Salam,`;
	username ? message += `${username}! ` : `${first_name} ${last_name}! `;
	message += "Bu bot vasitəsilə siz Azərbaycan üzrə COVID-19 koronavirusunun statistikasını öyrənə bilərsiz!"
	ctx.telegram.sendMessage(id, message, Markup
        .keyboard([
          ['🗒️ Qısa məlumat', '📚 Ətraflı məlumat'],
        ])
        .resize()
    );
	pool.query(process.env.QUERY_ALL_USERS, [id], (error, results, fields) => {
		if(error) throw error;
		if(results.length === 0){
			//Add user to db
			pool.query(process.env.QUERY_ADD_USER, {user_id: id, first_name, last_name, username: username ? username : ''}, (error,results, fields) => {
				if (error) throw error;
			})
            pool.query(process.env.QUERY_ADD_USER_STATS, {user_id: id}, (error,results, fields) => {
				if (error) throw error;
			})
		}
	})
});

bot.help((ctx) => {
    ctx.reply(`1. Bot Sizə seçiminizə uyğun günün COVID-19 🦠 koronavirusunun Azərbaycan 🇦🇿 üzrə statistikasını göndərir.\n2. Əgər bugünün məlumatları hələ açıqlanmayıbsa, bot bunu sizə bilidərəcək və dünənin məlumatlarını göndərəcək.\n3. Bot bütün məlumatları https://koronavirusinfo.az/ saytından əldə edir.\n4. Başqa ölkələr üçün məlumatları öyrənmək istəyirsizsə @CoronavirusCases_Bot botuna müraciət edə bilərsiz.`);
});

bot.hears('🗒️ Qısa məlumat', async(ctx) => {
    const { id } = ctx.message.chat;
    //Send statistics to db
    pool.query(process.env.QUERY_UPDATE_USER_STATS_SIMPLE, [1, id], (error, results, fields) => {
		if(error) throw error;
	})
    //Check if there is data for today
    pool.query(process.env.QUERY_GET_COVID_DATA, [sqlToday], async (error, results, fields) => {
        if(error) throw error;
        if(results.length === 0){
            const responseToday = await crawler(`https://koronavirusinfo.az/files/3/tab_${today}.pdf`);
            if(responseToday.status === 404){
                // Send a message to user that todays data is not available yet
                ctx.telegram.sendMessage(id, 'Bugünün məlumatları, təəssüf ki, hələ açıqlanmayıb. Dünənin məlumatları göndərilir.')
                //Check for yesterday data 
                pool.query(process.env.QUERY_GET_COVID_DATA, [sqlYesterday], async (error, results, fields) => {
                    if (error) throw error;
                    if(results.length !== 0){
                        //Send yesterday data
                        ctx.replyWithPhoto(results[0].img_link, { caption: `${results[0].message}#koronavirus` });
                    } else {
                        //Get yesterday data and add it to db
                        const responseYesterday = await crawler(`https://koronavirusinfo.az/files/3/tab_${yesterday}.pdf`);
                        const messageObj = buildMessageFromResponse(responseYesterday, true);
                        downloadPdf(yesterday, ctx, messageObj,pool, 'simple');
                        pool.query(process.env.QUERY_ADD_COVID_DATA, {
                            pdf_link: `https://koronavirusinfo.az/files/3/tab_${yesterday}.pdf`,
                            date: sqlYesterday,
                            message: messageObj.message,
                            additional_data: messageObj.additionalData,
                        }, (error,results, fields) => {
                            if (error) {
                                throw error;
                            }	
                        });	
                    }
                });
            } else {
                const messageObj = buildMessageFromResponse(responseToday, true);
                downloadPdf(today, ctx, messageObj, pool, 'simple');
                //Add today data to db
                pool.query(process.env.QUERY_ADD_COVID_DATA, {
                    pdf_link: `https://koronavirusinfo.az/files/3/tab_${today}.pdf`,
                    date: sqlToday,
                    message: messageObj.message,
                    additional_data: messageObj.additionalData,
                }, (error,results, fields) => {
                    if (error) {
                        throw error;
                    }
                })
            }
        } else {
            ctx.replyWithPhoto(results[0].img_link, { caption: `${results[0].message}#koronavirus` });
        }
    });
});
bot.hears('📚 Ətraflı məlumat', async(ctx) => {
    const { id } = ctx.message.chat;
    //Send statistics to db
    pool.query(process.env.QUERY_UPDATE_USER_STATS_EXTENDED, [1, id], (error, results, fields) => {
		if(error) throw error;
	})
    //Check if there is data for today
    pool.query(process.env.QUERY_GET_COVID_DATA, [sqlToday], async (error, results, fields) => {
        if(error) throw error;
        if(results.length === 0){
            const responseToday = await crawler(`https://koronavirusinfo.az/files/3/tab_${today}.pdf`);
            if(responseToday.status === 404){
                // Send a message to user that todays data is not available yet
                ctx.telegram.sendMessage(id, 'Bugünün məlumatları, təəssüf ki, hələ açıqlanmayıb. Dünənin məlumatları göndərilir.')
                //Check for yesterday data 
                pool.query(process.env.QUERY_GET_COVID_DATA, [sqlYesterday], async (error, results, fields) => {
                    if (error) throw error;
                    if(results.length !== 0){
                        //Send yesterday data
                        ctx.replyWithPhoto(results[0].img_link, { caption: `${results[0].message}${results[0].additional_data}#koronavirus` });
                    } else {
                        //Get yesterday data and add it to db
                        const responseYesterday = await crawler(`https://koronavirusinfo.az/files/3/tab_${yesterday}.pdf`);
                        const messageObj = buildMessageFromResponse(responseYesterday, true);
                        downloadPdf(yesterday, ctx, messageObj, pool, 'extended');
                        pool.query(process.env.QUERY_ADD_COVID_DATA, {
                            pdf_link: `https://koronavirusinfo.az/files/3/tab_${yesterday}.pdf`,
                            date: sqlYesterday,
                            message: messageObj.message,
                            additional_data: messageObj.additionalData,
                        }, (error,results, fields) => {
                            if (error) {
                                throw error;
                            }	
                        });	
                    }
                });
            } else {
                const messageObj = buildMessageFromResponse(responseToday, true);
                downloadPdf(today, ctx, messageObj, pool, 'extended');
                //Add today data to db
                pool.query(process.env.QUERY_ADD_COVID_DATA, {
                    pdf_link: `https://koronavirusinfo.az/files/3/tab_${today}.pdf`,
                    date: sqlToday,
                    message: messageObj.message,
                    additional_data: messageObj.additionalData,
                }, (error,results, fields) => {
                    if (error) {
                        throw error;
                    }
                })
            }
        } else {
            ctx.replyWithPhoto(results[0].img_link, { caption: `${results[0].message}${results[0].additional_data}#koronavirus` });
        }
    });
});

bot.action(/.+/, (ctx) => {
    return ctx.answerCbQuery(`Oh, ${ctx.match[0]}! Great choice`)
})
//Launching the bot
bot.launch();