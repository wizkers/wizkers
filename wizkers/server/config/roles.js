/**
 * This file is part of Wizkers.io
 *
 * The MIT License (MIT)
 *  Copyright (c) 2016 Edouard Lafargue, ed@wizkers.io
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the Software
 * is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
 * WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR
 * IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

// config/roles.js
//
// Where we are configuring our connect-roles middleware, so that
// we are not mixing it inside our server.js
//

// load the modules we need
var ConnectRoles   = require('connect-roles');

// expose this function to our app using module.exports
module.exports = function(roles) {

    // Anonymous users should be redirected to the login page
    //roles.use(


    // 'pending' cannot see anything but their /profile page
    roles.use('pending', function(req) {
        if (req.user.role === 'pending') {
            return true;
        }
    });

    // 'viewer' is read-only.
    roles.use('viewer', function(req) {
        if (req.user.role === 'viewer') {
            return true;
        }
    });

    // Operator is read/write (admin is an operator)
    roles.use('operator', function(req) {
        if (req.user.role === 'operator' ||
            req.user.role === 'admin' ) {
            return true;
        }
    });

    roles.use('admin', function(req) {
        if (req.user.role === 'admin') {
            return true;
        }
    });

};
