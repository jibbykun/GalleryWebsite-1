
'use strict'

const User = require('../modules/user.js')
const Account = require('../modules/account.js')

describe('register()', () => {

	test('register a valid account', async done => {
		expect.assertions(1)
		const user = await new User()
		const register = await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		expect(register).toBe(true)
		done()
	})

	test('register a duplicate username', async done => {
		expect.assertions(1)
		const user = await new User()
		const register = await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		await expect( user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com') )
			.rejects.toEqual( Error('Username taken. Please try again.') )
		done()
	})

	test('error if blank username', async done => {
		expect.assertions(1)
		const user = await new User()
		await expect( user.register('', 'password') )
			.rejects.toEqual( Error('missing username') )
		done()
	})

	test('error if blank password', async done => {
		expect.assertions(1)
		const user = await new User()
		await expect( user.register('doej', '') )
			.rejects.toEqual( Error('missing password') )
		done()
	})

})

describe('uploadPicture()', () => {
	// this would have to be done by mocking the file system
	// perhaps using mock-fs?
})

describe('login()', () => {
	test('log in with valid credentials', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('doej', 'password')
		const valid = await user.login('doej', 'password')
		expect(valid).toBe(true)
		done()
	})

	test('invalid username', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('doej', 'password')
		await expect( user.login('roej', 'password') )
			.rejects.toEqual( Error('username "roej" not found') )
		done()
	})

	test('invalid password', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('doej', 'password')
		await expect( user.login('doej', 'bad') )
			.rejects.toEqual( Error('invalid password for account "doej"') )
		done()
	})

})
