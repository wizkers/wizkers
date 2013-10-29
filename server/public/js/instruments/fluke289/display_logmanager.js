/**
 * A screen to manage on-device data/logs and download it to
 * our database.
 */

window.Fluke289LogManagementView = Backbone.View.extend({

    initialize:function (options) {
        
        linkManager.on('input', this.showInput, this);
        this.deviceLogs = this.collection;
        this.logtoDownloadData = null;
        this.currentLog = null;
        this.currentLogIndex = -1;

    },
    
    
    render: function() {
        $(this.el).html(this.template());
        // The link manager is always connected when we initialize (main.js makes sure of that)
        // so we send a few commands to initialize the contents of the display:
        linkManager.driver.getMemInfo();

        return this;
    },
    
    onClose: function() {
        //linkManager.off('input', this.showInput, this);
        linkManager.off(null,null,this);
    
    },
    
    events: {
        "click .trendlog": "dlTrendlog",
        "click .start-download": "startDownload",
    },
    
    showInput: function(data) {
        var self = this;
        console.log("Fluke289 Log Mgt view input processing");
        if(data.memlevel) {
            var span =$('#memlevel',this.el);
            span.html(data.memlevel);
            switch(data.memlevel) {
                    case 'OK':
                        span.addClass("label-success").removeClass("label-warning").removeClass("label-important");
                        break;
                    default:
                        span.removeClass("label-success").removeClass("label-warning").removeClass("label-important");
            }
        }
        
        if (data.savedlogs) {
            _.each(data.savedlogs, function(value,key) {
                $('#mem'+key,this.el).html(value);
                // Then query information about each of those logs
                    var i=0;
                if (key == "record") {
                    while(i < value)
                        linkManager.manualCommand('QRSI ' + i++);
                } else if (key == "minmax") {
                    while(i < value)
                        linkManager.manualCommand('QMMSI ' + i++);
                }

            });   
        }
        
        if (data.recordingID) {  // recordingID means Trendlog recording
            // 2 possibilities: either a summary, or a record
            var fields = data.recordingID.split(',');
            if (fields.length == 1) {
                // This is a trendlog recording sumary: add a summary card for it
                var card = _.template('<li>' +
                                      '<div class="thumbnail glowthumbnail thumbnail-larger select" style="text-align: center;"><h4><%=recordingName%></h4>' +
                                      '<small>Start&nbsp;time:</small><%= new Date(startTime) %>' +
                                      'Duration:<%= utils.hms(Math.floor((endTime-startTime)/1000+0.5)) %><br>' +
                                      'Records: <%= numberOfRecords %>' +
                                      '<div style="text-align:left;">Type: <%= reading.primaryFunction %> / <%= reading.secondaryFunction %><br>' +
                                      'Event threshold: <%= (evtThreshold*100).toFixed(1) %>%<br>' +
                                      'Interval sample: <%= interval %>&nbsp;s'+
                                      '</div><div><a class="btn btn-mini download trendlog" data-type="trendlog" data-name="<%= recordingName %>" data-id="<%=recordingID%>" ' +
                                      ' data-start="<%=startTime%>" data-end="<%=endTime%>" data-address="<%=recordingAddress%>" ' +
                                      ' data-records="<%=numberOfRecords%>" href="#">Download</a>' +
                                      '</div><div>' +
                                      '<%= alreadyThere %>' +
                                      '</div></li>');
                var startStamp = new Date(data.startTime).toISOString();
                var knownLog = this.deviceLogs.where({startstamp: startStamp});
                // A given device can only record one log at a time, so if we already have a log for this device
                // in our database, that starts at the same time as this one, we can safely assume this means that
                // we already downloaded this log
                data.alreadyThere = "<em>New log<sm>";
                if (knownLog.length > 0)
                    data.alreadyThere = "<strong>This log is already downloaded<strong>";
                
                $('#records',this.el).append(card(data));
            } else {
                // We just received a log entry for a Trendlog recording we are downloading: save it and request the
                // next log entry
                
                var stamp = data.record.startTime;
                var logEntry = new LogEntry({
                                                timestamp:stamp,
                                                data: data.record
                                              });
                this.currentLog.entries.add(logEntry);
                logEntry.save(null, {
                    success:function() {
                        if (self.currentLogIndex < self.logtoDownloadData.records)
                            linkManager.driver.getTrendlogRecord(self.logtoDownloadData.address, self.currentLogIndex++);
                    }
                });
                
            }
        }
        
        if (data.minmaxRecordingID) {  // recordingID means Trendlog recording
            // This is a MinMax sumary: add a summary card for it
            var card = _.template('<li><div class="thumbnail glowthumbnail thumbnail-larger select" style="text-align: center;"><h4><%=recordingName%></div></li>');
            $('#minmaxs',this.el).append(card(data));            
        }
        
    
    },
    
    dlTrendlog: function(event) {
        $('#logname').val($(event.currentTarget).data('name'));        
        this.logtoDownloadData= $(event.currentTarget).data();
        $('#logModal').modal('show');
        return false;
    },
    
    startDownload: function(event) {
        var self = this;
        this.currentLog = new Log();
        this.currentLog.set('name', $('#logname',this.el).val());
        this.currentLog.set('description', $('#description', this.el).val());
        this.currentLog.set('startstamp', this.logtoDownloadData.start);
        this.currentLog.set('endstamp', this.logtoDownloadData.end);
        if (this.logtoDownloadData.type == "trendlog")
            this.currentLog.set('logtype', 'trendlog');
        this.deviceLogs.add(this.currentLog);
        // Now, initiate log download:
        this.currentLogIndex = 0;
        this.currentLog.save(null, {
            success: function() {
                    self.currentLog.updateEntriesURL(); // Somehow this is required ??
                    self.currentLog.entries.fetch({
                        success: function() {
                            linkManager.driver.getTrendlogRecord(self.logtoDownloadData.address, self.currentLogIndex++);
                        }
                    });
            }
        });
        return false;
    },
    
});