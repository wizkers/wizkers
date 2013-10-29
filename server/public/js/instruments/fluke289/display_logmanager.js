/**
 * A screen to manage on-device data/logs and download it to
 * our database.
 */

window.Fluke289LogManagementView = Backbone.View.extend({

    initialize:function (options) {
        
        linkManager.on('input', this.showInput, this);
        
        this.logIDToDownload = -1;

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
            // This is a trendlog recording sumary: add a summary card for it
            var card = _.template('<li><div class="thumbnail glowthumbnail thumbnail-larger select" style="text-align: center;"><h4><%=recordingName%></h4>' +
                                  '<small>Start&nbsp;time:</small><%= new Date(startTime) %><br>Duration:<%= utils.hms(Math.floor((endTime-startTime)/1000+0.5)) %><br>' +
                                  'Records: <%= numberOfRecords %>' +
                                  '<div style="text-align:left;">Type: <%= reading.primaryFunction %> / <%= reading.secondaryFunction %><br>' +
                                  'Event threshold: <%= (evtThreshold*100).toFixed(1) %>%<br>' +
                                  'Interval sample: <%= interval %>&nbsp;s'+
                                  '</div><div><a class="btn btn-mini download trendlog" data-name="<%= recordingName %>" data-id="<%=recordingID%>" href="#">Download</a></div></li>');
            $('#records',this.el).append(card(data));            
        }
        
        if (data.minmaxRecordingID) {  // recordingID means Trendlog recording
            // This is a MinMax sumary: add a summary card for it
            var card = _.template('<li><div class="thumbnail glowthumbnail thumbnail-larger select" style="text-align: center;"><h4><%=recordingName%></div></li>');
            $('#minmaxs',this.el).append(card(data));            
        }
        
    
    },
    
    dlTrendlog: function(event) {
        $('#logname').val($(event.currentTarget).data('name'));
        this.logIDToDownload = $(event.currentTarget).data('id');
        $('#logModal').modal('show');
        return false;
    },
    
    startDownload: function(event) {
    
    },
    
});