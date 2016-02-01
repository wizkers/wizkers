/** (c) 2015 Edouard Lafargue, ed@lafargue.name
 *
 * This file is part of Wizkers.
 *
 * Wizkers is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Wizkers is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Wizkers.  If not, see <http://www.gnu.org/licenses/>.
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
