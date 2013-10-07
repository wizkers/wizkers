/**
 * Where we define the geiger counter log data
 */

window.geigerLogEntry = Backbone.Model.extend({

    initialize: function () {
    },

    defaults: {
        logsessionid: 0,    // Should match the ID of a log session model (see below)
        timestamp: 0,       // Javascript timestamp
        cpm: 0,
        duration:0,
        accel_x_start:0,
        accel_y_start:0,
        accel_z_start:0,
        accel_x_end:0,
        accel_y_end:0,
        accel_z_end:0,
        comment: "",        // TODO: enable adding a comment to a datapoint ?
    }
});

window.geigerLog = Backbone.Collection.extend({
    
   model: geigerLogEntry,
   localStorage: new Backbone.LocalStorage("org.aerodynes.onyxdisplay.GeigerLog"), // Unique name within your app.
    
    // Maintain our collection in order automatically by adding a comparator:
    comparator: 'timestamp',
    
    // Get all points between date X1 and date X2 (both don't have to exactly match a
    // log record).
    getDateInterval: function(x1, x2) {
        var extract = this.filter(function(logEntry) {
            return (logEntry.get('timestamp') > x1) && (logEntry.get('timestamp') < x2);
        });
        return new geigerLog(extract); // Return as a new collection, this way we can chain calls
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
        return new geigerLog(extract);
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
        return new geigerLog(extract);
    },

        
    // Get multiple log sessions in an array of geigerLog collections:
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
window.logSession = Backbone.Model.extend({
    
    initialize: function() {
    },
    
   defaults: {
       guid: 0, // Device UUID for this log session
       swversion: 0, // Keep track of firmware version for the log session (traceability)
       name: "Session", // Let user name logging session if necessary
       description: "Logging session", // Likewise, let user describe the session there too.
       startstamp: 0,
       endstamp : 0,
       datapoints: 0,
   },
    
   refreshDataPoints: function() {
       // Return the number of datapoints for this session
        var allLogEntries = new geigerLog();
        allLogEntries.fetch();
        this.set('datapoints',allLogEntries.byLogSession(this.id).models.length);
   }

});

window.logSessions = Backbone.Collection.extend({
    model: logSession,
    localStorage: new Backbone.LocalStorage("org.aerodynes.onyxdisplay.GeigerLogSessions"), // Unique name within the app
    
    byGUID: function(guid) {
        // Get all the log sessions for one specific device:
        var extract = this.filter(function(logSession) {
                    return (logSession.get('guid') == guid)
                        });
        return new logSessions(extract);
    },
});
    
    