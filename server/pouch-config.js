/**
 * Where we are storing our database configuration and schemas.
 *
 * (c) 2013 Edouard Lafargue, edouard@lafargue.name
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


var PouchDB = require('pouchdb');
var bcrypt = require('bcrypt-nodejs');


// Databases we have on our system:

// Instrument
// Output
// Settings
// Log Entry
// Log
// User

var instruments = new PouchDB('./ldb/instruments');
var outputs = new PouchDB('./ldb/outputs');
var settings = new PouchDB('./ldb/settings');
var users = new PouchDB('./ldb/users');
var logs = new PouchDB('./ldb/logs');

// Create the design docs we need for our various databases




/**
 * Defaults: we use this to initialize new documents in our Pouch
 * databases.
 */
var defaults = {
    settings: {
        serialPort: '',
        timezone: '',
        cpmcolor: 0,
        cpmscale: 'linear',
        itemsperpage: 4,
        currentInstrument: null,
        currentUserRole: 'pending',
        token: '', // The current authorization token for socket.io
        showstream: false, // Show debug output
    },
    
    user: {
        local: {
            email: '',
            password: ''
        },
        google     : {
            id     : '',
            token  : '',
            email  : '',
            name   : ''
        },
        facebook   : {
            id     : '',
            token  : '',
            email  : '',
            name   : ''
        },

        role: 'pending'  // Should be "pending", "viewer", "operator" or "admin"
    },
    
    instrument: {
        name: '',           // Used for display
        type: '',           // Will correspond to parsers known on the server side
        tag: '',            // Asset tag for the instrument (if supported)
        uuid: '',           // Serial number or unique ID (if supported)
        port: '',           // Name of the port on server side
        comment: '',        // Simple comments
        icon: '',           // TbD: either user-selectable, or served by server-side (linked to type)
        liveviewspan: '',                 // Width of live view in seconds
        liveviewperiod: '',                 // Period of polling if supported
        liveviewlogscale: false,                // Should live view display as a log scale by default ?
        metadata: null, // Depending on instrument type, this metadata can include additional settings
    }
};

/**
 * A utils object to make transition easier while I figure out
 * a cleaner API
 */

var utils = {
    users: {
        generateHash: function(password) {
                return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
        },
        validPassword: function(pw1, pw2) {
            return bcrypt.compareSync(pw1, pw2);
        }
    }
};



module.exports = {
    instruments: instruments,
    outputs: outputs,
    settings: settings,
    users: users,
    logs: logs,
    
    defaults: defaults,
    utils: utils
}
