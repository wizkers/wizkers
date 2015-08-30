/**
 * (c) 2015 Edouard Lafargue, ed@lafargue.name
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

/**
 * Where we are storing our database configuration and schemas.
 */


var PouchDB = require('pouchdb');
var bcrypt = require('bcrypt-nodejs');
var debug = require('debug')('pouchdb');


debug("Requiring pouch-config.js");
// Databases we have on our system:

// Instrument
// Output
// Settings
// Log Entry
// Log
// User

// auto_compaction is important because we update the documents often,
// and P/CouchDB keeps previous revisions otherwise. This option is only
// effective for local DBs, not remote (CouchDB manages that on its own).
var instruments = new PouchDB('./ldb/instruments', {auto_compaction: true});
var outputs = new PouchDB('./ldb/outputs', {auto_compaction: true});
var settings = new PouchDB('./ldb/settings', {auto_compaction: true});
var users = new PouchDB('./ldb/users', {auto_compaction: true});
var logs = new PouchDB('./ldb/logs', {auto_compaction: true});

// Create the design docs we need for our various databases in order to get
// decent performance on large datasets:

/**
 * View of logs by instrument ID
 */
var logByInstrument = {
  _id: '_design/by_instrument',
  views: {
    'by_instrument': {
      map: function (doc) { emit(doc.instrumentid); }.toString()
    }
  }
};
// save it
logs.put(logByInstrument).then(function () {
  // success!
    debug("Created Instruments DB 'by instrument' view");
}).catch(function (err) {
    debug("Error creating design doc: " + err);
    if (err.status == 409)
        debug("... but that's OK, it was there already");
});




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
        autoconnect: false,
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
