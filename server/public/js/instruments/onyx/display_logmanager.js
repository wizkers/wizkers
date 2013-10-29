/**
 * Log management for the Onyx device: the Onyx only supports basic log management, namely
 * log downloads & clear
 */

window.OnyxLogManagementView = Backbone.View.extend({

    initialize:function (options) {
        linkManager.on('input', this.showInput, this);
        this.deviceLogs = this.collection; // The logs are already loaded from the server
        this.instrument = instrumentManager.getInstrument();
    },

    render:function () {
        $(this.el).html(this.template());
        linkManager.driver.logstatus();
        return this;
    },
    
    onClose: function() {
        linkManager.off(null,null,this);
    
    },
    
    events: {
        "click .downloadlog": "downloadlog",
    },
    
    
    downloadlog: function(event) {
        $('#logModal', this.el).modal('show');
        linkManager.manualCommand('LOGXFER');
        return false;
    },
    
    showInput: function(data) {
        if (!isNaN(data.log_size)) {
                this.saveLogSession(data);
        } else
        if (data.logstatus != undefined) {
            var used = data.logstatus.used;
            var total = data.logstatus.total;
            var interval = data.logstatus.interval;
            $('#memlevel',this.el).html((used/total).toFixed(0) + "%");
            $('#memused',this.el).html(used);
            $('#memtotal',this.el).html(total);
            $('#meminterval',this.el).html(interval + ' seconds');
        }
    },

    saveLogSession: function(data) {
        console.log("Log transfer incoming...");

        var points = data.log_data;
        // Phase I: check if this log is already stored and we need to append to it, or if
        // this is a new log. We do this by checking the timestamp of the 1st
        // point, and see if it exists in the database:
        var firststamp = new Date(points[0].time).toISOString();
        var knownLog = this.deviceLogs.where({startstamp: firststamp});

        var currentLog = null;
        var newPoints = 0;
        if (knownLog.length >0) { // We already have a log starting there.
            if (knownLog.length > 1)
                alert('Oops: we have multiple logs for the device starting at the same time, this is a bug.');
            // The incoming log is the continuation of a log we already
            // know about (i.e. the log was not cleared since last download)
            currentLog = knownLog[0];
        }

        if (currentLog == null) {
            // We don't know this log: create a new session
            currentLog = new Log();
            this.deviceLogs.add(currentLog);
            currentLog.set('startstamp', new Date(points[0].time).getTime());
            // The type is purely arbitrary: we are using the type "onyxlog" for
            // logs that are downloaded from the Onyx device
            currentLog.set('logtype', 'onyxlog'); 
        }
        currentLog.set('endstamp', new Date(points[points.length-1].time).getTime());                                      
        currentLog.save(null,{
            success: function() {
                // We now gotta fetch all existing log entries for the log so that
                // we don't create duplicates
                currentLog.entries.fetch({
                    success: function() {                    
                        // Phase II: We now have our log ID, let's save all the log
                        // entries:
                        for (var i=0; i < points.length; i++) {
                            var pointStamp = new Date(points[i].time);
                            // Don't overwrite existing entries:
                            var logEntry = currentLog.entries.where({timestamp:pointStamp.toISOString()});
                            if (logEntry.length == 0) {
                                newPoints++;
                                // Only add new entries, don't overwrite existing ones...
                                // Note: the logsession ID is automaticallyu added by the
                                //       server.
                                logEntry = new LogEntry({
                                                timestamp:pointStamp.getTime(),
                                                data: points[i]
                                              });
                                currentLog.entries.add(logEntry);
                                logEntry.save();    
                            }
                        }
                        $('#logModal .modal-body', this.el).html('<p>Log downloaded.</p><p>New data points:' + newPoints + '.</p>');
                        $('#logDismissOK', this.el).removeAttr('disabled');
                    }
                });                
            }
        });   
    },  


});