
'use strict'

const Account = require('../modules/account.js')
const User = require('../modules/user.js')
const emailValidation = require('../modules/validEmail.js') 

/*
 describe('uploaditem()', () => {
 	test('valid account', async done => {
 		expect.assertions(0)
 		const user = await new User()
 		const account = await new Account()
 		await user.register('Testing', 'Supertester123', 'Supertester123', 'Tester', 'test@hotmail.com')
 		const upload = await account.uploadItem('', 'Testing', 'item', 'year', 'price', 'artist', 'medium', 'size', 'sDescription', 'lDescription')
 		expect(upload).toBe(true)
 		done()
 	});
 });
*/

describe('email()', () => {
	test('invalid email format', async done => {
		expect.assertions(1)
        const user = await new User()
        const account = await new Account()
        await expect ( account.changeEmail('test@hotmail', 'tester') )
		    .rejects.toEqual( Error('Please enter your new email address in the correct format') )
		done()
    });
    test('valid email format', async done => {
		expect.assertions(1)
        const user = await new User()
        const account = await new Account()
        const validemail = await (account.changeEmail('test@hotmail.com', 'tester') )
		expect(validemail).toBe(true)
		done()
    });
})
