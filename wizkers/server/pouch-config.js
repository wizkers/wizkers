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

/**
 * Where we are storing our database configuration and schemas. All DB operations
 * should go through this.
 */


var PouchDB = require('pouchdb');
var bcrypt = require('bcrypt-nodejs');
var debug = require('debug')('wizkers:pouchdb');

// PouchDB.plugin(require('pouchdb-find'));

/**
 * Top level configuration: we can decide to either use local PouchDB
 * over LevelDB databases - good for small or embedded instances
 * or use a real CouchDB backend which will scale up to lots of data/sensors
 */

var backend = 'PouchDB';

var instrumentsDB = './ldb/instruments',
    outputsDB = './ldb/outputs',
    settingsDB = './ldb/settings',
    usersDB = './ldb/users',
    logsDB = './ldb/logs',
    datapointsDB = './ldb/datapoints/';

if (backend == 'CouchDB') {

    instrumentsDB = 'http://localhost:5984/wiz_instruments';
    outputsDB = 'http://localhost:5984/wiz_outputs';
    settingsDB = 'http://localhost:5984/wiz_settings';
    usersDB = 'http://localhost:5984/wiz_users';
    logsDB = 'http://localhost:5984/wiz_logs';
    datapointsDB = 'http://localhost:5984/wiz_datapoints_';
}


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
var instruments = new PouchDB(instrumentsDB, {
    // auto_compaction: true
});
var outputs = new PouchDB(outputsDB, {
    auto_compaction: true
});
var settings = new PouchDB(settingsDB, {
    auto_compaction: true
});
var users = new PouchDB(usersDB, {
    auto_compaction: true
});
var logs = new PouchDB(logsDB, {
    auto_compaction: true
});

// Create the design docs we need for our various databases in order to get
// decent performance on large datasets:

/**
 * View of logs by instrument ID
 */
var logByInstrument = {
    _id: '_design/log_queries',
    views: {
        'by_instrument': {
            map: function (doc) {
                emit(doc.instrumentid);
            }.toString()
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
 * Create recording datapoint databases
 */
var createDataPointDB = function(logid) {
    // Note: CouchDB only wants lowercase in their databases, so we need to make sure the
    // logid is in lowercase.
    return new PouchDB(datapointsDB + logid.toLowerCase());
}


/**
 * Defaults: we use this to initialize new documents in our Pouch
 * databases.
 */
var defaults = function (role) {
    switch (role) {
    case 'settings':
        return {
            _id: 'coresettings',
            serialPort: '',
            timezone: '',
            cpmcolor: 0,
            cpmscale: 'linear',
            itemsperpage: 4,
            currentInstrument: null,
            currentUserRole: 'pending',
            token: '', // The current authorization token for socket.io
            showstream: false, // Show debug output
        }
    case 'user':
        return {
            local: {
                email: '',
                password: ''
            },
            google: {
                id: '',
                token: '',
                email: '',
                name: ''
            },
            facebook: {
                id: '',
                token: '',
                email: '',
                name: ''
            },
            role: 'pending' // Should be "pending", "viewer", "operator" or "admin"
        };
        break;
    case instrument:
        return {
            name: '', // Used for display
            type: '', // Will correspond to parsers known on the server side
            tag: '', // Asset tag for the instrument (if supported)
            uuid: '', // Serial number or unique ID (if supported)
            port: '', // Name of the port on server side
            comment: '', // Simple comments
            icon: '', // TbD: either user-selectable, or served by server-side (linked to type)
            liveviewspan: '', // Width of live view in seconds
            liveviewperiod: '', // Period of polling if supported
            liveviewlogscale: false, // Should live view display as a log scale by default ?
            autoconnect: false,
            metadata: null, // Depending on instrument type, this metadata can include additional settings
        };
        break;
    default:
        return {};
    }
};

/**
 * A utils object to make transition easier while I figure out
 * a cleaner API
 */

var utils = {
    users: {
        generateHash: function (password) {
            return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
        },
        validPassword: function (pw1, pw2) {
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
    utils: utils,
    createDataPointDB: createDataPointDB
}
