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
 * Where we are storing our database configuration and schemas. All DB operations
 * should go through this.
 */


var PouchDB = require('pouchdb');
var bcrypt = require('bcrypt-nodejs');
var debug = require('debug')('pouchdb');


/**
 * Top level configuration: we can decide to either use local PouchDB
 * over LevelDB databases - good for small or embedded instances
 * or use a real CouchDB backend which will scale up to lots of data/sensors
 */

var backend = 'PouchDB';

var instrumentsDB = '../ldb/instruments',
    outputsDB = '../ldb/outputs',
    settingsDB = '../ldb/settings',
    usersDB = '../ldb/users',
    logsDB = '../ldb/logs',
    datapointsDB = '../ldb/datapoints/';


cinstrumentsDB = 'http://localhost:5984/wiz_instruments';
coutputsDB = 'http://localhost:5984/wiz_outputs';
csettingsDB = 'http://localhost:5984/wiz_settings';
cusersDB = 'http://localhost:5984/wiz_users';
clogsDB = 'http://localhost:5984/wiz_logs';
cdatapointsDB = 'http://localhost:5984/wiz_datapoints_';

// auto_compaction is important because we update the documents often,
// and P/CouchDB keeps previous revisions otherwise. This option is only
// effective for local DBs, not remote (CouchDB manages that on its own).
var instruments = new PouchDB(instrumentsDB);
var outputs = new PouchDB(outputsDB);
var settings = new PouchDB(settingsDB);
var users = new PouchDB(usersDB);
var logs = new PouchDB(logsDB);


instruments.replicate.to(cinstrumentsDB).on('complete', function () {
    console.log('Instruments DB replicated');
}).on('error', function (err) {
    console.log('Instruments DB replication error -' + err);
});

outputs.replicate.to(coutputsDB).on('complete', function () {
    console.log('Outputs DB replicated');
}).on('error', function (err) {
    console.log('Outputs DB replication error -' + err);
});

settings.replicate.to(csettingsDB).on('complete', function () {
    console.log('Settings DB replicated');
}).on('error', function (err) {
    console.log('Settings DB replication error -' + err);
});

users.replicate.to(cusersDB).on('complete', function () {
    console.log('Users DB replicated');
}).on('error', function (err) {
    console.log('Users DB replication error -' + err);
});

logs.replicate.to(clogsDB).on('complete', function () {
    console.log('Logs DB replicated');
}).on('error', function (err) {
    console.log('Logs DB replication error -' + err);
});



// Migrate all the logs as well
// Thiis does everything at once, since it's all async...
logs.allDocs({}, function (err, items) {
    for (item in items.rows) {
        var id = items.rows[item].id;
        if (id.indexOf('_design') < 0) {
            var dp = new PouchDB(datapointsDB + id);
            dp.replicate.to(cdatapointsDB + id.toLowerCase()).on('complete', function () {
                console.log('Datapoint DB replicated');
            }).on('error', function (err) {
                console.log('Datapint DB replication error -' + err);
            });
        }

    }
});