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
const koaBody = require('koa-body')({ multipart: true, uploadDir: '.' })
const fs = require('fs-extra')
const mime = require('mime-types')
const watermark = require('image-watermark')
const nodemailer = require('nodemailer')

/* custom modules */
const User = require('./modules/user')
const Account = require('./modules/account')
const emailValidation = require('./modules/validEmail')

const app = new Koa()
const router = new Router()

app.keys = ['hidemyapp']
app.use(staticDir('public'))
app.use(bodyParser())
app.use(session(app))
app.use(views(`${__dirname}/views`, { extension: 'handlebars' }, { map: { handlebars: 'handlebars' } }))
app.use(router.routes())

const port = 8080
const saltRounds = 10
const dbName = 'gallerydb.db'

let user
let account

router.get('/', async ctx => {
	try {
		const data = {}
		// Check for validation messages
		if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		// get all the items
		const db = await Database.open(dbName)
		const records = await db.all('SELECT * FROM items;')
		data.authorised = ctx.session.authorised
		await ctx.render('index', { items: records, data: data})
	} catch (err) {
		console.log(err.message)
		await ctx.render('error', { message: err.message })
	}
})

router.get('/logout', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// reset the session
	ctx.session.authorised = null
	ctx.session.user = null
	console.log(ctx.session.authorised)
	ctx.redirect('/login?successMsg=You have successfully logged out')
})

router.get('/about', async ctx => {
	const data = {}
	data.authorised = ctx.session.authorised
	await ctx.render('about', data)
})

router.get('/contact', async ctx => {
	const data = {}
	data.authorised = ctx.session.authorised
	await ctx.render('contact', data)
})
router.get('/receipt', async ctx => {
	const data = ctx.request.body
	data.authorised = ctx.session.authorised
	await ctx.render('receipt', data)
})
router.post('/receipt', async ctx => {
  // Check if the user is logged in - or send them back to the login page
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
    //Get data from db
		const db = await Database.open(dbName)
		const user = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
		const basket = await db.get(`SELECT itemID FROM basket WHERE userID = "${user.userID}";`)
		//Mark item as sold
		await db.run(`UPDATE items SET status = false WHERE itemID = "${basket['itemID']}"; `)
		await db.run(`DELETE FROM basket WHERE userID="${user.userID}";`)
    //Item is sold, send email to seller
    
		ctx.redirect(`/receipt?successMsg=Thank you for your purchase!`)
	} catch(err) {
		console.log(err.message)
		await ctx.render('error', {message: err.message})
	}
})


router.get('/basket', async ctx =>{ 
  // Check if the user is logged in - or send them back to the login page
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
	// Check for validation messages
	const db = await Database.open(dbName)
	// get the data about items in basket from the db
	const data = {}
	const user = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
	const basket = await db.all(`SELECT itemID FROM basket WHERE userID = "${user.userID}";`)
	let items = {}
  let total = 0
  //Get data about each item in basket and get total price
	for(var i = 0; i < basket.length; i++){
		items = await db.all(`SELECT * FROM items INNER JOIN basket ON basket.itemID=items.itemID WHERE basket.userID = "${user.userID}";`)
		total += parseInt(items[i].price)
	}
	data.total = total
	data.authorised = ctx.session.authorised

	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('basket', {items: items, user: user, data: data})
})
router.get('/checkout', async ctx =>{ 
  // Check if the user is logged in - or send them back to the login page
	if(ctx.session.authorised !== true) 
	  return ctx.redirect('/login?errorMsg=you are not logged in')
	const db = await Database.open(dbName)
	// get the data about items in basket from the db
	const data = {}
	const user = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
	const basket = await db.all(`SELECT itemID FROM basket WHERE userID = "${user.userID}";`)
	let items = {}
  let total = 0
  //Get data about each item in basket and get total price
	for(var i = 0; i < basket.length; i++){
		//use join function for joining queries
		items = await db.all(`SELECT * FROM items INNER JOIN basket ON basket.itemID=items.itemID WHERE basket.userID = "${user.userID}";`)
		total += parseInt(items[i].price)
	}
	data.total = total
	data.authorised = ctx.session.authorised

	if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('checkout', {items: items, user: user, data: data})
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

router.get('/changeEmail', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT emailAddress FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record)
	await db.close()
	data.usEmail = record.emailAddress
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('changeEmail', data)
})

router.post('/changeEmail', async ctx => {
	if(ctx.session.authorised !== true)
		return ctx.redirect('/login?errorMsg=you are not logged in')
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		account = await new Account(dbName)
		console.log(ctx.session.user)
		await account.changeEmail(body.emailAddress, ctx.session.user)
		ctx.redirect('/changeEmail?successMsg=You have successfully changed your email address!')
	} catch(err) {
		return ctx.redirect(`/changeEmail?errorMsg=${err.message}`)
	}

})

router.get('/changePaypal', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('changePaypal', data)
})

router.post('/changePaypal', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		account = await new Account(dbName)
		console.log(ctx.session.user)
		await account.changePaypal(body.paypalUsername, ctx.session.user)

		ctx.redirect('/changePaypal?successMsg=You have successfully changed your Paypal Username!')
	} catch (err) {
		ctx.body = err.message
	}
})

router.get('/changeUsername', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT username FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record)
	await db.close()
	data.usName = record.username
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('changeUsername', data)
})

router.post('/changeUsername', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		account = await new Account(dbName)
		console.log(ctx.session.user)
		await account.changeUsername(body.username, ctx.session.user)
		// Make them log back into their accounts
		ctx.session.authorised = null
		ctx.session.user = null
		ctx.redirect('/login?successMsg=You have changed your username now log back in')
	} catch (err) {
		ctx.body = err.message
	}
})

router.get('/changePassword', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('changePassword', data)
})

router.post('/changePassword', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body
		const db = await Database.open(dbName)
		// check if the password is at least 10 characters long
		if (body.password.length < 10) {
 return ctx.redirect('/changepassword?errorMsg=Password must be at least 10 characters') 
}
		// check if the password contains an uppercase character
		if (!/[A-Z]/.test(body.password)) {
 return ctx.redirect('/changepassword?errorMsg=Password must contain at least one uppercase character') 
}
		// check if the password contains a number
		if (!/\d/.test(body.password)) {
 return ctx.redirect('/changepassword?errorMsg=Password must contain at least one number') 
}
		// check if the passwords match
		if (body.password !== body.passwordRepeat) {
 return ctx.redirect('/changepassword?errorMsg=Passwords do not match') 
}
		// encrypt the password
		body.password = await bcrypt.hash(body.password, saltRounds)
		// Update the password in the db - success!
		const sql = `UPDATE users  SET password =  "${body.password}" WHERE username="${ctx.session.user}";`
		console.log(sql)
		await db.run(sql)
		await db.close()
		// Make them log back into their accounts
		ctx.session.authorised = null
		ctx.session.user = null
		console.log(ctx.session.authorised)
		ctx.redirect('/login?successMsg=You have changed your password now log back in')
	} catch (err) {
		ctx.body = err.message
	}
})

router.get('/register', async ctx => {
	if (ctx.session.authorised === true) {
 return ctx.redirect('/') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('register', data)
})

router.post('/register', async ctx => {
	if (ctx.session.authorised === true) {
 return ctx.redirect('/') 
}
	try {
		console.log(ctx.request.body)
		const body = ctx.request.body

		// call the functions in the module
		user = await new User(dbName)
		await user.register(body.username, body.password, body.passwordRepeat, body.paypalUsername, body.emailAddress)

		ctx.redirect('/login?successMsg=You have successfully registered!')
	} catch (err) {
		return ctx.redirect(`/register?errorMsg=${err.message}`)
	} finally {
		user.tearDown()
	}
})

router.get('/login', async ctx => {
	if (ctx.session.authorised === true) {
 return ctx.redirect('/')
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('login', data)
})

router.post('/login', async ctx => {
	if (ctx.session.authorised === true) {
 return ctx.redirect('/') 
}
	try {
		const body = ctx.request.body

		user = await new User(dbName)
		await user.login(body.username, body.password)
		// success
		ctx.session.authorised = true
		ctx.session.user = body.username
		console.log(ctx.session.user)
		return ctx.redirect('/?successMsg=You are now logged in...')
	} catch (err) {
		return ctx.redirect(`/login?errorMsg=${err.message}`)
	} finally {
		user.tearDown()
	}
})

router.get('/account', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	// Getting Profile Picture and Username from Database
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
	const record2 = await db.get(`SELECT username FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record, record2)
	await db.close()
	data.usName = record2.username
	data.picDir = `ProfilePictures/${  record.profilePicture  }.png`
	await ctx.render('account', data)
})

router.get('/profilePic', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	// get the directory from the db
	const db = await Database.open(dbName)
	const record = await db.get(`SELECT profilePicture FROM users WHERE username = "${ctx.session.user}";`)
	console.log(record)
	await db.close()

	data.picDir = `ProfilePictures/${  record.profilePicture  }.png`
	await ctx.render('profilePic', data)
})

router.post('/uploadProfilePic', koaBody, async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		const body = ctx.request.body
		console.log(body)
		// process the file
		const { path, type } = ctx.request.files.profilePicture

		user = await new User(dbName)
		await user.updateProfilePic(ctx.session.user, path, type)

		// redirect to account page
		ctx.redirect('/account?successMsg=profile picture updated')
	} catch (err) {
		return ctx.redirect(`/uploadProfilePic?errorMsg=${err.message}`)
	} finally {
		user.tearDown()
	}
})

router.get('/sell', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const data = {}
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('sell', data)
})

router.post('/uploadItem', koaBody, async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		const body = ctx.request.body
		console.log(body)
		console.log(ctx.session.user)
		account = await new Account(dbName)
		await account.uploadItem(ctx.request.files.image, ctx.session.user, body.item, body.year, body.price, body.artist, body.medium, body.size, body.sDescription, body.lDescription)

		// redirect to my items page
		ctx.redirect('/myItems?successMsg=item uploaded successfully')
	} catch (err) {
		return ctx.redirect(`/sell?errorMsg=${err.message}`)
	} finally {
		account.tearDown()
	}
})

router.get('/edit/:id', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	// Check for validation messages
	const db = await Database.open(dbName)
	const data = {}
	const record = await db.get(`SELECT * FROM items WHERE itemID = "${ctx.params.id}";`)
	if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
	if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
	data.authorised = ctx.session.authorised
	await ctx.render('edit', {data: data, record: record})
})

router.post('/edit/:id', koaBody, async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		const body = ctx.request.body
		const db = await Database.open(dbName)
		await db.run(`UPDATE items SET item = "${body.item}", year = "${body.year}", price = "${body.price}", artist = "${body.artist}", medium = "${body.medium}", size = "${body.size}", sDescription = "${body.sDescription}", lDescription = "${body.lDescription}" WHERE itemID = "${ctx.params.id}";`)
		// redirect to my items page
		ctx.redirect('/myItems?successMsg=information changed successfully')
	} catch (err) {
		return ctx.redirect(`/edit/:id?errorMsg=${err.message}`)
	} finally {
	}
})

router.get('/myItems', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		const db = await Database.open(dbName)
		// get the userID from the db
		const data = {}
		const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
		const items = await db.all(`SELECT * FROM items WHERE userID = "${record.userID}";`)
		const f_items = await db.all(`SELECT * FROM fav LEFT JOIN items ON items.itemID = fav.itemID WHERE fav.userID = "${record.userID}";`)
		data.authorised = ctx.session.authorised
		if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		await ctx.render('myItems', { items: items, data: data, f_items: f_items })
	} catch (err) {
		console.error(err.message)
		await ctx.render('error', { message: err.message })
	}
})

router.get('/:id', async ctx => {
	try {
		// Check if the user is logged in - or send them back to the login page
		console.log(ctx.session.authorised)
		if(ctx.session.authorised !== true) 
      return ctx.redirect('/login?errorMsg=you are not logged in')
    //Get data about the item from the db
		const db = await Database.open(dbName)
		const data = {}
		const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
		// check if the item exists
		if(record === undefined) throw new Error('unrecogised item')
    const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
    console.log(record.userID, ctx.params.id)
    const userRecords = await db.get(`SELECT count(userID) AS count FROM users WHERE username="${ctx.session.user}";`)
    if(!userRecords.count) 
      throw new Error('User doesnt exist')
    const userRecord = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
    const favRecord = await db.get(`SELECT count(itemID) AS count FROM fav WHERE userID="${userRecord.userID}" AND itemID="${ctx.params.id}" AND favourite="true";`)
	let favCount = await db.get(`SELECT count(itemID) AS count FROM fav WHERE itemID = "${ctx.params.id}";`)
	favCount = favCount['count']
	data.favourited = false
    if(favRecord.count) 
      data.favourited = true
		// set the data - item info + user info
		record.username = itemUser.username
		if(ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if(ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		data.authorised = ctx.session.authorised
		await ctx.render('itemDetails', {record: record, data: data, favCount : favCount})
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})
router.get('/:id/add-to-basket', async ctx => {
	try {
		// Check if the user is logged in - or send them back to the login page
		console.log(ctx.session.authorised)
		if(ctx.session.authorised !== true)
			return ctx.redirect('/login?errorMsg=you are not logged in')
		const db = await Database.open(dbName)
    const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
    // check if the item exists
		if(record === undefined) throw new Error('unrecognised item')
		// check if the item is for sale
		if(record.status === false) 
      return ctx.redirect(`/${ctx.params.id}?errorMsg=Item not for sale`)
    // Check that buyer and seller are not the same person
		const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
		if (itemUser.username === ctx.session.user)
			return ctx.redirect(`/${ctx.params.id}?errorMsg=Seller cannot buy their own item`)
		const user = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
    const basketLength = await db.get(`SELECT COUNT(*) FROM basket WHERE userID = "${user.userID}" AND itemID = "${ctx.params.id}";`)
    // Check if item is already in this user's basket
		if(basketLength['COUNT(*)'] > 0){
			return ctx.redirect(`/${ctx.params.id}?errorMsg=Item already in your basket`)
    }
    //Add to users basket
		await db.run(`INSERT INTO basket(userID, itemID) VALUES("${user.userID}", "${ctx.params.id}")`)
		ctx.redirect(`/${record.itemID}`)
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})
router.get('/buy/:id', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
	// Check if the user is logged in - or send them back to the login page
	console.log(ctx.session.authorised)
	if(ctx.session.authorised !== true) 
		return ctx.redirect('/login?errorMsg=you are not logged in')
  // check if the item exists
	if(record === undefined) throw new Error('unrecognised item')
	// check if the item is for sale
	if(record.status === false) 
    return ctx.redirect(`/${ctx.params.id}?errorMsg=Item not for sale`)
  // Check that buyer and seller are not the same person
	const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
	if (itemUser.username === ctx.session.user) 
		return ctx.redirect(`/${ctx.params.id}?errorMsg=Seller cannot buy their own item`)
	const user = await db.get(`SELECT * FROM users WHERE username = "${ctx.session.user}";`)
  const basketLength = await db.get(`SELECT COUNT(*) FROM basket WHERE userID = "${user.userID}" AND itemID = "${ctx.params.id}";`)
  //Empty user's basket and add this item to it
	await db.run(`DELETE FROM basket WHERE userID="${user.userID}";`)
	await db.run(`INSERT INTO basket(userID, itemID) VALUES("${user.userID}", "${ctx.params.id}")`)
	ctx.redirect(`/basket`)
} catch(err) {
	console.error(err.message)
	await ctx.render('error', {message: err.message})
}
})

router.get('/contactSeller/:id', async ctx => {
	try {
		// Check if the user is logged in - or send them back to the login page
		console.log(ctx.session.authorised)
		if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
		const db = await Database.open(dbName)
		console.log(`item id: ${ctx.params.id}`)
		const data = {}
		const record = await db.get(`SELECT * FROM items WHERE itemID = ${ctx.params.id};`)
		// check if the item exists
		if (record === undefined) throw new Error('unrecogised item')
		const itemUser = await db.get(`SELECT * FROM users WHERE userID = ${record.userID};`)
		// set the data - item info + user info

		if (ctx.query.errorMsg) data.errorMsg = ctx.query.errorMsg
		if (ctx.query.successMsg) data.successMsg = ctx.query.successMsg
		data.authorised = ctx.session.authorised
		await ctx.render('contactSeller', { item: record, seller: itemUser, data: data })
	} catch (err) {
		console.error(err.message)
		await ctx.render('error', { message: err.message })
	}
})

router.post('/email', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
		const body = ctx.request.body

		account = await new Account(dbName)
		await account.email(body.itemID, ctx.session.user, body.message)

		return ctx.redirect(`/${body.itemID}?successMsg=Message Sent...`)
	} catch (err) {
		console.log(err.message)
		await ctx.render('error', { message: err.message })
	}
})

router.post('/search', async ctx => {
	try {
		const body = ctx.request.body
		const db = await Database.open(dbName)
		const data = {}
		// Check if there is a search result
		const records = await db.get(`SELECT count(itemID) AS count FROM items WHERE item LIKE "%${body.search}%";`)
		// no search result - go back
		if (!records.count) {
 return ctx.redirect('/?errorMsg=No items found.') 
}

		// run the query and render the index page
		const item = await db.all(`SELECT * FROM items WHERE item LIKE '%${body.search}%';`)

		await db.close()
		await ctx.render('index', { items: item, data: data })
	} catch (err) {
		console.error(err.message)
		await ctx.render('error', { message: err.message })
	}
})

router.get('/favourite/:id', async ctx => {
	if (ctx.session.authorised !== true) {
 return ctx.redirect('/login?errorMsg=you are not logged in') 
}
	try {
    const db = await Database.open(dbName)
    const records = await db.get(`SELECT count(userID) AS count FROM users WHERE username="${ctx.session.user}";`)
    if(!records.count) 
      throw new Error('User doesnt exist')
    const record = await db.get(`SELECT userID FROM users WHERE username = "${ctx.session.user}";`)
    const favRecord = await db.get(`SELECT count(itemID) AS count FROM fav WHERE userID="${record.userID}" AND itemID="${ctx.params.id}";`)
    let msg = 'Added to favourites'
    if(favRecord.count)
    { 
      const favouriteRecord = await db.get(`SELECT * FROM fav WHERE userID="${record.userID}" AND itemID="${ctx.params.id}";`)
      let fav = true
      if(favouriteRecord.favourite == "true")
      {
        fav = false
        msg = 'Removed from favourites'
      }  
      await db.run(`DELETE FROM fav WHERE userID="${record.userID}" AND itemID="${ctx.params.id}"; `)
    }
    else
    {
      await db.run(`INSERT INTO fav(userID, itemID, favourite) VALUES("${record.userID}", "${ctx.params.id}", "true")`)
    }
		
		ctx.redirect(`/${ctx.params.id}?successMsg=${msg}`)
	} catch(err) {
		console.error(err.message)
		await ctx.render('error', {message: err.message})
	}
})

module.exports = app.listen(port, async() => {
	// create the db if it doesnt exist - for users running first time
	const db = await Database.open(dbName)
	await db.run('CREATE TABLE IF NOT EXISTS users (userID INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, profilePicture TEXT, paypalUsername TEXT, emailAddress TEXT);')
	await db.run('CREATE TABLE IF NOT EXISTS items (itemID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, item TEXT, year INTEGER, price TEXT, artist TEXT, medium TEXT, size TEXT, sDescription TEXT, lDescription TEXT, imageDir1 TEXT, imageDir2 TEXT, imageDir3 TEXT, status BOOLEAN);')
  await db.run('CREATE TABLE IF NOT EXISTS basket (userID INTEGER, itemID INTEGER, CONSTRAINT userID FOREIGN KEY (userID) REFERENCES users(userID),  CONSTRAINT itemID FOREIGN KEY (itemID) REFERENCES items(itemID));')
  await db.run('CREATE TABLE IF NOT EXISTS fav (userID INTEGER, itemID INTEGER, favourite BOOLEAN, CONSTRAINT userID FOREIGN KEY (userID) REFERENCES users(userID),  CONSTRAINT itemID FOREIGN KEY (itemID) REFERENCES items(itemID));')
	await db.close()
	console.log(`listening on port ${port}`)
})
