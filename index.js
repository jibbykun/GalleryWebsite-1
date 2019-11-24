#!/usr/bin/env node
'use strict'

const Koa = require('koa')
const Router = require('koa-router')
const staticDir = require('koa-static')
const Database = require('sqlite-async')
const bodyParser = require('koa-bodyparser')
const session = require('koa-session')
const bcrypt = require('bcrypt-promise')
const views = require('koa-views')
const koaBody = require('koa-body')({multipart: true, uploadDir: '.'})
const fs = require('fs-extra')
const mime = require('mime-types')
const watermark = require('image-watermark');
const nodemailer = require('nodemailer');

const app = new Koa()
const router = new Router()

app.keys = ['hidemyapp']
app.use(staticDir('public'))
app.use(bodyParser())
app.use(session(app))
app.use(views(`${__dirname}/views`, { extension: 'handlebars' }, {map: { handlebars: 'handlebars' }}))
app.use(router.routes())

const port = 8080
const saltRounds = 10
const dbName = 'gallerydb.db'

router.get('/', async ctx => {
	try {
		const data = {}
		// Check for validation messages
		if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		// get all the items
		const db = await Database.open(dbName)
		const records = await db.all(`SELECT * FROM items WHERE status = true;`)
		data.authorised = ctx.session.authorised
		await ctx.render('index', {items: records, data: data})
	} catch(err) {
		console.log(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.get('/logout', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// reset the session
	ctx.session.authorised = null
	ctx.session.user = null
	console.log(ctx.session.authorised)
	ctx.redirect('/login?successMsg=You have successfully logged out')	
})

router.get('/about', async ctx =>{ 
	const data = {}
	data.authorised = ctx.session.authorised
	await ctx.render('about', data)
})

router.get('/contact', async ctx =>{ 
	const data = {}
	data.authorised = ctx.session.authorised
	await ctx.render('contact', data)
})
router.get('/payment', async ctx =>{ 
	const data = {}
	data.authorised = ctx.session.authorised
	await ctx.render('payment', data)
})

router.get('/register', async ctx => {
	if(ctx.session.authorised == true) 
		return ctx.redirect('/')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('register', data)
})


router.get('/changePassword', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('changePassword', data)
})

router.post('/changePassword', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		const db = await Database.open(dbName)
		// check if the password is at least 10 characters long
		if (body.password.length < 10)
			return ctx.redirect("/changepassword?errorMsg=Password must be at least 10 characters")
		// check if the password contains an uppercase character
		if (!/[A-Z]/.test(body.password))
			return ctx.redirect("/changepassword?errorMsg=Password must contain at least one uppercase character")
		// check if the password contains a number
		if (!/\d/.test(body.password))
			return ctx.redirect("/changepassword?errorMsg=Password must contain at least one number")
		// check if the passwords match
		if (body.password != body.passwordRepeat)
			return ctx.redirect("/changepassword?errorMsg=Passwords do not match")
		// encrypt the password
		body.password = await bcrypt.hash(body.password, saltRounds)
		// Update the password in the db - success!
		const sql = `UPDATE users  SET password =  "${body.password}" WHERE username="${ctx.session.user}";`
		console.log(sql)
		await db.run(sql)
		await db.close()
		ctx.redirect('/changepassword?successMsg=You have successfully changed your password!')
	} catch(err) {
		ctx.body = err.message
	}  	
})


router.post('/register', async ctx => {
	if(ctx.session.authorised == true) 
		return ctx.redirect('/')
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		const db = await Database.open(dbName)
		// check if the password is at least 10 characters long
		if (body.password.length < 10)
			return ctx.redirect("/register?errorMsg=Password must be at least 10 characters")
		// check if the password contains an uppercase character
		if (!/[A-Z]/.test(body.password))
			return ctx.redirect("/register?errorMsg=Password must contain at least one uppercase character")
		// check if the password contains a number
		if (!/\d/.test(body.password))
			return ctx.redirect("/register?errorMsg=Password must contain at least one number")
		// check if the passwords match
		if (body.password != body.passwordRepeat)
			return ctx.redirect("/register?errorMsg=Passwords do not match")
		// Check if a user already exists with the same username
		const records = await db.get(`SELECT count(userID) AS count FROM users WHERE username="${body.username}";`)
		if(records.count) 
			return ctx.redirect('/register?errorMsg=Username taken. Please try again.')
		// encrypt the password
		body.password = await bcrypt.hash(body.password, saltRounds)
		// insert the user into the db - success!
		const sql = `INSERT INTO users(username, password, profilePicture, paypalUsername, emailAddress) 
			VALUES("${body.username}", "${body.password}", "pic_${body.username}", "${body.paypalUsername}", "${body.emailAddress}");`
		console.log(sql)
		await db.run(sql)
		await db.close()
		ctx.redirect('/login?successMsg=You have successfully registered!')
	} catch(err) {
		ctx.body = err.message
	}
})

router.get('/login', async ctx => {
	if(ctx.session.authorised == true) 
		return ctx.redirect('/')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('login', data)  
})

router.post('/login', async ctx => {
	if(ctx.session.authorised == true) 
		return ctx.redirect('/')
	try {
		const body = ctx.request.body
		const db = await Database.open(dbName)
		// check if the user exists
		const records = await db.get(`SELECT count(userID) AS count FROM users WHERE username="${body.username}";`)
		if(!records.count) 
			return ctx.redirect('/login?errorMsg=User doesnt exist')
		const record = await db.get(`SELECT password FROM users WHERE username = "${body.username}";`)
		await db.close()
		// check login credentials
		const valid = await bcrypt.compare(body.password, record.password)
		if(valid == false)
			return ctx.redirect('/login?errorMsg=Incorrect password')
		// success
		ctx.session.authorised = true
		ctx.session.user = body.username
		console.log(ctx.session.user)
		return ctx.redirect('/?successMsg=You are now logged in...')
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/account', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	// Getting Profile Picture and Username from Database
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
	const record2 = await db.get(`SELECT username FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record,record2)
	await db.close()
	data.usName = record2.username
	data.picDir = 'ProfilePictures/' + record.profilePicture + '.png'
	await ctx.render('account', data) 
})

router.get('/profilePic', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	// get the directory from the db
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record)
	await db.close()

	data.picDir = 'ProfilePictures/' + record.profilePicture + '.png'
	await ctx.render('profilePic', data)  
})

router.post('/uploadProfilePic', koaBody, async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
		const body = ctx.request.body
		console.log(body)
		// process the file
		const {path, type} = ctx.request.files.profilePicture
		const fileExtension = mime.extension(type)
		console.log(`path: ${path}`)
		console.log(`type: ${type}`)
		console.log(`fileExtension: ${fileExtension}`)
		//set the file directory dynamically to the user
		const db = await Database.open(dbName)
		// get the directory from the db
		const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
		console.log(record)
		await db.close()
		const fileDir = 'public/ProfilePictures/' + record.profilePicture + '.png'
		await fs.copy(path, fileDir)
		// redirect to account page
		ctx.redirect(`/account?successMsg=profile picture updated`)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/sell', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('sell', data)  
})

router.post('/uploadItem', koaBody, async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
		const body = ctx.request.body
		console.log(body)
		// check the number of images they attempted to upload - max 3
		var count = ctx.request.files.image.length
		if (count > 3)
			return ctx.redirect("/sell?errorMsg=Max number of images 3")
		// Run through a loop for how many images they uploaded
		var dbDir = ["", "", ""];
		if (count == null)
		{
			// Theres no length if only one image - but also check if there is actually at least one image
			if (ctx.request.files.image == null)
				return ctx.redirect("/sell?errorMsg=Please upload an image")
			else
			{
				// process the file
				const {path, type} = ctx.request.files.image
				const fileExtension = mime.extension(type)
				console.log(`path: ${path}`)
				console.log(`type: ${type}`)
				console.log(`fileExtension: ${fileExtension}`)
				// get the current date for the filename, so it is unique
				var time = new Date();
				const dir = ctx.session.user + time.getFullYear().toString() + time.getMonth().toString() + time.getDay().toString() + time.getTime().toString() + 0
				const fileDir = 'public/Items/item_' + dir + '.png'
				console.log(fileDir)
				await fs.copy(path, fileDir)
				
				// Directory for image to go in db
				dbDir[0] = 'Items/item_' + dir + '.png'
			}
		}
		for (var i = 0; i < count; i++) {
			// process the file
			const {path, type} = ctx.request.files.image[i]
			const fileExtension = mime.extension(type)
			console.log(`path: ${path}`)
			console.log(`type: ${type}`)
			console.log(`fileExtension: ${fileExtension}`)
			// get the current date for the filename, so it is unique
			var time = new Date();
			const dir = ctx.session.user + time.getFullYear().toString() + time.getMonth().toString() + time.getDay().toString() + time.getTime().toString() + i
			const fileDir = 'public/Items/item_' + dir + '.png'
			
			console.log(fileDir)
			await fs.copy(path, fileDir)
			
			// Directory for image to go in db
			dbDir[i] = 'Items/item_' + dir + '.png'
			
		}
		
		// get the userID from the db
		const db = await Database.open(dbName)
		const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
		console.log(record)

		// insert the item into the db including the userID
		await db.run(`INSERT INTO items(item, year, price, artist, medium, size, sDescription, lDescription, imageDir1, imageDir2, imageDir3, userID, status) VALUES("${body.item}", "${body.year}", "${body.price}", "${body.artist}", "${body.medium}", "${body.size}", "${body.sDescription}", "${body.lDescription}", "${dbDir[0]}", "${dbDir[1]}", "${dbDir[2]}", "${record.userID}", true)`)
		await db.close()

		// redirect to my items page
		ctx.redirect(`/myItems?successMsg=item uploaded successfully`)
	} catch(err) {
		console.log(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.get('/myItems', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
		const db = await Database.open(dbName)
		// get the userID from the db
		const data = {}
		const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
		const item = await db.all(`SELECT * FROM items WHERE userID = "${record.userID}";`)
		data.authorised = ctx.session.authorised
		await ctx.render('myItems', {items: item, data: data})
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.get('/:id', async ctx => {
	try {
		// Check if the user is logged in - or send them back to the login page
		console.log(ctx.session.authorised)
		if(ctx.session.authorised !== true) 
			return ctx.redirect('/login?errorMsg=you are not logged in')
		const db = await Database.open(dbName)
		console.log(`item id: ${ctx.params.id}`)
		const data = {}
		const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
		// check if the item exists
		if(record === undefined) throw new Error('unrecogised item')
		const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
		// set the data - item info + user info
		data.item = record.item
		data.year = record.year
		data.price = record.price
		data.artist = record.artist
		data.medium = record.medium
		data.size = record.size
		data.itemID = record.itemID
		data.sDescription = record.sDescription
		data.lDescription = record.lDescription
		
		data.imageDir1 = record.imageDir1
		data.imageDir2 = record.imageDir2
		data.imageDir3 = record.imageDir3
		data.imageDir4 = record.imageDir4
		data.imageDir5 = record.imageDir5


		data.username = itemUser.username
		data.picDir = 'ProfilePictures/' + itemUser.profilePicture + '.png'

		if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		data.authorised = ctx.session.authorised
		await ctx.render('itemDetails', data)
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.get('/buy/:id', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
		try {
			const db = await Database.open(dbName)
			console.log(`item id: ${ctx.params.id}`)
			const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
			// check if the item exists
			if(record === undefined) throw new Error('unrecogised item')
			// check if the item is for sale
			if(record.status === false) 
				return ctx.redirect(`/${ctx.params.id}?errorMsg=Item not for sale`)
			const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
			if (itemUser.username === ctx.session.user) 
				return ctx.redirect(`/${ctx.params.id}?errorMsg=Seller cannot buy their own item`)
			await db.get(`UPDATE items SET status = false WHERE itemID = ${ctx.params.id};`)

			ctx.redirect('/?successMsg=item purchased')
		} catch(err) {
			console.error(err.message)
			await ctx.render('error', {message: err.message})
		}

})

router.get('/contactSeller/:id', async ctx => {
	try {
		// Check if the user is logged in - or send them back to the login page
		console.log(ctx.session.authorised)
		if(ctx.session.authorised !== true) 
			return ctx.redirect('/login?errorMsg=you are not logged in')
		const db = await Database.open(dbName)
		console.log(`item id: ${ctx.params.id}`)
		const data = {}
		const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
		// check if the item exists
		if(record === undefined) throw new Error('unrecogised item')
		const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
		// set the data - item info + user info


		if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		data.authorised = ctx.session.authorised
		await ctx.render('contactSeller', {item: record, seller: itemUser, data: data})
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.post('/email', async ctx => {
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
		try {
			const body = ctx.request.body
			const db = await Database.open(dbName)
			const itemRecord = await db.get(`SELECT * FROM items WHERE itemID = ${body.itemID};`)
			const sellerRecord = await db.get(`SELECT * FROM users WHERE userID = "${itemRecord.userID}";`)
			const userRecord = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
			await db.close()
	
			const output = `
			<p>Hi ${sellerRecord.username},</p>
			<p>You have a new question about an item you are selling: ${itemRecord.item}</p>
			<p>${userRecord.username} asks:</p>
			<p>${body.message}</p>
			<p>Thank you.</p>
		  `;
	
		var transporter = nodemailer.createTransport({
			host: "smtp-mail.outlook.com", // hostname
			secureConnection: false, // TLS requires secureConnection to be false
			port: 587, // port for secure SMTP
			tls: {
			   ciphers:'SSLv3'
			},
			auth: {
				user: 'hooglywooglyboogly6969@outlook.com', // dont steal my acc!!!
				pass: 'Supertester123'  // stop looking!!!
			}
		});
		
		  // setup email data with unicode symbols
		  let mailOptions = {
			  from: '"WebX Team" <hooglywooglyboogly6969@outlook.com>', // sender address
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

		  return ctx.redirect(`/${body.itemID}?successMsg=Message Sent...`);
	
		} catch(err) {
			console.log(err.message)
			await ctx.render('error', {message: err.message})
		}
})



module.exports = app.listen(port, async() => {
	// create the db if it doesnt exist - for users running first time
	const db = await Database.open(dbName)
	await db.run('CREATE TABLE IF NOT EXISTS users (userID INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, profilePicture TEXT, paypalUsername TEXT, emailAddress TEXT);')
	await db.run('CREATE TABLE IF NOT EXISTS items (itemID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, item TEXT, year INTEGER, price TEXT, artist TEXT, medium TEXT, size TEXT, sDescription TEXT, lDescription TEXT, imageDir1 TEXT, imageDir2 TEXT, imageDir3 TEXT, status BOOLEAN);')
	await db.close()
	console.log(`listening on port ${port}`)
})


/*
			var options = {
				'text' : 'sample watermark', 
				'resize' : '100%',
				'override-image' : true
			};
			watermark.embedWatermark('public/Items/item_aaa201910115740942361890.png', options);


*/