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