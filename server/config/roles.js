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
    
    // 'viewer' can only see home page
    roles.use('viewer', function(req) {
        if (req.user.role === 'viewer') {
            return true;
        }
    });
    
    roles.use('operator', function(req) {
        if (req.user.role === 'operator') {
            return true;
        }
    });
    
    roles.use('admin', function(req) {
        if (req.user.role === 'admin') {
            return true;
        }
    });
    
};
