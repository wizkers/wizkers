/**
 * Where we define the device log data
 */

window.LogEntry = Backbone.Model.extend({
    
    idAttribute: "_id",

    initialize: function() {
    },
    
    defaults: {
    logsessionid: 0, // Should match the ID of a log model (see below)
    timestamp: 0,    // Javascript timestamp for that entry (milliseconds since 1970)
    comment: "",     // We will one day support commenting any data point in a log...
    data: null       // Will be an object that depends on the device type
    }

});


/**
 * A collection of log entries that go together because
 * they all have the same logsessionid
 */
window.LogEntries = Backbone.Collection.extend({

    logsessionid: null,
    
    initialize: function(models, options) {
    },

    
    //url:   is not defined by default, LogEntries is
    // nested inside of Log

    idAttribute: "_id",

    model: LogEntry,
    
    // Maintain our collection in order automatically by adding a comparator:
    comparator: 'timestamp',
    
    // Get all points between date X1 and date X2 (both don't have to exactly match a
    // log record).
    getDateInterval: function(x1, x2) {
        var extract = this.filter(function(logEntry) {
            return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
        });
        return new LogEntries(extract); // Return as a new collection, this way we can chain calls
    },
    
    
    // Our collection is sorted, it makes our life easier:
    getLogStart: function() {
        return this.at(0).get('timestamp');
    },
    
    getLogEnd: function() {
        return this.at(this.length-1).get('timestamp');
    },
 
});

// A log session references a series of log entries for one device.
window.Log = Backbone.Model.extend({
    
    idAttribute: "_id",

    initialize: function() {
        // A lot contains... entries (surprising, eh?). Nest
        // the collection here:
        this.entries = new LogEntries();
        this.entries.url = "/logs/" + this.id + "/entries";
    },
    
   defaults: {
       instrumentid: 0,                // Instrument for this log (not the instrument's serial number, but the ID in MongoDB)
       logtype: "",                    // To be used by the device driver, in case the device supports different
                                       // kinds of logs.
       swversion: 0,                   // Keep track of firmware version for the log session (traceability)
       name: "Session",                // Let user name logging session if necessary
       description: "Logging session", // Likewise, let user describe the session there too.
       startstamp: 0,
       endstamp : 0,
       datapoints: 0,
   },
    
    // OPEN QUESTION: shall we remove the startstamp and endstamps altogether,
    // since this info is already contained in the entries ?
    // CON: inconsistencies
    // PRO: does not require to load the whole log in the browser to get the stamps...
            
    getLogsStart: function() {
        return this.get('startstamp');
    },
    
    getLogsEnd: function() {
        return this.get('endstamp');
    },

    
});


/**
 * We only ever request log sessions linked to a specific Instrument ID,
 * so this collection is normally instanciated from within the "Instrument" model,
 * see the corresponding instrument.js
 */
window.Logs = Backbone.Collection.extend({
    
    idAttribute: "_id",
    model: Log,
    
    initialize: function(models, options) {
    },
    
    url: "/logs",
    
    // Create a new subset collection of only some log sessions
    getLogSubset: function(logSessionIDs) {
        var extract = this.filter(function(logSession) {
            return( logSessionIDs.indexOf(logSession.id) > -1);
        });
        return new Logs(extract);
    },
    
    // Return the sum of all datapoints in this collection
    getOverallLength: function() {
        var points = 0;
        _.each(this.models,function(log){
            points += log.get('datapoints');
        });
        return points;
    },
        
    // Return the earliest start date of all logs in our collection
    // -> Will only work properly if our logs' log entries are fetched.
    getLogsStart: function() {
        var stamps = [];
        _.each(this.models,function(log) {
            stamps.push(new Date(log.get('startstamp')).getTime());
                             });
        return Math.min.apply(null,stamps);        
    },
    
    getLogsEnd: function() {
        var stamps = [];
        _.each(this.models,function(log) {
            stamps.push(new Date(log.get('endstamp')).getTime());
                             });
        return Math.max.apply(null,stamps);
    },

    // Get all points between date X1 and date X2 across all logs in the
    // collection (both don't have to exactly match a log record).
    getDateInterval: function(x1, x2) {
        var extract = this.filter(function(logEntry) {
            return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
        });
        return new LogEntries(extract); // Return as a new collection, this way we can chain calls
    },


        
});

    