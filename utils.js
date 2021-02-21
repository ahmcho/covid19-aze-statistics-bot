require("dotenv").config();
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const converter = require('pdf-to-png');
const download = require('download-pdf');

const buildMessageFromResponse = (response, isLong) => {
    const textArray = response.text.split('\n').filter((item) => item != '');
    //console.log(textArray);
    const allInfected = `${textArray[3].trim()} ${textArray[4]}: ${textArray[5]}`;
    const allHealed = `${textArray[22]}${textArray[23]}: ${textArray[18]}`
    const allDead = `${textArray[27]}${textArray[28]}: ${textArray[21]}`;
    const allTests = `${textArray[25]}${textArray[26]}: ${textArray[20]}`;
    const testsToday =  `${textArray[12]}${textArray[13].trim()}: ${textArray[14]}`;
    const activeCases = `${textArray[24]}: ${textArray[19]}`;

	const today = textArray[2].replace('ÜmumiBu gün','');	
	const newInfected = `${textArray[8]}`;
	const newRecovered = `${textArray[11]}`;
	const deathsToday = `${textArray[17]}`;
	let message = `🇦🇿🦠 Azərbaycanda bu günə (${today})\n${newInfected} yeni koronavirusa yoluxma faktı qeydə alınıb.\n${deathsToday} nəfər ölüb, ${newRecovered} nəfər isə müalicə olunaraq evə buraxılıb.\n`;
    if(isLong){
        let additionalData;
        additionalData = `${allInfected}\n${allHealed}\n${activeCases}\n${testsToday}\n${allTests}\n${allDead}\n`;
        return {
            message,
            additionalData
        }
    }
    message += '#koronavirus';
	return message; 
}

const downloadPdf = (day, ctx, data, pool, type) => {
    const filename = (day) => `${day}.pdf`; 
	const directory = './'
    download(`https://koronavirusinfo.az/files/3/tab_${day}.pdf`,{directory, filename: filename(day) }	, function(err){
        if (err) throw err;
        converter({
            input: `${day}.pdf`,
            output: 'output.png',
            scale: '1'
        }, () => {
            let formData = new FormData();
            let headers;
            formData.append("files", fs.createReadStream('./output.png'), { knownLength: fs.statSync('./output.png').size });
            headers = {
                ...formData.getHeaders(),
                "Content-Length": formData.getLengthSync()
            };
            axios.post("https://telegra.ph/upload", formData, {headers}).then((result) => {
                url = `https://telegra.ph${result.data[0].src}`;
                pool ? pool.query(process.env.QUERY_UPDATE_COVID_DATA, [url,data.message]
                    , (error,results, fields) => {
                    if (error) {
                        throw error;
                    }
                    setTimeout(() => {
                        type === 'extended' ? ctx.replyWithPhoto(url, { caption: `${data.message}${data.additionalData}#koronavirus` }) : ctx.replyWithPhoto(url, { caption: `${data.message}#koronavirus` });
                    },1000);
                }) : null
            });
        })
    });
}

const SplitKeyboard = (keyboard) => {
	const length = keyboard.length;
	// Last row can contain one element more.
	const maxElementsPerRow = 1;
	const numberOfRows = Math.ceil(length / maxElementsPerRow);
	const elementsPerRow = Math.round(length / numberOfRows);
	const result = [];
	for (let i = 0; i < numberOfRows; i++) {
		// Add remainder to last row
		const end = i === numberOfRows - 1 ? length : (i + 1) * elementsPerRow;
		const split = keyboard.slice(i * elementsPerRow, end);
		result.push(split);
	}
	return result;
};

module.exports  = {buildMessageFromResponse, downloadPdf, SplitKeyboard};