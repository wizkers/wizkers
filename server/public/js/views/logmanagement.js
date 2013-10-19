// Log management.
// 
// Our model is the settings object.
//
//  This needs to turn into a dispatcher that displays log management
// for the currently selected device type.

window.LogManagementView = Backbone.View.extend({

    initialize:function () {
        
        this.deviceLogs = this.collection;
        this.selectedLogs = [];        
    },
    
    events: {
        "click a": "handleaclicks",
        "change .logcheckbox": "refreshLogList",
        "click .displaylog": "displayLog",
    },
    
    /* Nice way to disable an anchor button when it is disabled */
    handleaclicks: function(event) {
        if ($(event.currentTarget).attr('disabled'))
            event.preventDefault();
    },
    
    
    // Called when a checkbox is clicked
    refreshLogList: function() {
        var list = $('.logcheckbox',this.el);
        // Create a list of all checked entry IDs
        var entries=[];
        _.each(list, function(entry) {
            if (entry.checked)
                entries.push(entry.value);
        });
        this.selectedLogs = entries;
        this.render();
    },
    
    displayLog: function() {
        if ($('.displaylog', this.el).attr('disabled'))
            return false;
        app.navigate('displaylogs/' + settings.get('currentInstrument') + '/' + this.selectedLogs.join(','),true);
        return false;
    },
    
    render:function () {
        var self = this;
        console.log('Main render of Log management view');

        $(this.el).html(this.template({ deviceLogs: this.collection.toJSON(), selected: this.selectedLogs}));

        // Depending on device capabilities, enable/disable "device logs" button
        if (instrumentManager.getCaps().indexOf("LogManagementView") == -1 || ! linkManager.connected) {
                $('.devicelogs',self.el).attr('disabled', true);
        }
        return this;
    },
    
    onClose: function() {
        console.log("Log management view closing...");
        
        // Restore the settings since we don't want them to be saved when changed from
        // the home screen
        settings.fetch();
    },
        
    // Generate a "blob:"  URL to download (all) the data;
    saveDataUrl: function() {
        var json = "";
        for (var i=0; i < this.onyxlog.length; i++) {
            json += "{timestamp:" + this.onyxlog.at(i).get('timestamp') +
                    ",cpm:" + this.onyxlog.at(i).get('cpm') + "},";
        }

        var jsonBlob = new Blob([json], {type: 'application/json'});
        var url = window.URL.createObjectURL(jsonBlob);
        $('.ctrl-save', this.el).attr('href', url);
    },
    
    
    // We can only add the plot once the view has finished rendering and its el is
    // attached to the DOM, so this function has to be called from the home view.
    addPlot: function() {
        var self=this;
        
        $('#log_size',this.el).html(this.onyxlog.length);
        $('#log_start',this.el).html(new Date(this.onyxlog.getLogStart()).toString());
        $('#log_end',this.el).html(new Date(this.onyxlog.getLogEnd()).toString());

        
        // Now initialize the plot area:
        console.log('Geiger chart size: ' + this.$('.locochart').width());
        
        // Restore current zoom level if it exists:
        if (this.ranges) {
            this.plot = $.plot($(".locochart",this.el), this.getData(this.ranges.xaxis.from, this.ranges.xaxis.to),
                $.extend(true, {}, this.plotOptions, {
                    xaxis: { min: this.ranges.xaxis.from, max: this.ranges.xaxis.to },
                    yaxis: { min: this.ranges.yaxis.from, max: this.ranges.yaxis.to }
                })
             );

        } else {
            this.plot = $.plot($(".locochart", this.el), this.packData(this.onyxlog), this.plotOptions);
        };
            
        $(".locochart", this.el).bind("plothover", function (event, pos, item) {
            if (item) {
                if (previousPoint != item.dataIndex) {
                    previousPoint = item.dataIndex;

                    $("#tooltip").remove();
                    var x = item.datapoint[0],
                    y = item.datapoint[1];

                    self.showTooltip(item.pageX, item.pageY,
                        "<small>" + ((self.settings.get('timezone') === 'UTC') ? 
                                        new Date(x).toUTCString() :
                                        new Date(x).toString()) + "</small><br>" + item.series.label + ": <strong>" + y + "</strong>");
                }
            } else {
                $("#tooltip").remove();
                previousPoint = null;            
            }
        });

        // Create the overview chart:
        this.overview = $.plot($("#overview",this.el), this.packData(this.onyxlog), this.overviewOptions);
        
        // Connect overview and main charts
        $(".locochart",this.el).bind("plotselected", function (event, ranges) {

            // clamp the zooming to prevent eternal zoom

            if (ranges.xaxis.to - ranges.xaxis.from < 0.00001) {
                ranges.xaxis.to = ranges.xaxis.from + 0.00001;
            }

            if (ranges.yaxis.to - ranges.yaxis.from < 0.00001) {
                ranges.yaxis.to = ranges.yaxis.from + 0.00001;
            }
            
            // Save the current range so that switching plot scale (log/linear)
            // can preserve the zoom level:
            self.ranges = ranges;

            // do the zooming
            this.plot = $.plot($(".locochart",this.el), self.getData(ranges.xaxis.from, ranges.xaxis.to),
                $.extend(true, {}, self.plotOptions, {
                    xaxis: { min: ranges.xaxis.from, max: ranges.xaxis.to },
                    yaxis: { min: ranges.yaxis.from, max: ranges.yaxis.to }
                })
             );

            // don't fire event on the overview to prevent eternal loop
            self.overview.setSelection(ranges, true);
        });

        $("#overview",this.el).bind("plotselected", function (event, ranges) {
             self.plot.setSelection(ranges);
          });
        
        // Last, update the save data URL to point to the data we just displayed:
        this.saveDataUrl();

    },

    packData: function(values) {
        // Create a table of Y values with the x values from our collection
        var data = [];
        // Split by Session ID:
        var logs = values.splitByLogSessions();
        for (var j=0; j<logs.length; j++) {
            var ret = [];
            var value = logs[j];
            for (var i=0; i < value.length; i++) {
                var entry = value.at(i);
                ret.push([entry.get('timestamp'), entry.get('cpm')]);
            }
            data.push({ data:ret, label:"CPM"});
        }
        return data;
    },
    
    // Ugly at this stage, just to make it work (from flotcharts.org examples)
    showTooltip: function (x, y, contents) {
			$("<div id='tooltip' class='well'>" + contents + "</div>").css({
				position: "absolute",
				display: "none",
				top: y + 5,
				left: x + 5,
                padding: "3px",
				opacity: 0.90
			}).appendTo("body").fadeIn(200);
    },
    
    getData: function(x1, x2) {
        return this.packData(this.onyxlog.getDateInterval(x1,x2));
    },

    
});