
'use strict'

const User = require('../modules/user.js')

describe('register()', () => {
	test('valid account', async done => {
		expect.assertions(1)
		const user = await new User()
		const register = await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		expect(register).toBe(true)
		done()
	});
	test('duplicate username', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		await expect( user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com') )
			.rejects.toEqual( Error('Username taken. Please try again.') )
		done()
	});
	test('password too short', async done => {
		expect.assertions(1)
		const user = await new User()
		await expect( user.register('Testing', 'Super', 'Super', 'Tester', 'test@hotmail.com') )
			.rejects.toEqual( Error('Password must be at least 10 characters') )
		done()
	});

	test('password no number', async done => {
		expect.assertions(1)
		const user = await new User()
		await expect( user.register('Testing', 'Supertester', 'Supertester', 'Tester', 'test@hotmail.com') )
			.rejects.toEqual( Error('Password must contain at least one number') )
		done()
	});
	test('passwords do not match', async done => {
		expect.assertions(1)
		const user = await new User()
		await expect( user.register('Testing', 'Supertester123', 'Supertester', 'Tester', 'test@hotmail.com') )
			.rejects.toEqual( Error('Passwords do not match') )
		done()
	});
});

describe('login()', () => {
	test('valid login', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		const login = await user.login('Testing', 'Supertester123')
		expect(login).toBe(true)
		done()
	});
	test('incorrect username', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		await expect( user.login('Testing1', 'Supertester123') )
			.rejects.toEqual( Error('User doesnt exist') )
		done()
	});
	test('correct username wrong password', async done => {
		expect.assertions(1)
		const user = await new User()
		await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
		await expect( user.login('Testing', 'Supertester1234') )
			.rejects.toEqual( Error('Incorrect password') )
		done()
	});
});

//describe('updateProfilePic()', () => {
	//mock-fs
//});

