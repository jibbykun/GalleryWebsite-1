
'use strict'

const bcrypt = require('bcrypt-promise')
const fs = require('fs-extra')
const mime = require('mime-types')
const sqlite = require('sqlite-async')
const saltRounds = 10

module.exports = class User {

	constructor(dbName = ':memory:') {
		return (async() => {
			this.db = await sqlite.open(dbName)
			// we need this table to store the user accounts
			await this.db.run('CREATE TABLE IF NOT EXISTS users (userID INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT, password TEXT, profilePicture TEXT, paypalUsername TEXT, emailAddress TEXT);')
			await this.db.run('CREATE TABLE IF NOT EXISTS items (itemID INTEGER PRIMARY KEY AUTOINCREMENT, userID INTEGER, item TEXT, year INTEGER, price TEXT, artist TEXT, medium TEXT, size TEXT, sDescription TEXT, lDescription TEXT, imageDir1 TEXT, imageDir2 TEXT, imageDir3 TEXT, status BOOLEAN);')
			return this
		})()
	}

	async register(username, password, passwordRepeat, paypalUsername, emailAddress) {
		try {
			// check if the password is at least 10 characters long
			if (password.length < 10)
				throw new Error('Password must be at least 10 characters')
			// check if the password contains an uppercase character
			if (!/[A-Z]/.test(password))
				throw new Error('Password must contain at least one uppercase character')
			// check if the password contains a number
			if (!/\d/.test(password))
				throw new Error('Password must contain at least one number')
			// check if the passwords match
			if (password != passwordRepeat)
				throw new Error('Passwords do not match')
			// Check if a user already exists with the same username
			const records = await this.db.get(`SELECT count(userID) AS count FROM users WHERE username="${username}";`)
			if(records.count) 
				throw new Error('Username taken. Please try again.')
			// encrypt the password
			password = await bcrypt.hash(password, saltRounds)
			// insert the user into the db - success!
			const sql = `INSERT INTO users(username, password, profilePicture, paypalUsername, emailAddress) 
			VALUES("${username}", "${password}", "pic_${username}", "${paypalUsername}", "${emailAddress}");`
			console.log(sql)
			await this.db.run(sql)
			return true
		} catch(err) {
			throw err
		}
	}

	async login(username, password) {
		try {
			// check if the user exists
			const records = await this.db.get(`SELECT count(userID) AS count FROM users WHERE username="${username}";`)
			if(!records.count) 
				throw new Error('User doesnt exist')
			const record = await this.db.get(`SELECT password FROM users WHERE username = "${username}";`)
			// check login credentials
			const valid = await bcrypt.compare(password, record.password)
			if(valid == false)
				throw new Error('Incorrect password')
			return true
		} catch(err) {
			throw err
		}
	}

	async updateProfilePic(user, path, type) {
		try {
			const fileExtension = mime.extension(type)
			console.log(`path: ${path}`)
			console.log(`type: ${type}`)
			console.log(`fileExtension: ${fileExtension}`)
			//set the file directory dynamically to the user
			// get the directory from the db
			const record = await this.db.get(`SELECT profilePicture FROM users WHERE username = "${user}";`)
			console.log(record)
			const fileDir = 'public/ProfilePictures/' + record.profilePicture + '.png'
			await fs.copy(path, fileDir)
			return true
		} catch(err) {
			throw err
		}
	}




	async tearDown() {
		await this.db.close()
	}
}
