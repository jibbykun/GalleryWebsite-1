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
		const records = await db.all(`SELECT * FROM items;`)
		await ctx.render('index', {items: records})
	} catch(err) {
		console.log(err.message)
		await ctx.render('error', {message: err.message})
	}
})

router.get('/logout', async ctx => {
	// reset the session
	ctx.session.authorised = null
	ctx.session.user = null
	console.log(ctx.session.authorised)
	ctx.redirect('/login?successMsg=You have successfully logged out')	
})

router.get('/about', async ctx => await ctx.render('about'))

router.get('/register', async ctx => {
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	await ctx.render('register', data)
})

router.post('/register', async ctx => {
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		const db = await Database.open(dbName)
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
		const sql = `INSERT INTO users(username, password, profilePicture) 
			VALUES("${body.username}", "${body.password}", "pic_${body.username}");`
		console.log(sql)
		await db.run(sql)
		await db.close()
		ctx.redirect('/login?successMsg=You have successfully registered!')
	} catch(err) {
		ctx.body = err.message
	}
})

router.get('/login', async ctx => {
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	await ctx.render('login', data)  
})

router.post('/login', async ctx => {
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
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	await ctx.render('account', data)  
})

router.get('/profilePic', async ctx => {
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg

	// get the directory from the db
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record)
	await db.close()

	data.picDir = 'ProfilePictures/' + record.profilePicture + '.png'
	await ctx.render('profilePic', data)  
})

router.post('/uploadProfilePic', koaBody, async ctx => {
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
	// Check for validation messages
	const data = {}
	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	await ctx.render('sell', data)  
})

router.post('/uploadItem', koaBody, async ctx => {
	try {
		const body = ctx.request.body
		console.log(body)
		// process the file
		const {path, type} = ctx.request.files.image
		const fileExtension = mime.extension(type)
		console.log(`path: ${path}`)
		console.log(`type: ${type}`)
		console.log(`fileExtension: ${fileExtension}`)
		// get the current date for the filename, so it is unique
		var time = new Date();
		const dir = ctx.session.user + time.getFullYear().toString() + time.getMonth().toString() + time.getDay().toString() + time.getTime().toString()
		const fileDir = 'public/Items/item_' + dir + '.png'
		console.log(fileDir)
		await fs.copy(path, fileDir)
		const db = await Database.open(dbName)
		// get the userID from the db
		const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
		console.log(record)
		// Directory for image to go in db
		const dbDir = 'Items/item_' + dir + '.png'
		// insert the item into the db including the userID
		await db.run(`INSERT INTO items(item, price, imageDir, userID) VALUES("${body.item}", "${body.price}", "${dbDir}", "${record.userID}")`)
		await db.close()

		// redirect to my items page
		ctx.redirect(`/myItems?successMsg=item uploaded successfully`)
	} catch(err) {
		await ctx.render('error', {message: err.message})
	}
})

router.get('/myItems', async ctx => {
	try {
		const db = await Database.open(dbName)
		// get the userID from the db
		const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
		const data = await db.all(`SELECT * FROM items WHERE userID = "${record.userID}";`)
		await ctx.render('myItems', {items: data})
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
		data.username = itemUser.username
		data.picDir = 'ProfilePictures/' + itemUser.profilePicture + '.png'
		data.item = record.item
		data.price = record.price
		data.imageDir = record.imageDir

		await ctx.render('itemDetails', data)
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})


module.exports = app.listen(port, async() => {
	// create the db if it doesnt exist - for users running first time
	const db = await Database.open(dbName)
	await db.run('CREATE TABLE IF NOT EXISTS users (userID INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, profilePicture TEXT);')
	await db.run('CREATE TABLE IF NOT EXISTS items (itemID INTEGER PRIMARY KEY AUTOINCREMENT, item TEXT, price TEXT, imageDir TEXT, userID INTEGER);')
	await db.close()
	console.log(`listening on port ${port}`)
})