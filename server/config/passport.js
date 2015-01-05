/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
 */

// config/passport.js
//
// This configures our authentication layer - currently only local auth.
//
//  One important thing here: this is where we implement the connection to our backend
//   persistency layer (mongoDB).
//
// Some code originating from http://scotch.io/tutorials/javascript/easy-node-authentication-setup-and-local

// load all the things we need
var LocalStrategy   = require('passport-local').Strategy,
    dbs = require('../pouch-config'),
    debug = require('debug')('wizkers:auth');


// expose this function to our app using module.exports
module.exports = function(passport) {

    // =========================================================================
    // passport session setup ==================================================
    // =========================================================================
    // required for persistent login sessions
    // passport needs ability to serialize and unserialize users out of session

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        done(null, user._id);
    });

    // used to deserialize the user
    passport.deserializeUser(function(id, done) {
        dbs.users.get(id, function(err, user) {
            done(err, user);
        });
    });

 	// =========================================================================
    // LOCAL SIGNUP ============================================================
    // =========================================================================
    // we are using named strategies since we have one for login and one for signup
	// by default, if there was no name, it would just be called 'local'

    passport.use('local-signup', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) {

        // asynchronous
        // User.findOne wont fire unless data is sent back
        process.nextTick(function() {

		// find a user whose email is the same as the forms email
		// we are checking to see if the user trying to login already exists
        dbs.users.get(email, function(err, result) {
            // If we don't get a 404 error, this means the username is not available
            // check to see if theres already a user with that email
            if (!err || err.status != 404) {
                return done(null, false, req.flash('signupMessage', 'That email is already registered.'));
            } else {

				// if there is no user with that email
                // create the user
                var newUser = dbs.defaults.user;

                // set the user's local credentials
                newUser._id = email;
                newUser.local.email    = email;
                newUser.local.password = dbs.utils.users.generateHash(password);

				// save the user
                dbs.users.put(newUser,function(err, result) {
                    if (err)
                        return err;
                    debug(result)
                    // And Get the user back for serialization:
                    dbs.users.get(result.id, function(err, user) {
                        debug("New user created");
                        debug(user);
                        return done(null, user);
                    });
                });
            }

        });    

        });

    }));
    
    // =========================================================================
    // LOCAL LOGIN =============================================================
    // =========================================================================
	// we are using named strategies since we have one for login and one for signup
	// by default, if there was no name, it would just be called 'local'

    passport.use('local-login', new LocalStrategy({
        // by default, local strategy uses username and password, we will override with email
        usernameField : 'email',
        passwordField : 'password',
        passReqToCallback : true // allows us to pass back the entire request to the callback
    },
    function(req, email, password, done) { // callback with email and password from our form
		// find a user whose email is the same as the forms email
		// we are checking to see if the user trying to login already exists
        dbs.users.get(email, function(err, user) {
            // if there are any errors, return the error before anything 
            // if no user is found, return the message
            if (err && err.status == 404 )
                return done(null, false, req.flash('loginMessage', 'Username or password incorrect.'));
                // req.flash is the way to set flashdata using connect-flash
            
            debug(user);
            
            // if the user is found but the password is wrong
            if (!dbs.utils.users.validPassword(password, user.local.password))
                return done(null, false, req.flash('loginMessage', 'Username or password incorrect.'));
                // create the loginMessage and save it to session as flashdata

            // If the user is an admin, and the password is "admin", then
            // complain loudly
           if (user.role == 'admin' && dbs.utils.users.validPassword('admin', user.local.password))
                return done(null, user, req.flash('warningMessage', 'Your admin password is the default password, "admin". Please change this to something more secure! Most features will be disabled until your change your password, log out and log back in again.'));
 
            // all is well, return successful user
            return done(null, user);
        });

    }));


};
