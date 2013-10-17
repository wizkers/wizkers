/**
 * Where we define the device log data
 */

window.DeviceLogEntry = Backbone.Model.extend({
    
    idAttribute: "_id",

    initialize: function() {
    },
    
    defaults: {
    logsessionid: 0, // Should match the ID of a log session model (see below)
    timestamp: 0,    // Javascript timestamp for that entry (milliseconds since 1970)
    comment: "",     // We will one day support commenting any data point in a log...
    data: null       // Will be an object that depends on the device type
    }

});


/**
 * A device log is a collection of log entries that go together because
 * they all have the same logsessionid
 */
window.deviceLog = Backbone.Collection.extend({

    logsessionid: null,
    
    initialize: function(models, options) {
        this.logsessionid = options.logsessionid;
    },

    
    url: function() {
        return "/logs/" + this.logsessionid + "/entries";
    },

    idAttribute: "_id",

    model: DeviceLogEntry,
    
    // Maintain our collection in order automatically by adding a comparator:
    comparator: 'timestamp',
    
    // Get all points between date X1 and date X2 (both don't have to exactly match a
    // log record).
    getDateInterval: function(x1, x2) {
        var extract = this.filter(function(logEntry) {
            return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
        });
        return new deviceLog(extract); // Return as a new collection, this way we can chain calls
    },
        
    // Get all sessions in a log (there can be several...)
    // Returns an array of session IDs
    getSessions: function() {
        var sessions = [];
        _.each(this.models,function(logEntry) {
            if (sessions.indexOf(logEntry.get('logsessionid')) == -1) {
                sessions.push(logEntry.get('logsessionid'));
            }
        });
        return sessions;
    },
      
    // Get a complete log session:
    byLogSession: function (logSessionID) {
        var extract = this.filter(function(logEntry) {
            return (logEntry.get('logsessionid') == logSessionID);
        });
        return new deviceLog(extract);
    },
        
    // Get multiple log sessions in one geigerLog collection:
    byLogSessions: function(logSessionIDs) {
        var extract = this.filter(function(logEntry) {
            var idx = logSessionIDs.indexOf(logEntry.get('logsessionid'));
            if (idx > -1) {
                return true;
            } else { 
                return false;
            }
        });
        return new deviceLog(extract);
    },

        
    // Get multiple log sessions in an array of deviceLog collections:
    splitByLogSessions: function() {
        var self = this;
        var sessions = [];
        var logSessionIDs = this.getSessions();
        _.each(logSessionIDs,function(id) {
            sessions.push(self.byLogSession(id));
        });
        return sessions;
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
window.LogSession = Backbone.Model.extend({
    
    idAttribute: "_id",

    initialize: function() {
    },
    
   defaults: {
       instrumentid: 0,                // Instrument for this log
       logtype: "",                    // To be used by the device driver, in case the device supports different
                                       // kinds of logs.
       swversion: 0,                   // Keep track of firmware version for the log session (traceability)
       name: "Session",                // Let user name logging session if necessary
       description: "Logging session", // Likewise, let user describe the session there too.
       startstamp: 0,
       endstamp : 0,
       datapoints: 0,
   },
    
});


/**
 * We only ever request log sessions linked to a specific Instrument ID,
 * therefore we have to set instrumentid when creating a log session by
 * passing it in the options: new logSession([],{instrumentid: ID})
 */
window.LogSessions = Backbone.Collection.extend({
    
    idAttribute: "_id",
    model: LogSession,
    
    initialize: function(models, options) {
        this.instrumentid = options.instrumentid;
    },
    
    url: function() {
        if (this.instrumentid) {
            return "/instruments/" + this.instrumentid + "/logs";
        } else {
            return "/logs";
        }
    },
    
    // Create a new collection for only some log sessions
    getLogSessions: function(logSessionIDs) {
        var extract = this.filter(function(logSession) {
            var idx = logSessionIDs.indexOf(logSession.id);
            if (idx > -1) {
                return true;
            } else { 
                return false;
            }
        });
        return new LogSessions(extract, {instrumentid: this.instrumentid});
    },

        
});

    