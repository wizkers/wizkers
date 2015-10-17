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
 * Where we define the device log data
 * @author Edouard Lafargue, ed@lafargue.name
 *
 * This model uses indexeddb in Chrome mode, because localstorage cannot
 * cope with large amounts of data - nor is it designed for that purpose
 */


define(function (require) {

    "use strict";

    var $ = require('jquery'),
        PouchDB = require('pouchdb'),
        Backbone = require('backbone');

    // Defines BackbonePouch (someone said 'ugly' ?)
    require('backbonepouch');

    var bidb = null;

    if (vizapp.type == "chrome") {
        require(['bbindexeddb'], function (bb) {
            bidb = bb;
        });
    }

    var logs_database = {
        id: "wizkers-logs",
        description: "Wizkers device logs",
        nolog: true,
        migrations: [{
            version: 1,
            migrate: function (transaction, next) {
                var store = transaction.db.createObjectStore("logs");
                store.createIndex("iidIndex", "instrumentid", {
                    unique: false
                });
                store = transaction.db.createObjectStore("entries");
                store.createIndex("lsiIndex", "logsessionid", {
                    unique: false
                });
                next();
            }
        }]
    };


    var LogEntry = Backbone.Model.extend({

            idAttribute: "_id",

            initialize: function () {
                // If we run as a chrome app, the backbone indexeddb adapter also
                // wants models to have the proper database and store properties defined
                if (vizapp.type == "chrome") {
                    this.database = logs_database;
                    this.storeName = "entries";
                }

                // Separate by database for performance reasons on mobile (avoid a
                // mapreduce query, each log has it own database, massive difference).
                if (vizapp.type == 'cordova') {
                    this.sync = BackbonePouch.sync({
                        db: new PouchDB('logentries-' + this.get('logsessionid'), {
                            adapter: 'websql'
                        })
                    });
                }
            },

            defaults: {
                logsessionid: 0, // Should match the ID of a log model (see below)
                timestamp: 0, // Javascript timestamp for that entry (milliseconds since 1970)
                comment: "", // We will one day support commenting any data point in a log...
                data: null // Will be an object that depends on the device type
            }

        }),

        /**
         * A collection of log entries that go together because
         * they all have the same logsessionid
         */
        LogEntries = Backbone.Collection.extend({

            logsessionid: null,

            initialize: function (models, options) {

                if (vizapp.type == 'chrome') {
                    this.database = logs_database;
                    this.storeName = 'entries';
                }
                if (vizapp.type == 'cordova') {
                    var self = this;

                    // The PouchDB query bundles the results in the 'rows' key,
                    // so return the content of this key, rather that "results"
                    this.parse = function (result) {
                        return _.pluck(result.rows, 'doc');
                    }
                }
            },

            // url: is not defined by default, LogEntries is
            // nested inside of Log

            idAttribute: '_id',
            model: LogEntry,

            // Maintain our collection in order automatically by adding a comparator:
            comparator: 'timestamp',

            // We override the fetch method so that in indexeddb mode, we add a query condition
            // on the fetch - in server mode, that condition is part of the REST API and executed
            // on the server.
            fetch: function (callback) {
                console.log('[devicelogs.js] Should fetch all entries for logsessionid ' + this.logsessionid);
                // Add a condition for the instrumentid
                if (vizapp.type == 'chrome')
                    callback.conditions = {
                        logsessionid: this.logsessionid
                    };
                Backbone.Collection.prototype.fetch.call(this, callback);
            },

            // Get all points between date X1 and date X2 (both don't have to exactly match a
            // log record).
            getDateInterval: function (x1, x2) {
                var extract = this.filter(function (logEntry) {
                    return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
                });
                return new LogEntries(extract); // Return as a new collection, this way we can chain calls
            },

            // Our collection is sorted, it makes our life easier:
            getLogStart: function () {
                if (this.length) {
                    return this.at(0).get('timestamp');
                } else {
                    return 0;
                }
            },

            getLogEnd: function () {
                if (this.length) {
                    return this.at(this.length - 1).get('timestamp');
                } else {
                    return 0;
                }
            },
        }),

        // A log session references a series of log entries for one device.
        Log = Backbone.Model.extend({

            idAttribute: '_id',

            initialize: function () {
                var self = this;

                // If we run as a chrome app, the backbone indexeddb adapter also
                // wants models to have the proper database and store properties defined
                if (vizapp.type == 'chrome') {
                    this.database = logs_database;
                    this.storeName = 'logs';
                }

                // A log contains... entries (surprising, eh?). Nest
                // the collection here:
                this.entries = new LogEntries();
                this.updateEntriesURL();

                // Watch our entries so that we can update the datapoints entry
                this.listenTo(this.entries, "sync", this.updateDatapoints);

                // When we create a model, this.id is undefined: because of this, we listen to
                // the "sync" event, and update the entries' URL upon it (sync is fired when the model is
                // saved, therefore the ID is updated
                this.listenTo(this, "sync", this.updateEntriesURL);

                // We want to listen to the "destroy" event: upon destroy, we need to make
                // sure our entries are also all deleted from the database
                this.listenTo(this, "destroy", this.destroyEntries);
            },

            // In practice, this will mostly be used when the app is running in Chrome App or
            // Cordova mode. In server mode, entries is only modified on the server side, unless
            // we delete points or we download a device log.
            updateDatapoints: function () {
                var points = this.entries.size();
                console.log("*****  Updating Log entries datapoints  " + points);
                this.set('datapoints', points);
                this.set('startstamp', this.entries.getLogStart());
                this.set('endstamp', this.entries.getLogEnd());
                this.save();
            },

            updateEntriesURL: function () {
                /**
                 * Depending on runmode, we are either defining a URL or
                 * relying on backbone localstorage
                 */
                console.log("Device Log: refreshing pointer to log entries URL for Log ID " + this.id);
                if (vizapp.type == "cordova") {
                    // this.entries.localStorage = new Backbone.LocalStorage("org.aerodynes.vizapp.LogEntries-" + this.id);

                    if (this.id != undefined) {
                        this.entries.logsessionid = this.id;
                        this.entries.sync = BackbonePouch.sync({
                            db: new PouchDB('logentries-' + this.id, {
                                adapter: 'websql'
                            }),
                            fetch: 'allDocs',
                            options: {
                                allDocs: {
                                    include_docs: true
                                }
                            }
                        });
                    }
                } else if (vizapp.type == "chrome") {
                    // Also set the log session ID property of the entries
                    if (this.id != undefined)
                        this.entries.logsessionid = this.id;

                } else {
                    this.entries.url = "/logs/" + this.id + "/entries";
                }
            },

            destroyEntries: function () {
                var self = this;
                console.log("Destroy all entries for this log");
                // We only need to do this if we are running in Cordova or Chrome mode, where
                // fetching all entries won't cost us much. In server mode, the backend takes care of
                // deleting everything
                if (vizapp.type == "server") {
                    this.trigger("entry_destroy", 0);
                    return;
                }
                // Stop listening to sync events on entries, otherwise once the entries are deleted,
                // we are recreating the log by updating the data points!
                this.stopListening(this.entries, "sync", this.updateDatapoints);
                this.entries.fetch({
                    success: function (results) {
                        var entry;
                        var points = self.entries.size();
                        while (entry = results.first()) {
                            entry.destroy({
                                success: function (model, response) {
                                    self.trigger("entry_destroy", points--);
                                }
                            });
                        }
                        console.log("Finished destroying all entries");
                    }
                });
            },

            defaults: {
                instrumentid: 0, // Instrument for this log (not the instrument's serial number, but the ID in MongoDB)
                logtype: "", // To be used by the device driver, in case the device supports different
                // kinds of logs.
                swversion: 0, // Keep track of firmware version for the log session (traceability)
                name: "Session", // Let user name logging session if necessary
                description: "Logging session", // Likewise, let user describe the session there too.
                startstamp: 0,
                endstamp: 0,
                datapoints: 0,
                isrecording: false // Flag set to indicate the log is being used by the recorder
            },

            // OPEN QUESTION: shall we remove the startstamp and endstamps altogether,
            // since this info is already contained in the entries ?
            // CON: inconsistencies
            // PRO: does not require to load the whole log in the browser to get the stamps...

            getLogsStart: function () {
                return this.get('startstamp');
            },

            getLogsEnd: function () {
                return this.get('endstamp');
            },


        }),

        /**
         * We only ever request logs linked to a specific Instrument ID,
         * so this collection is normally instanciated from within the "Instrument" model,
         * see the corresponding instrument.js, and this is why we don't see the URL property
         * defined here.
         */
        Logs = Backbone.Collection.extend({

            idAttribute: "_id",
            model: Log,

            initialize: function (models, options) {

                if (vizapp.type == "chrome") {
                    this.database = logs_database;
                    this.storeName = "logs";
                }

            },

            // Depending on the run mode, the "Logs" collection might have
            // a URL where the server will only return the relevant logs, or
            // we might be in a local indexeddb "logs" store, and in this case, we
            // need to fetch only "log" models that match instrumentid
            fetch: function (callback) {
                console.log("[devicelogs.js] Should fetch all logs for instrumentid " + this.instrumentid);
                // Add a condition for the instrumentid
                if (vizapp.type == "chrome")
                    callback.conditions = {
                        instrumentid: this.instrumentid
                    };
                Backbone.Collection.prototype.fetch.call(this, callback);
            },


            // Clears the "isrecording" flag on all logs. Used at instrument open/close/stop record
            clearRecordingFlags: function () {
                console.log("Clearing recording flags if required");
                _.each(this.models, function (log) {
                    // Don't set it again if it is false already, because
                    // this will do a useless save operation (Backbone does not seem
                    // to catch that).
                    if (log.get('isrecording'))
                        log.save({
                            isrecording: false
                        });
                });
            },

            // Create a new subset collection of only some log sessions
            getLogSubset: function (logSessionIDs) {
                var extract = this.filter(function (logSession) {
                    return (logSessionIDs.indexOf(logSession.id) > -1);
                });
                return new Logs(extract);
            },

            // Return the sum of all datapoints in this collection
            getOverallLength: function () {
                var points = 0;
                _.each(this.models, function (log) {
                    points += log.get('datapoints');
                });
                return points;
            },

            // Return the earliest start date of all logs in our collection
            // -> Will only work properly if our logs' log entries are fetched.
            getLogsStart: function () {
                var stamps = [];
                _.each(this.models, function (log) {
                    stamps.push(new Date(log.get('startstamp')).getTime());
                });
                return Math.min.apply(null, stamps);
            },

            getLogsEnd: function () {
                var stamps = [];
                _.each(this.models, function (log) {
                    stamps.push(new Date(log.get('endstamp')).getTime());
                });
                return Math.max.apply(null, stamps);
            },

            // Get all points between date X1 and date X2 across all logs in the
            // collection (both don't have to exactly match a log record).
            // TODO: IS THIS REALLY USED ???
            getDateInterval: function (x1, x2) {
                var extract = this.filter(function (logEntry) {
                    return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
                });
                return new LogEntries(extract); // Return as a new collection, this way we can chain calls
            },

            // Get a specific log entry inside one of the logs in this collection:
            getEntry: function (entryId) {
                for (var log in this.models) {
                    var entry = this.models[log].entries.get(entryId);
                    if (entry != null)
                        return entry;
                }
            },
        });

    return {
        LogEntry: LogEntry,
        LogEntries: LogEntries,
        Log: Log,
        Logs: Logs
    }

});