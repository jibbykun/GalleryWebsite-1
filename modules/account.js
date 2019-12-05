
'use strict'

const fs = require('fs-extra')
const mime = require('mime-types')
const sqlite = require('sqlite-async')
const nodemailer = require('nodemailer');
const emailValidation = require('../modules/validEmail')

module.exports = class Account {

	constructor(dbName = ':memory:') {
		return (async() => {
			this.db = await sqlite.open(dbName)
			// we need this table to store the user accounts
			await this.db.run('CREATE TABLE IF NOT EXISTS users (userID INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, profilePicture TEXT, paypalUsername TEXT, emailAddress TEXT);')
			await this.db.run('CREATE TABLE IF NOT EXISTS items (itemID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, item TEXT, year INTEGER, price TEXT, artist TEXT, medium TEXT, size TEXT, sDescription TEXT, lDescription TEXT, imageDir1 TEXT, imageDir2 TEXT, imageDir3 TEXT, status BOOLEAN);')
			await this.db.run('CREATE TABLE IF NOT EXISTS fav (ID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, itemID INTEGER, favourite BOOLEAN);')
			return this
		})()
	}

	async uploadItem(image, user, item, year, price, artist, medium, size, sDescription, lDescription) {
		try {
			// check the number of images they attempted to upload - max 3
			var count = image.length
			if (count > 3)
				throw new Error("Max number of images 3")
			// Run through a loop for how many images they uploaded
			var dbDir = ["", "", ""];
			if (count == null)
			{
				// Theres no length if only one image - but also check if there is actually at least one image
				if (image == null)
					throw new Error("Please upload an image")
				else
				{
					// process the file
					const {path, type} = image
					const fileExtension = mime.extension(type)
					console.log(`path: ${path}`)
					console.log(`type: ${type}`)
					console.log(`fileExtension: ${fileExtension}`)
					// get the current date for the filename, so it is unique
					var time = new Date();
					const dir = user + time.getFullYear().toString() + time.getMonth().toString() + time.getDay().toString() + time.getTime().toString() + 0
					const fileDir = 'public/Items/item_' + dir + '.png'
					console.log(fileDir)
					await fs.copy(path, fileDir)
					
					
					// Directory for image to go in db
					dbDir[0] = 'Items/item_' + dir + '.png'
				}
			}
			for (var i = 0; i < count; i++) {
				// process the file
				const {path, type} = image[i]
				const fileExtension = mime.extension(type)
				console.log(`path: ${path}`)
				console.log(`type: ${type}`)
				console.log(`fileExtension: ${fileExtension}`)
				// get the current date for the filename, so it is unique
				var time = new Date();
				const dir = user + time.getFullYear().toString() + time.getMonth().toString() + time.getDay().toString() + time.getTime().toString() + i
				const fileDir = 'public/Items/item_' + dir + '.png'
				
				console.log(fileDir)
				await fs.copy(path, fileDir)
				
				// Directory for image to go in db
				dbDir[i] = 'Items/item_' + dir + '.png'
				
			}

			// get the userID from the db
			const record = await this.db.get(`SELECT userID FROM users WHERE username = "${user}";`)
			console.log(record)

			// insert the item into the db including the userID
			await this.db.run(`INSERT INTO items(item, year, price, artist, medium, size, sDescription, lDescription, imageDir1, imageDir2, imageDir3, userID, status) VALUES("${item}", "${year}", "${price}", "${artist}", "${medium}", "${size}", "${sDescription}", "${lDescription}", "${dbDir[0]}", "${dbDir[1]}", "${dbDir[2]}", "${record.userID}", true)`)
			return true
		} catch(err) {
			throw err
		}

	}

	async email(itemID, user, message, offer = 0) {
		try {
			const itemRecord = await this.db.get(`SELECT * FROM items WHERE itemID = ${itemID};`)
			const sellerRecord = await this.db.get(`SELECT * FROM users WHERE userID = "${itemRecord.userID}";`)
			const userRecord = await this.db.get(`SELECT * FROM users WHERE username = "${user}";`)
	
			let output = "";
			
			if (offer != 0)
			{
				output = `
				<p>Hi ${sellerRecord.username},</p>
				<p>You have a new offer for an item you are selling: ${itemRecord.item}</p>
				<p>${userRecord.username} has made an offer of: ${offer}</p>
				<p>${userRecord.username} asks:</p>
				<p>${message}</p>
				<p>Thank you.</p>
				`;
			}
			else 
			{
					output = `
					<p>Hi ${sellerRecord.username},</p>
					<p>You have a new question about an item you are selling: ${itemRecord.item}</p>
					<p>${userRecord.username} asks:</p>
					<p>${message}</p>
					<p>Thank you.</p>
				`;
			}

	
		var transporter = nodemailer.createTransport({
			host: "smtp-mail.outlook.com", // hostname
			secureConnection: false, // TLS requires secureConnection to be false
			port: 587, // port for secure SMTP
			tls: {
			   ciphers:'SSLv3'
			},
			auth: {
				user: 'webxgallery@outlook.com', // dont steal my acc!!!
				pass: 'SuperTester123'  // stop looking!!!
			}
		});
		
		  // setup email data with unicode symbols
		  let mailOptions = {
			  from: '"WebX Team" <webxgallery@outlook.com>', // sender address
			  to: `${sellerRecord.emailAddress}`, // list of receivers
			  subject: 'New message about an item', // Subject line
			  text: 'Hello world?', // plain text body
			  html: output // html body
		  };
		
		  // send mail with defined transport object
		  transporter.sendMail(mailOptions, (error, info) => {
			  if (error) {
				  return console.log(error);
			  }
			  console.log('Message sent: %s', info.messageId);   
			  console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
			  
		  });
			return true
		} catch(err) {
			throw err
		}
	}

	async changeEmail(email, user)
	{
		try {
			/* Server Side Email Validation */
			if (!emailValidation.emailValidation(email)){
				throw new Error('Please enter your new email address in the correct format')
				return false;}
			
			await this.db.run(`UPDATE users  SET emailAddress =  "${email}" WHERE username="${user}";`)
			return true;
		}
		catch(err){
			throw err
		}
	}

	async changeUsername(username, user)
	{
		try{
			// Update the username in the db - success!
			await this.db.run(`UPDATE users  SET username =  "${username}" WHERE username="${user}";`)
		} catch(err){
			throw err
		}
	}

	async changePaypal(paypalUsername, user)
	{
		try{
			// Update the username in the db - success!
			await this.db.run(`UPDATE users  SET paypalUsername =  "${paypalUsername}" WHERE username="${user}";`)
		} catch(err) {
			throw err
		}
	}



	async tearDown() {
		await this.db.close()
	}
}
